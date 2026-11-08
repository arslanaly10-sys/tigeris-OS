import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Tx } from "../db";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { config } from "../config";
import { requirePermission } from "../session";
import { impactPaths } from "../graph/traverse";

const DRIVER_KEYS = ["duration_days", "oil_price_usd", "route_availability_pct", "insurance_premium_pct", "reserve_buffer_days", "rate_shock_bps", "demand_change_pct"] as const;
const driversSchema = z.object(Object.fromEntries(DRIVER_KEYS.map((k) => [k, z.number().optional()]))).strict();
const variantSchema = z.object({ name: z.string().min(1).max(80), drivers: driversSchema });

export async function engine<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${config.reasoningUrl}${path}`, {
    method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Reasoning service returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Assembles the engine input from this institution's own facts and graph (TR-035). */
export async function buildPayload(tx: Tx, caseRow: { id: string; scenario_template: string }) {
  const fact = async (predicate: string) => (await tx.query(
    `SELECT f.id, f.value_num FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE s.key = 'eia.chokepoints' AND f.predicate = $1 AND e.duplicate_of IS NULL ORDER BY f.created_at DESC LIMIT 1`, [predicate])).rows[0];
  const facts: Record<string, unknown> = {};
  for (const [key, pred] of [["hormuz_flow_mbd", "oil_transit_flow"], ["hormuz_world_share_pct", "share_global_liquids_consumption"], ["bypass_capacity_mbd", "bypass_capacity_available"]] as const) {
    const f = await fact(pred);
    if (f) facts[key] = { value: f.value_num, fact_id: f.id };
  }
  const exportsRows = (await tx.query(
    `SELECT DISTINCT ON (f.subject) f.subject, f.id, f.value_num FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
      WHERE s.key = 'jodi.oil' AND f.predicate = 'crude_exports_kbd' AND e.duplicate_of IS NULL ORDER BY f.subject, f.period DESC`)).rows;
  facts.gcc_crude_exports_kbd = Object.fromEntries(exportsRows.map((r) => [r.subject, { value: r.value_num, fact_id: r.id }]));

  const origin = (await tx.query("SELECT e.key FROM case_entities ce JOIN entities e ON e.id = ce.entity_id WHERE ce.case_id = $1 AND ce.role = 'origin' ORDER BY (e.type = 'chokepoint') DESC LIMIT 1", [caseRow.id])).rows[0]?.key ?? "chokepoint:hormuz";
  const paths = await impactPaths(tx, origin, { maxDepth: 4, maxNodes: 400 });
  const onPath = new Map((paths?.hops ?? []).filter((h) => h.entity.type === "holding").map((h) => [h.entity.key, h.cumulativeWeight]));
  const holdings = (await tx.query("SELECT key, name, attributes FROM entities WHERE type = 'holding'")).rows;
  const priceLike = ["oil45", "banking", "pandemic"].includes(caseRow.scenario_template);
  const exposures = holdings
    .filter((h) => onPath.has(h.key) || priceLike)
    .map((h) => {
      const v = h.attributes.value_usd;
      return { holding_key: h.key, name: h.name, sector: h.attributes.sector, value_usd: typeof v === "object" ? v.value : v, value_fact_id: typeof v === "object" ? v.factId : null, path_strength: onPath.get(h.key) ?? 1, via_origin: onPath.has(h.key), price_linked: ["Energy", "Petrochemicals"].includes(h.attributes.sector) };
    });
  const portfolio = holdings.reduce((s, h) => s + (typeof h.attributes.value_usd === "object" ? h.attributes.value_usd.value : h.attributes.value_usd), 0);
  const snapshot = (await tx.query("SELECT id FROM graph_snapshots WHERE scope = 'institution' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id ?? null;
  return { payload: { template: caseRow.scenario_template, facts, exposures, portfolio_value_usd: portfolio, origin, monte_carlo_runs: 200, seed: 7 }, snapshot };
}

export interface EngineResult {
  model_version: string; input_hash: string; drivers: Record<string, number>; derived: unknown; cascade: unknown; resilience: unknown; sensitivity: unknown; top_exposures: unknown; monte_carlo_runs: number;
  results: Array<{ key: string; label: string; unit: string; horizon: string; value: number; p10: number | null; p50: number | null; p90: number | null; method: string; formula: string; inputs: Array<{ kind: "fact" | "assumption"; ref?: string | null; key: string }> }>;
  assumptions: Array<{ key: string; label: string; kind: "driver" | "parameter"; value: number | null; unit: string; basis: string }>;
}

export async function persistRun(tx: Tx, inst: string, caseId: string, groupId: string, variant: string, name: string, payload: unknown, snapshot: string | null, r: EngineResult, ms: number, actor: { id: string; label: string }) {
  const run = await tx.query<{ id: string }>(
    `INSERT INTO scenario_runs (institution_id, case_id, group_id, variant, name, template, model_version, input_hash, payload, graph_snapshot_id, derived, cascade, resilience, sensitivity, top_exposures, monte_carlo_runs, duration_ms, created_by, created_by_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
    [inst, caseId, groupId, variant, name, (payload as { template: string }).template, r.model_version, r.input_hash, JSON.stringify(payload), snapshot, JSON.stringify(r.derived), JSON.stringify(r.cascade),
      JSON.stringify(r.resilience), JSON.stringify(r.sensitivity), JSON.stringify(r.top_exposures), r.monte_carlo_runs, ms, actor.id, actor.label],
  );
  const runId = run.rows[0]!.id;
  const aIds = new Map<string, string>();
  for (const a of r.assumptions) {
    const x = await tx.query<{ id: string }>("INSERT INTO scenario_assumptions (institution_id, run_id, key, label, kind, value_num, unit, basis) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id", [inst, runId, a.key, a.label, a.kind, a.value, a.unit, a.basis]);
    aIds.set(a.key, x.rows[0]!.id);
  }
  for (const res of r.results) {
    const x = await tx.query<{ id: string }>(
      "INSERT INTO scenario_results (institution_id, run_id, key, label, horizon, unit, value, p10, p50, p90, method, formula) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
      [inst, runId, res.key, res.label, res.horizon, res.unit, res.value, res.p10, res.p50, res.p90, res.method, res.formula],
    );
    for (const i of res.inputs) {
      if (i.kind === "fact" && i.ref) await tx.query("INSERT INTO scenario_result_inputs (institution_id, result_id, fact_id, note) VALUES ($1,$2,$3,$4)", [inst, x.rows[0]!.id, i.ref, i.key]);
      else if (i.kind === "assumption" && aIds.has(i.key)) await tx.query("INSERT INTO scenario_result_inputs (institution_id, result_id, assumption_id, note) VALUES ($1,$2,$3,$4)", [inst, x.rows[0]!.id, aIds.get(i.key), i.key]);
    }
  }
  return runId;
}

export async function loadGroup(tx: Tx, groupId: string) {
  const runs = (await tx.query("SELECT id, group_id, variant, name, template, model_version, input_hash, derived, cascade, resilience, sensitivity, top_exposures, monte_carlo_runs, duration_ms, created_by_label, created_at, payload->'drivers' AS drivers_in FROM scenario_runs WHERE group_id = $1 ORDER BY variant", [groupId])).rows;
  for (const r of runs) {
    r.results = (await tx.query("SELECT id, key, label, horizon, unit, value, p10, p50, p90, method FROM scenario_results WHERE run_id = $1", [r.id])).rows;
    r.assumptions = (await tx.query("SELECT key, label, kind, value_num, unit FROM scenario_assumptions WHERE run_id = $1 AND kind = 'driver' ORDER BY key", [r.id])).rows;
  }
  return runs;
}

export async function scenarioRoutes(app: FastifyInstance) {
  app.get("/scenarios/templates", { preHandler: requirePermission("case.read") }, async () => engine("/scenarios/templates"));

  /** Runs a baseline and up to two alternatives for a case, side by side (Q075). */
  app.post("/cases/:key/scenarios", { preHandler: requirePermission("scenario.run") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const { variants } = z.object({ variants: z.array(variantSchema).min(1).max(3) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, case_key, scenario_template FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return reply.code(404).send({ error: "not_found", message: "No such case." });
      const { payload, snapshot } = await buildPayload(tx, c);
      const groupId = randomUUID();
      const labels = ["baseline", "alt1", "alt2"];
      for (const [i, v] of variants.entries()) {
        const input = { ...payload, drivers: v.drivers };
        const t0 = Date.now();
        const r = await engine<EngineResult>("/scenarios/run", input);
        await persistRun(tx, p.institutionId, c.id, groupId, labels[i]!, v.name, input, snapshot, r, Date.now() - t0, { id: p.principalId, label: p.displayName });
      }
      await tx.query("UPDATE cases SET last_activity_at = now() WHERE id = $1", [c.id]);
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'scenario_run',$3,$4,$5,$6)", [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ groupId, variants: variants.map((v) => v.name) })]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "scenario.run", resourceType: "scenario_group", resourceId: groupId, caseId: c.id, details: { variants: variants.length, template: c.scenario_template, graphSnapshot: snapshot } });
      return { groupId, runs: await loadGroup(tx, groupId) };
    });
  });

  app.get("/cases/:key/scenarios", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, scenario_template FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return reply.code(404).send({ error: "not_found", message: "No such case." });
      const last = (await tx.query("SELECT group_id FROM scenario_runs WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1", [c.id])).rows[0];
      const history = (await tx.query("SELECT group_id, min(created_at) AS created_at, string_agg(name, ' · ' ORDER BY variant) AS names, min(created_by_label) AS by FROM scenario_runs WHERE case_id = $1 GROUP BY group_id ORDER BY 2 DESC LIMIT 10", [c.id])).rows;
      return { template: c.scenario_template, runs: last ? await loadGroup(tx, last.group_id) : [], history };
    });
  });

  app.get("/scenario-groups/:id", { preHandler: requirePermission("case.read") }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({ runs: await loadGroup(tx, id) }));
  });

  /** All scenario comparisons in the institution (Scenarios & Foresight module). */
  app.get("/scenarios", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      groups: (await tx.query(
        `SELECT r.group_id, c.case_key, c.title, min(r.created_at) AS created_at, count(*)::int AS variants, min(r.created_by_label) AS by,
                max((r.resilience->>'score')::float) FILTER (WHERE r.variant = 'baseline') AS baseline_resilience
           FROM scenario_runs r JOIN cases c ON c.id = r.case_id GROUP BY r.group_id, c.case_key, c.title ORDER BY 4 DESC LIMIT 50`)).rows,
    }));
  });

  /** Recomputes a stored run from its saved input and compares (FR-43, TR-035). */
  app.post("/scenario-runs/:id/replay", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const run = (await tx.query("SELECT id, case_id, payload, input_hash, model_version FROM scenario_runs WHERE id = $1", [id])).rows[0];
      if (!run) return reply.code(404).send({ error: "not_found", message: "No such scenario run." });
      const stored = (await tx.query("SELECT key, horizon, value, p10, p90 FROM scenario_results WHERE run_id = $1", [id])).rows;
      const r = await engine<EngineResult>("/scenarios/run", run.payload);
      const diffs = stored.filter((s) => {
        const x = r.results.find((y) => y.key === s.key && y.horizon === s.horizon);
        return !x || Math.abs(x.value - s.value) > 1e-6 || (s.p10 !== null && Math.abs((x.p10 ?? 0) - s.p10) > 1e-6);
      }).map((s) => `${s.key}@${s.horizon}`);
      const result = { identical: diffs.length === 0 && r.input_hash === run.input_hash, inputHashMatches: r.input_hash === run.input_hash, modelVersion: { stored: run.model_version, now: r.model_version }, checked: stored.length, differences: diffs };
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "scenario.replayed", resourceType: "scenario_run", resourceId: id, caseId: run.case_id, details: { identical: result.identical, differences: diffs.length } });
      return result;
    });
  });

  /** Lineage for one scenario number: formula, facts (each with its own lineage) and assumptions (TR-038, AC-03). */
  app.get("/scenario-results/:id/lineage", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const r = (await tx.query("SELECT sr.*, run.name AS run_name, run.variant, run.model_version, run.input_hash, run.monte_carlo_runs, run.created_at AS run_at, run.created_by_label, run.graph_snapshot_id FROM scenario_results sr JOIN scenario_runs run ON run.id = sr.run_id WHERE sr.id = $1", [id])).rows[0];
      if (!r) return undefined;
      return {
        result: r,
        facts: (await tx.query(`SELECT f.id, f.subject_label, f.predicate_label, f.value_num, f.unit, f.period, f.claim_class, s.name AS source_name FROM scenario_result_inputs i JOIN evidence_facts f ON f.id = i.fact_id JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id WHERE i.result_id = $1`, [id])).rows,
        assumptions: (await tx.query("SELECT a.key, a.label, a.kind, a.value_num, a.unit, a.basis FROM scenario_result_inputs i JOIN scenario_assumptions a ON a.id = i.assumption_id WHERE i.result_id = $1 ORDER BY a.kind, a.label", [id])).rows,
      };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such scenario result." });
  });
}
