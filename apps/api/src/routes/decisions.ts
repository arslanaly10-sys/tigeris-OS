import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../db";
import { appendAudit, canonical, verifyChain } from "../audit";
import { requirePermission, type Principal } from "../session";
import { approveDecision, decisionDrift, recordDecision, replayDecision, updateHandoff } from "../workflow/decisions";
import { activePolicy, brief, decide } from "../policy/store";
import { approvalFor, compile, evaluate, runTests, ACTIONS } from "../policy/engine";
import { draftEntry, embed, EMBED_MODEL, precedentText, searchMemory, vecLiteral } from "../memory/memory";

const actorOf = (p: Principal) => ({ id: p.principalId, label: p.displayName, role: p.role });
const uuid = z.object({ id: z.string().uuid() });
const caseKey = z.object({ key: z.string().max(40) });

export async function decisionRoutes(app: FastifyInstance) {
  // ---------------- decisions ----------------
  app.get("/cases/:key/decision", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = caseKey.parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, state, created_by FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      const decisions = (await tx.query("SELECT id, recommendation_id, option_key, option_title, outcome, status, rationale, required_approvals, approval_roles, approval_rule, policy_hash, policy_trace, snapshot_hash, proposed_by, proposed_by_label, proposed_by_role, created_at, finalised_at, (SELECT version FROM policy_versions v WHERE v.id = d.policy_version_id) AS policy_version FROM decisions d WHERE case_id = $1 ORDER BY created_at DESC", [c.id])).rows;
      for (const x of decisions) x.approvals = (await tx.query("SELECT approver_label, approver_role, vote, rationale, created_at FROM decision_approvals WHERE decision_id = $1 ORDER BY created_at", [x.id])).rows;
      const handoffs = (await tx.query("SELECT id, decision_id, title, description, owner_role, due_at, status, updated_at FROM handoffs WHERE case_id = $1 ORDER BY created_at", [c.id])).rows;
      for (const h of handoffs) h.updates = (await tx.query("SELECT status, note, actor_label, actor_role, created_at FROM handoff_updates WHERE handoff_id = $1 ORDER BY created_at", [h.id])).rows;
      const run = (await tx.query("SELECT id, requested_by FROM agent_runs WHERE case_id = $1 AND kind = 'case_analysis' AND status = 'completed' ORDER BY started_at DESC LIMIT 1", [c.id])).rows[0];
      const active = await activePolicy(tx);
      const options = run ? (await tx.query(
        `SELECT r.id, r.title, r.option_key, r.authority, r.governance->>'result' AS governance, r.base_score,
                coalesce((SELECT to_band FROM confidence_adjustments a WHERE a.target_type = 'recommendation' AND a.target_id = r.id ORDER BY created_at DESC LIMIT 1), r.confidence->>'band') AS band
           FROM recommendations r WHERE r.run_id = $1 ORDER BY r.base_score DESC`, [run.id])).rows.map((o) => {
        const ctx = { actor: { id: p.principalId, role: p.role }, outcome: "approve", rationale: { length: 100 }, case: { state: c.state, created_by: c.created_by }, recommendation: { option_key: o.option_key, authority: o.authority, governance: o.governance, confidence_band: o.band, drafted_by: run.requested_by } };
        const e = evaluate(active.policy, "decision.record", ctx, { hash: active.hash, version: active.version });
        return { ...o, approval: approvalFor(active.policy, ctx), preview: { result: e.result, explanation: e.explanation, rule: e.rule } };
      }) : [];
      return { state: c.state, decisions, handoffs, options, policy: { version: active.version, hash: active.hash.slice(0, 16) } };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such case." });
  });

  app.post("/cases/:key/decisions", { preHandler: requirePermission("decision.approve") }, async (req, reply) => {
    const { key } = caseKey.parse(req.params);
    const b = z.object({ recommendationId: z.string().uuid(), outcome: z.enum(["approve", "reject", "defer"]), rationale: z.string().max(2000) }).parse(req.body);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => recordDecision(tx, p.institutionId, actorOf(p), key, b));
    if (r.status !== 200) return reply.code(r.status).send({ error: r.status === 404 ? "not_found" : r.status === 403 ? "block" : "hold", message: r.message, policy: "policy" in r ? r.policy : undefined });
    return r;
  });

  app.post("/decisions/:id/approvals", { preHandler: requirePermission("decision.approve") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const b = z.object({ vote: z.enum(["approve", "reject"]), rationale: z.string().min(1).max(2000) }).parse(req.body);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => approveDecision(tx, p.institutionId, actorOf(p), id, b));
    if (r.status !== 200) return reply.code(r.status).send({ error: r.status === 404 ? "not_found" : "refused", message: r.message, policy: "policy" in r ? r.policy : undefined });
    return r;
  });

  app.post("/handoffs/:id/updates", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const b = z.object({ status: z.enum(["open", "in_progress", "done", "blocked"]), note: z.string().max(1000) }).parse(req.body);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => updateHandoff(tx, p.institutionId, actorOf(p), id, b));
    if (r.status !== 200) return reply.code(r.status).send({ error: r.status === 404 ? "not_found" : "refused", message: r.message, policy: "policy" in r ? r.policy : undefined });
    return r;
  });

  app.get("/decisions/:id/drift", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => decisionDrift(tx, id));
    return r ?? reply.code(404).send({ error: "not_found", message: "No such decision." });
  });

  app.post("/decisions/:id/replay", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, async (tx) => {
      const out = await replayDecision(tx, id, () => verifyChain(tx, p.institutionId));
      if (out) await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "decision.replayed", resourceType: "decision", resourceId: id, details: { identical: out.identical, failed: out.checks.filter((c) => !c.ok).map((c) => c.check) } });
      return out;
    });
    return r ?? reply.code(404).send({ error: "not_found", message: "No such decision." });
  });

  /** Decisions across the institution with their drift status, for Decision Authority. */
  app.get("/decisions", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      decisions: (await tx.query(
        `SELECT d.id, d.option_title, d.outcome, d.status, d.required_approvals, d.proposed_by_label, d.created_at, d.finalised_at, c.case_key, c.title AS case_title,
                (SELECT count(*)::int FROM decision_approvals a WHERE a.decision_id = d.id AND a.vote = 'approve') AS approvals,
                (SELECT count(*)::int FROM handoffs h WHERE h.decision_id = d.id AND h.status <> 'done') AS open_handoffs,
                (SELECT version FROM policy_versions v WHERE v.id = d.policy_version_id) AS policy_version
           FROM decisions d JOIN cases c ON c.id = d.case_id ORDER BY d.created_at DESC LIMIT 50`)).rows,
    }));
  });

  // ---------------- policy editor ----------------
  app.get("/policy", { preHandler: requirePermission("policy.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      versions: (await tx.query("SELECT id, version, status, note, tests_passed, test_results, content_hash, created_by_label, created_at, activated_by_label, activated_at, jsonb_array_length(compiled->'rules') AS rules FROM policy_versions ORDER BY version DESC")).rows,
      active: (await tx.query("SELECT id, version, source, compiled, content_hash, test_results FROM policy_versions WHERE status = 'active'")).rows[0],
      actions: ACTIONS,
    }));
  });

  app.get("/policy/versions/:id", { preHandler: requirePermission("policy.read") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const p = req.principal!;
    const v = await withTenant(p.institutionId, (tx) => tx.query("SELECT * FROM policy_versions WHERE id = $1", [id]).then((r) => r.rows[0]));
    return v ?? reply.code(404).send({ error: "not_found", message: "No such policy version." });
  });

  /** Compile and test without saving: the editor calls this as the administrator types. */
  app.post("/policy/validate", { preHandler: requirePermission("policy.read") }, async (req) => {
    const { source } = z.object({ source: z.string().max(100_000) }).parse(req.body);
    const c = compile(source);
    return { ok: c.ok, errors: c.errors, hash: c.hash, rules: c.policy?.rules.length ?? 0, tests: c.policy ? runTests(c.policy, c.hash) : [] };
  });

  /** Try the active policy (or a draft) against a hand-written context. */
  app.post("/policy/evaluate", { preHandler: requirePermission("policy.read") }, async (req, reply) => {
    const b = z.object({ action: z.enum(ACTIONS), context: z.record(z.string(), z.unknown()), source: z.string().max(100_000).optional() }).parse(req.body);
    const p = req.principal!;
    if (b.source) {
      const c = compile(b.source);
      if (!c.ok) return reply.code(400).send({ error: "invalid_policy", message: c.errors.join("; ") });
      return evaluate(c.policy!, b.action, b.context, { hash: c.hash, version: null });
    }
    return withTenant(p.institutionId, (tx) => decide(tx, b.action, b.context));
  });

  app.post("/policy/drafts", { preHandler: requirePermission("policy.edit") }, async (req, reply) => {
    const b = z.object({ source: z.string().max(100_000), note: z.string().min(3).max(300) }).parse(req.body);
    const p = req.principal!;
    const c = compile(b.source);
    if (!c.ok) return reply.code(400).send({ error: "invalid_policy", message: "The policy does not compile.", errors: c.errors });
    const tests = runTests(c.policy!, c.hash);
    return withTenant(p.institutionId, async (tx) => {
      const v = (await tx.query("SELECT coalesce(max(version),0)::int + 1 AS v FROM policy_versions")).rows[0].v;
      const r = await tx.query<{ id: string }>("INSERT INTO policy_versions (institution_id, version, status, source, compiled, test_results, tests_passed, content_hash, note, created_by_label) VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9) RETURNING id",
        [p.institutionId, v, b.source, JSON.stringify(c.policy), JSON.stringify(tests), tests.every((t) => t.pass), c.hash, b.note, p.displayName]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "policy.draft_saved", resourceType: "policy_version", resourceId: r.rows[0]!.id, details: { version: v, hash: c.hash, rules: c.policy!.rules.length, testsPassed: tests.filter((t) => t.pass).length, tests: tests.length } });
      return { id: r.rows[0]!.id, version: v, tests };
    });
  });

  /** Activation needs every test to pass; the previous version is retired, never deleted. */
  app.post("/policy/versions/:id/activate", { preHandler: requirePermission("policy.edit") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { reason } = z.object({ reason: z.string().min(5).max(500) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const v = (await tx.query("SELECT * FROM policy_versions WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (!v) return reply.code(404).send({ error: "not_found", message: "No such policy version." });
      if (v.status !== "draft") return reply.code(409).send({ error: "conflict", message: `Version ${v.version} is ${v.status}; only a draft can be activated.` });
      const c = compile(v.source);
      const tests = c.policy ? runTests(c.policy, c.hash) : [];
      if (!c.ok || !tests.every((t) => t.pass)) {
        await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "policy.activation_refused", resourceType: "policy_version", resourceId: id, details: { version: v.version, failing: tests.filter((t) => !t.pass).map((t) => t.name), errors: c.errors } });
        return reply.code(409).send({ error: "tests_failed", message: "Every policy test must pass before activation.", tests });
      }
      const prev = (await tx.query("SELECT id, version, compiled FROM policy_versions WHERE status = 'active'")).rows[0];
      await tx.query("UPDATE policy_versions SET status = 'retired' WHERE status = 'active'");
      await tx.query("UPDATE policy_versions SET status = 'active', activated_by_label = $2, activated_at = now(), test_results = $3, tests_passed = true WHERE id = $1", [id, p.displayName, JSON.stringify(tests)]);
      const before = new Map<string, string>((prev?.compiled.rules ?? []).map((r: { id: string }) => [r.id, canonical(r)]));
      const after = new Map<string, string>(c.policy!.rules.map((r) => [r.id, canonical(r)]));
      const diff = { added: [...after.keys()].filter((k) => !before.has(k)), removed: [...before.keys()].filter((k) => !after.has(k)), changed: [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k)) };
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "policy.activated", resourceType: "policy_version", resourceId: id, details: { version: v.version, previous: prev?.version ?? null, hash: v.content_hash, reason, ...diff } });
      return { version: v.version, previous: prev?.version ?? null, ...diff };
    });
  });

  // ---------------- institutional memory ----------------
  app.get("/memory/search", { preHandler: requirePermission("case.read") }, async (req) => {
    const q = z.object({ q: z.string().min(2).max(300), domain: z.string().max(40).optional() }).parse(req.query);
    const p = req.principal!;
    return withTenant(p.institutionId, (tx) => searchMemory(tx, q.q, { domain: q.domain, limit: 12 }));
  });

  app.get("/memory", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      stats: (await tx.query("SELECT domain, claim_class, count(*)::int AS n FROM precedents WHERE status = 'approved' GROUP BY domain, claim_class ORDER BY domain")).rows,
      proposed: (await tx.query("SELECT p.id, p.title, p.summary, p.outcome, p.lessons, p.domain, p.proposed_by_label, p.created_at, c.case_key FROM precedents p LEFT JOIN cases c ON c.id = p.case_id WHERE p.status = 'proposed' ORDER BY p.created_at DESC")).rows,
      recent: (await tx.query("SELECT p.id, p.title, p.domain, p.period, p.claim_class, p.approved_by_label, p.approved_at, c.case_key FROM precedents p LEFT JOIN cases c ON c.id = p.case_id WHERE p.status = 'approved' AND p.case_id IS NOT NULL ORDER BY p.approved_at DESC LIMIT 10")).rows,
      embeddings: { model: EMBED_MODEL, embedded: (await tx.query("SELECT count(*)::int AS n FROM precedents WHERE embedding IS NOT NULL")).rows[0].n },
    }));
  });

  app.get("/memory/:id", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, (tx) => tx.query("SELECT p.id, p.key, p.title, p.summary, p.domain, p.event_type, p.region, p.period, p.outcome, p.lessons, p.tags, p.claim_class, p.source_label, p.status, p.proposed_by_label, p.approved_by_label, p.approved_at, p.embedding_model, c.case_key FROM precedents p LEFT JOIN cases c ON c.id = p.case_id WHERE p.id = $1", [id]).then((x) => x.rows[0]));
    return r ?? reply.code(404).send({ error: "not_found", message: "No such precedent." });
  });

  app.get("/cases/:key/precedents", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = caseKey.parse(req.params);
    const p = req.principal!;
    const r = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, title, objective, situation FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      return { ...(await searchMemory(tx, `${c.title}. ${c.objective} ${c.situation}`.slice(0, 600), { limit: 5, excludeCaseId: c.id })), draft: await draftEntry(tx, c.id) };
    });
    return r ?? reply.code(404).send({ error: "not_found", message: "No such case." });
  });

  app.post("/cases/:key/memory", { preHandler: requirePermission("case.edit") }, async (req, reply) => {
    const { key } = caseKey.parse(req.params);
    const b = z.object({ title: z.string().min(5).max(200), summary: z.string().min(20).max(4000), outcome: z.string().min(3).max(2000), lessons: z.array(z.string().min(3).max(500)).min(1).max(6) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, case_key, domain FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return reply.code(404).send({ error: "not_found", message: "No such case." });
      const d = (await tx.query("SELECT id FROM decisions WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1", [c.id])).rows[0];
      const n = (await tx.query("SELECT count(*)::int AS n FROM precedents WHERE case_id = $1", [c.id])).rows[0].n;
      const r = await tx.query<{ id: string }>(
        `INSERT INTO precedents (institution_id, key, title, summary, domain, event_type, region, period, outcome, lessons, tags, claim_class, source_label, case_id, decision_id, status, proposed_by, proposed_by_label)
         VALUES ($1,$2,$3,$4,$5,'case_record','Institution',$6,$7,$8,$9,'observed',$10,$11,$12,'proposed',$13,$14) RETURNING id`,
        [p.institutionId, `case:${c.case_key}:${n + 1}`, b.title, b.summary, c.domain, String(new Date().getFullYear()), b.outcome, b.lessons, [c.domain, c.case_key], `Approved record of case ${c.case_key}`, c.id, d?.id ?? null, p.principalId, p.displayName]);
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'memory_proposed',$3,$4,$5,$6)", [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ precedentId: r.rows[0]!.id, label: "Memory entry proposed" })]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "memory.proposed", resourceType: "precedent", resourceId: r.rows[0]!.id, caseId: c.id, details: { title: b.title } });
      return { id: r.rows[0]!.id };
    });
  });

  app.post("/memory/:id/review", { preHandler: requirePermission("decision.approve") }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const b = z.object({ approve: z.boolean(), reason: z.string().min(3).max(500) }).parse(req.body);
    const p = req.principal!;
    const row = await withTenant(p.institutionId, (tx) => tx.query("SELECT * FROM precedents WHERE id = $1 AND status = 'proposed'", [id]).then((r) => r.rows[0]));
    if (!row) return reply.code(404).send({ error: "not_found", message: "No proposed memory entry with that id." });
    const v = b.approve ? await embed([precedentText(row)]) : null; // computed outside the transaction
    return withTenant(p.institutionId, async (tx) => {
      const pol = await decide(tx, "memory.approve", { actor: { id: p.principalId, role: p.role }, entry: { proposed_by: row.proposed_by } });
      if (pol.result !== "PASS") {
        await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "memory.review_refused", resourceType: "precedent", resourceId: id, caseId: row.case_id, details: { policy: brief(pol) } });
        return reply.code(pol.result === "BLOCK" ? 403 : 409).send({ error: "refused", message: pol.explanation, policy: pol });
      }
      await tx.query("UPDATE precedents SET status = $2, approved_by_label = $3, approved_at = now(), embedding = $4, embedding_model = $5 WHERE id = $1",
        [id, b.approve ? "approved" : "rejected", p.displayName, v ? vecLiteral(v[0]!) : null, v ? EMBED_MODEL : null]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: b.approve ? "memory.approved" : "memory.rejected", resourceType: "precedent", resourceId: id, caseId: row.case_id, details: { reason: b.reason, embedded: !!v, policy: brief(pol) } });
      return { status: b.approve ? "approved" : "rejected", embedded: !!v };
    });
  });
}
