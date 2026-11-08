import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant, type Tx } from "../db";
import { appendAudit } from "../audit";
import { requirePermission, type Principal } from "../session";
import { getSettings, providerStatus } from "../ai/gateway";
import { PROVIDER_KEYS, type ProviderKey } from "../ai/providers";
import { AGENTS } from "../agents/registry";
import { startCaseAnalysis } from "../agents/case-analysis";
import { askCase, askGraph } from "../agents/ask";
import { briefPdf, type BriefContent } from "../agents/brief-pdf";

const actorOf = (p: Principal) => ({ id: p.principalId, label: p.displayName, role: p.role });
const providerSchema = z.enum(PROVIDER_KEYS as [ProviderKey, ...ProviderKey[]]).optional();
const LEVELS = ["low", "medium", "high"] as const;

/** Learned adjustment from feedback on the same kind of option across the institution's cases (Q067). */
export const learnedAdjustment = (votes: number) => Math.max(-12, Math.min(12, 4 * votes));

async function rankedRecommendations(tx: Tx, runId: string) {
  const rows = (await tx.query("SELECT * FROM recommendations WHERE run_id = $1", [runId])).rows;
  const fb = (await tx.query("SELECT option_key, sum(vote)::int AS votes, count(*)::int AS n FROM recommendation_feedback GROUP BY option_key")).rows;
  const mine = (await tx.query("SELECT f.recommendation_id, f.vote, f.reason, f.actor_label, f.actor_role, f.created_at FROM recommendation_feedback f WHERE f.recommendation_id = ANY($1) ORDER BY f.created_at", [rows.map((r) => r.id)])).rows;
  const adj = (await tx.query("SELECT DISTINCT ON (target_id) target_id, from_band, to_band, reason, actor_label, actor_role, created_at FROM confidence_adjustments WHERE target_type = 'recommendation' AND target_id = ANY($1) ORDER BY target_id, created_at DESC", [rows.map((r) => r.id)])).rows;
  const byBase = [...rows].sort((a, b) => b.base_score - a.base_score).map((r) => r.id);
  const out = rows.map((r) => {
    const f = fb.find((x) => x.option_key === r.option_key);
    const learned = learnedAdjustment(f?.votes ?? 0);
    const a = adj.find((x) => x.target_id === r.id);
    return { ...r, learned: { votes: f?.votes ?? 0, entries: f?.n ?? 0, adjustment: learned }, score: Math.round((r.base_score + learned) * 10) / 10, baseRank: byBase.indexOf(r.id) + 1,
      feedback: mine.filter((m) => m.recommendation_id === r.id), confidenceAdjustment: a ?? null, effectiveBand: a?.to_band ?? r.confidence.band };
  });
  out.sort((a, b) => b.score - a.score || a.baseRank - b.baseRank);
  return out.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function aiRoutes(app: FastifyInstance) {
  /** Sovereignty status for the header badge and the Governance page. */
  app.get("/ai/status", { preHandler: requirePermission() }, async (req) => {
    const p = req.principal!;
    const s = await withTenant(p.institutionId, getSettings);
    return { settings: s, providers: await providerStatus(s) };
  });

  app.put("/ai/settings", { preHandler: requirePermission("sovereignty.control") }, async (req, reply) => {
    const b = z.object({
      foreign_models_enabled: z.boolean().optional(), outbound_allowed: z.boolean().optional(),
      allowed_providers: z.array(z.enum(PROVIDER_KEYS as [ProviderKey, ...ProviderKey[]])).optional(), default_provider: z.enum(PROVIDER_KEYS as [ProviderKey, ...ProviderKey[]]).optional(),
      foreign_max_classification: z.enum(["public", "internal", "confidential"]).optional(), reason: z.string().min(3).max(500),
    }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const before = await getSettings(tx);
      const next = { ...before, ...Object.fromEntries(Object.entries(b).filter(([k, v]) => k !== "reason" && v !== undefined)) } as typeof before;
      next.allowed_providers = [...new Set([...next.allowed_providers, "deterministic"])]; // the writer without a model can never be removed
      if (!next.allowed_providers.includes(next.default_provider)) return reply.code(400).send({ error: "invalid_request", message: "The default provider must be on the allowlist." });
      await tx.query(
        `UPDATE sovereignty_settings SET foreign_models_enabled = $1, outbound_allowed = $2, allowed_providers = $3, default_provider = $4, foreign_max_classification = $5, version = version + 1, updated_by_label = $6, updated_at = now()`,
        [next.foreign_models_enabled, next.outbound_allowed, next.allowed_providers, next.default_provider, next.foreign_max_classification, p.displayName],
      );
      const changed = (Object.keys(b) as Array<keyof typeof b>).filter((k) => k !== "reason" && JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(next[k as keyof typeof next]));
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "sovereignty.settings_changed", resourceType: "sovereignty_settings", resourceId: p.institutionId,
        details: { reason: b.reason, changed, before: Object.fromEntries(changed.map((k) => [k, before[k as keyof typeof before]])), after: Object.fromEntries(changed.map((k) => [k, next[k as keyof typeof next]])) } });
      return { settings: await getSettings(tx) };
    });
  });

  app.get("/ai/agents", { preHandler: requirePermission() }, async () => ({ agents: AGENTS }));

  /** Cost and usage panel (Q069). */
  app.get("/ai/usage", { preHandler: requirePermission("policy.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      byProvider: (await tx.query("SELECT provider, outcome, count(*)::int AS calls, sum(tokens_in)::int AS tokens_in, sum(tokens_out)::int AS tokens_out, sum(cost_usd)::float AS cost_usd, sum(latency_ms)::int AS ms FROM model_calls GROUP BY provider, outcome ORDER BY provider, outcome")).rows,
      byAgent: (await tx.query("SELECT agent_key, count(*) FILTER (WHERE outcome IN ('ok','cached'))::int AS calls, count(*) FILTER (WHERE outcome = 'blocked')::int AS blocked, sum(tokens_in + tokens_out)::int AS tokens, sum(cost_usd)::float AS cost_usd, sum(latency_ms)::int AS ms FROM model_calls GROUP BY agent_key ORDER BY 3 DESC")).rows,
      runs: (await tx.query("SELECT r.id, r.kind, r.status, r.provider_requested, r.question, r.tokens_in, r.tokens_out, r.cost_usd, r.model_calls, r.requested_by_label, r.started_at, r.finished_at, c.case_key FROM agent_runs r LEFT JOIN cases c ON c.id = r.case_id ORDER BY r.started_at DESC LIMIT 25")).rows,
      recentBlocked: (await tx.query("SELECT agent_key, provider, reason, classification, created_at FROM model_calls WHERE outcome = 'blocked' ORDER BY created_at DESC LIMIT 10")).rows,
    }));
  });

  // ---------------- case analysis ----------------
  app.post("/cases/:key/analysis", { preHandler: requirePermission("recommendation.draft") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const b = z.object({ provider: providerSchema }).parse(req.body ?? {});
    const p = req.principal!;
    const s = await withTenant(p.institutionId, getSettings);
    const r = await startCaseAnalysis(p.institutionId, actorOf(p), key, (b.provider ?? s.default_provider) as ProviderKey);
    if ("error" in r) return reply.code(r.status).send({ error: r.status === 404 ? "not_found" : "conflict", message: r.error });
    return reply.code(202).send(r);
  });

  app.get("/cases/:key/analysis", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const q = z.object({ run: z.string().uuid().optional() }).parse(req.query);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      const runs = (await tx.query("SELECT id, status, provider_requested, tokens_in, tokens_out, cost_usd, model_calls, summary, error, requested_by_label, started_at, finished_at FROM agent_runs WHERE case_id = $1 AND kind = 'case_analysis' ORDER BY started_at DESC LIMIT 10", [c.id])).rows;
      const run = q.run ? runs.find((r) => r.id === q.run) : runs[0];
      if (!run) return { runs, run: null, steps: [], calls: [] };
      return {
        runs, run,
        steps: (await tx.query("SELECT seq, agent_key, phase, title, tool_calls, sources, output, text, writer, fallback_reason, ms, created_at FROM agent_steps WHERE run_id = $1 ORDER BY seq", [run.id])).rows,
        calls: (await tx.query("SELECT step_seq, agent_key, provider, model, outcome, reason, tokens_in, tokens_out, latency_ms, cost_usd, priced, prompt_hash, classification, created_at FROM model_calls WHERE run_id = $1 ORDER BY created_at", [run.id])).rows,
      };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such case." });
  });

  app.get("/cases/:key/recommendations", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      const run = (await tx.query("SELECT id, started_at, finished_at, requested_by_label, summary FROM agent_runs WHERE case_id = $1 AND kind = 'case_analysis' AND status = 'completed' ORDER BY started_at DESC LIMIT 1", [c.id])).rows[0];
      return { run: run ?? null, recommendations: run ? await rankedRecommendations(tx, run.id) : [] };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such case." });
  });

  app.post("/recommendations/:id/feedback", { preHandler: requirePermission("case.comment") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = z.object({ vote: z.union([z.literal(1), z.literal(-1)]), reason: z.string().min(3).max(500) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const r = (await tx.query("SELECT id, option_key, case_id, run_id FROM recommendations WHERE id = $1", [id])).rows[0];
      if (!r) return reply.code(404).send({ error: "not_found", message: "No such recommendation." });
      const before = (await rankedRecommendations(tx, r.run_id)).find((x) => x.id === id)!.rank;
      await tx.query("INSERT INTO recommendation_feedback (institution_id, recommendation_id, option_key, vote, reason, actor_id, actor_label, actor_role) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [p.institutionId, id, r.option_key, b.vote, b.reason, p.principalId, p.displayName, p.role]);
      const after = (await rankedRecommendations(tx, r.run_id)).find((x) => x.id === id)!.rank;
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "recommendation.feedback", resourceType: "recommendation", resourceId: id, caseId: r.case_id, details: { vote: b.vote, optionKey: r.option_key, rankBefore: before, rankAfter: after } });
      return { rankBefore: before, rankAfter: after };
    });
  });

  /** Expert confidence adjustment: the original band is kept; the change and its reason are recorded (Q065). */
  app.post("/confidence-adjustments", { preHandler: requirePermission("evidence.dispose") }, async (req, reply) => {
    const b = z.object({ targetType: z.enum(["signal", "recommendation"]), targetId: z.string().uuid(), toBand: z.enum(LEVELS), reason: z.string().min(5).max(500) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const t = b.targetType === "signal"
        ? (await tx.query("SELECT id, confidence->>'band' AS band, NULL::uuid AS case_id FROM signals WHERE id = $1", [b.targetId])).rows[0]
        : (await tx.query("SELECT id, confidence->>'band' AS band, case_id FROM recommendations WHERE id = $1", [b.targetId])).rows[0];
      if (!t) return reply.code(404).send({ error: "not_found", message: "Nothing to adjust." });
      const last = (await tx.query("SELECT to_band FROM confidence_adjustments WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC LIMIT 1", [b.targetType, b.targetId])).rows[0];
      const from = last?.to_band ?? t.band ?? "low";
      if (from === b.toBand) return reply.code(400).send({ error: "invalid_request", message: `Confidence is already ${from}.` });
      await tx.query("INSERT INTO confidence_adjustments (institution_id, target_type, target_id, from_band, to_band, reason, actor_id, actor_label, actor_role) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [p.institutionId, b.targetType, b.targetId, from, b.toBand, b.reason, p.principalId, p.displayName, p.role]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "confidence.adjusted", resourceType: b.targetType, resourceId: b.targetId, caseId: t.case_id, details: { from, to: b.toBand, reason: b.reason } });
      return { from, to: b.toBand };
    });
  });

  // ---------------- Ask TIGERIS and graph questions ----------------
  app.post("/cases/:key/ask", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const b = z.object({ question: z.string().min(3).max(500), provider: providerSchema }).parse(req.body);
    const p = req.principal!;
    const s = await withTenant(p.institutionId, getSettings);
    const r = await askCase(p.institutionId, actorOf(p), key, b.question, (b.provider ?? s.default_provider) as ProviderKey);
    if (r.status === 404) return reply.code(404).send({ error: "not_found", message: "No such case." });
    return r;
  });

  app.get("/cases/:key/ask", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      return { history: (await tx.query(
        `SELECT r.id, r.question, r.requested_by_label, r.started_at, r.summary, s.text, s.sources, s.writer, s.fallback_reason FROM agent_runs r JOIN agent_steps s ON s.run_id = r.id
          WHERE r.case_id = $1 AND r.kind = 'ask' ORDER BY r.started_at DESC LIMIT 20`, [c.id])).rows };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such case." });
  });

  app.post("/graph/ask", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const b = z.object({ question: z.string().min(3).max(300), provider: providerSchema }).parse(req.body);
    const p = req.principal!;
    const s = await withTenant(p.institutionId, getSettings);
    return askGraph(p.institutionId, actorOf(p), b.question, (b.provider ?? s.default_provider) as ProviderKey);
  });

  // ---------------- executive brief ----------------
  app.get("/cases/:key/brief", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      return { brief: (await tx.query("SELECT id, version, content, content_hash, created_by_label, created_at, run_id FROM case_briefs WHERE case_id = $1 ORDER BY version DESC LIMIT 1", [c.id])).rows[0] ?? null };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such case." });
  });

  app.get("/cases/:key/brief.pdf", { preHandler: requirePermission("export.create") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, case_key FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      const b = (await tx.query("SELECT id, version, content, content_hash, created_at, run_id FROM case_briefs WHERE case_id = $1 ORDER BY version DESC LIMIT 1", [c.id])).rows[0];
      if (!b) return null;
      const options = (await rankedRecommendations(tx, b.run_id)).map((r) => ({ title: r.title, score: r.score, band: r.effectiveBand, policy: r.governance.result, authority: r.authority }));
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "export.created", resourceType: "case_brief", resourceId: b.id, caseId: c.id, details: { format: "pdf", version: b.version, contentHash: b.content_hash, classification: (b.content as BriefContent).classification } });
      return { c, b, options };
    });
    if (d === undefined) return reply.code(404).send({ error: "not_found", message: "No such case." });
    if (d === null) return reply.code(404).send({ error: "not_found", message: "No brief yet. Run the agent analysis first." });
    const bytes = await briefPdf(d.b.content as BriefContent, { caseKey: d.c.case_key, version: d.b.version, createdAt: new Date(d.b.created_at).toISOString(), hash: d.b.content_hash, options: d.options });
    return reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="${d.c.case_key}-brief-v${d.b.version}.pdf"`).send(Buffer.from(bytes));
  });
}
