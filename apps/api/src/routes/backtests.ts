import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant, type Tx } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { engine } from "./scenarios";

/**
 * Back-testing (TR-039, Q050). Prices are sourced facts (EIA Brent, daily); episode sizes are assumed
 * facts with their basis. The fit runs in the reasoning service. A domain expert other than the person
 * who ran it adopts a run; from then on scenarios use the fitted response, and say so in their lineage.
 */
interface BacktestResult { model_version: string; method: string; episodes: unknown[]; fitted: Record<string, number>; prior: Record<string, number>; metrics: Record<string, number>; input_hash: string }

async function inputs(tx: Tx) {
  const eps = (await tx.query(
    `SELECT f.subject AS key, f.subject_label AS name, max(f.value_text) FILTER (WHERE f.predicate = 'event_date') AS date,
            max(f.value_num) FILTER (WHERE f.predicate = 'supply_loss_mbd') AS loss, max(f.value_num) FILTER (WHERE f.predicate = 'world_demand_mbd') AS world,
            array_agg(f.id) FILTER (WHERE f.predicate IN ('supply_loss_mbd','world_demand_mbd')) AS fact_ids
       FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE s.key = 'tigeris.episodes' AND e.duplicate_of IS NULL GROUP BY f.subject, f.subject_label ORDER BY 3`)).rows;
  const prices = (await tx.query(
    `SELECT f.id, f.period AS date, f.value_num AS value FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE s.key = 'eia.brent' AND f.predicate = 'brent_spot_usd' AND e.duplicate_of IS NULL ORDER BY f.period`)).rows;
  return eps.map((e) => ({ key: e.key, name: e.name, date: e.date, loss_mbd: Number(e.loss), world_mbd: Number(e.world), fact_ids: e.fact_ids,
    prices: prices.filter((p) => Math.abs(new Date(p.date).getTime() - new Date(e.date).getTime()) < 60 * 86_400_000).map((p) => ({ date: p.date, value: Number(p.value), fact_id: p.id })) }));
}

/** The adopted calibration, in the form the scenario engine takes. */
export async function adoptedCalibration(tx: Tx) {
  const r = (await tx.query("SELECT id, fitted, metrics FROM backtest_runs WHERE status = 'adopted' LIMIT 1")).rows[0];
  return r ? { id: r.id as string, response_pct_per_pct: r.fitted.response_pct_per_pct as number, episodes: r.metrics.episodes, mae_pp: r.metrics.mae_pp, loo_mae_pp: r.metrics.loo_mae_pp } : null;
}

export async function backtestRoutes(app: FastifyInstance) {
  app.get("/backtests", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      runs: (await tx.query("SELECT id, model_version, input_hash, method, episodes, fitted, prior, metrics, status, run_by_label, adopted_by_label, adopted_at, created_at FROM backtest_runs ORDER BY created_at DESC LIMIT 20")).rows,
      available: (await inputs(tx)).map((e) => ({ key: e.key, name: e.name, date: e.date, prices: e.prices.length })),
    }));
  });

  app.post("/backtests", { preHandler: requirePermission("scenario.run") }, async (req, reply) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const episodes = await inputs(tx);
      if (episodes.filter((e) => e.prices.length > 20).length < 2) return reply.code(409).send({ error: "no_data", message: "Import the back-test package first: it carries the Brent prices and episodes." });
      const r = await engine<BacktestResult>("/backtest/run", { episodes, pre_days: 10, post_days: 3 });
      const row = await tx.query<{ id: string }>(
        "INSERT INTO backtest_runs (institution_id, model_version, input_hash, method, episodes, fitted, prior, metrics, run_by, run_by_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
        [p.institutionId, r.model_version, r.input_hash, r.method, JSON.stringify(r.episodes), JSON.stringify(r.fitted), JSON.stringify(r.prior), JSON.stringify(r.metrics), p.principalId, p.displayName]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "backtest.run", resourceType: "backtest_run", resourceId: row.rows[0]!.id, details: { inputHash: r.input_hash, ...r.metrics, fitted: r.fitted.response_pct_per_pct } });
      return { id: row.rows[0]!.id, ...r };
    });
  });

  app.post("/backtests/:id/adopt", { preHandler: requirePermission("scenario.run") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().min(5).max(500) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const r = (await tx.query("SELECT id, status, run_by, fitted, metrics FROM backtest_runs WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (!r) return reply.code(404).send({ error: "not_found", message: "No such back-test run." });
      const refuse = p.role !== "domain_expert" ? "Only a domain expert adopts a calibration." : r.run_by === p.principalId ? "The person who ran the back-test cannot adopt it." : r.status !== "proposed" ? `This run is already ${r.status}.` : null;
      if (refuse) {
        await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "backtest.adopt_refused", resourceType: "backtest_run", resourceId: id, details: { reason: refuse } });
        return reply.code(403).send({ error: "block", message: refuse });
      }
      await tx.query("UPDATE backtest_runs SET status = 'superseded' WHERE status = 'adopted'");
      await tx.query("UPDATE backtest_runs SET status = 'adopted', adopted_by_label = $2, adopted_at = now() WHERE id = $1", [id, p.displayName]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "backtest.adopted", resourceType: "backtest_run", resourceId: id, details: { reason, fitted: r.fitted, metrics: r.metrics } });
      return { adopted: id, fitted: r.fitted };
    });
  });
}
