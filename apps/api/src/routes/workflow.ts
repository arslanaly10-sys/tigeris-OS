import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CASE_STATES, can } from "@tigeris/shared";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { SIMULATED_EVENTS, raiseSignal } from "../workflow/signals";
import { NEXT_ACTOR, TRANSITIONS, applyTransition, nextCaseKey } from "../workflow/cases";
import { notifyPeople } from "../workflow/notify";
import { impactPaths } from "../graph/traverse";

const actorOf = (p: NonNullable<import("fastify").FastifyRequest["principal"]>) => ({ id: p.principalId, label: p.displayName, role: p.role });

export async function workflowRoutes(app: FastifyInstance) {
  // ---------- Signals ----------
  app.get("/signals", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const q = z.object({ status: z.enum(["new", "monitoring", "dismissed", "in_case"]).optional() }).parse(req.query);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      signals: (await tx.query(
        `SELECT s.*, (SELECT count(*)::int FROM signal_evidence se WHERE se.signal_id = s.id AND se.role = 'corroborating') AS corroborations,
                (SELECT json_agg(json_build_object('key', e.key, 'name', e.name, 'type', e.type)) FROM signal_entities x JOIN entities e ON e.id = x.entity_id WHERE x.signal_id = s.id) AS entities,
                (SELECT json_agg(json_build_object('caseKey', c.case_key, 'title', c.title)) FROM case_signals cs JOIN cases c ON c.id = cs.case_id WHERE cs.signal_id = s.id) AS cases
           FROM signals s WHERE ($1::text IS NULL OR s.status = $1)
          ORDER BY CASE s.urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, s.detected_at DESC LIMIT 100`, [q.status ?? null])).rows,
    }));
  });

  app.get("/signals/:id", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const s = (await tx.query("SELECT * FROM signals WHERE id = $1", [id])).rows[0];
      if (!s) return undefined;
      return {
        signal: s,
        evidence: (await tx.query(
          `SELECT se.role, se.note, se.fact_id, e.id AS evidence_id, e.title, e.validation_state, e.data_class, src.name AS source_name, f.value_text, f.value_num, f.unit
             FROM signal_evidence se LEFT JOIN evidence_objects e ON e.id = se.evidence_id LEFT JOIN sources src ON src.id = e.source_id LEFT JOIN evidence_facts f ON f.id = se.fact_id
            WHERE se.signal_id = $1 ORDER BY se.added_at`, [id])).rows,
        entities: (await tx.query("SELECT e.key, e.name, e.type, e.claim_class FROM signal_entities x JOIN entities e ON e.id = x.entity_id WHERE x.signal_id = $1", [id])).rows,
        cases: (await tx.query("SELECT c.case_key, c.title, c.state FROM case_signals cs JOIN cases c ON c.id = cs.case_id WHERE cs.signal_id = $1", [id])).rows,
      };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such signal in this institution." });
  });

  /** Corroborate is automatic from evidence; analysts monitor, dismiss or open a case, always with a rationale (FR-10). */
  app.post("/signals/:id/disposition", { preHandler: requirePermission("evidence.dispose") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const b = z.object({ action: z.enum(["monitor", "dismiss", "open_case"]), rationale: z.string().max(1000).default(""), caseTitle: z.string().max(200).optional() }).parse(req.body);
    const p = req.principal!;
    if (b.action !== "open_case" && b.rationale.trim().length < 10) return reply.code(400).send({ error: "rationale_required", message: "Add a rationale of at least 10 characters." });
    if (b.action === "open_case" && !can(p.role, "case.create")) return reply.code(403).send({ error: "forbidden", message: "Opening a case needs the Analyst role." });
    return withTenant(p.institutionId, async (tx) => {
      const s = (await tx.query("SELECT * FROM signals WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (!s) return reply.code(404).send({ error: "not_found", message: "No such signal." });
      if (b.action === "open_case") {
        const inst = (await tx.query("SELECT short_name FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
        const key = await nextCaseKey(tx, inst.short_name);
        const c = await tx.query<{ id: string }>(
          `INSERT INTO cases (institution_id, case_key, title, objective, domain, depth, state, owner_id, owner_label, created_by, created_by_label, source_signal_id, situation, why_it_matters)
           VALUES ($1,$2,$3,$4,$5,'medium','detected',$6,$7,$6,$7,$8,$9,$10) RETURNING id`,
          [p.institutionId, key, b.caseTitle ?? s.title, "Assess the signal, its exposure for this institution and the options available.", s.domain, p.principalId, p.displayName, id, s.summary, s.why_surfaced],
        );
        await tx.query("INSERT INTO case_signals (institution_id, case_id, signal_id) VALUES ($1,$2,$3)", [p.institutionId, c.rows[0]!.id, id]);
        await tx.query("INSERT INTO case_entities (institution_id, case_id, entity_id, role) SELECT $1, $2, entity_id, 'origin' FROM signal_entities WHERE signal_id = $3 ON CONFLICT DO NOTHING", [p.institutionId, c.rows[0]!.id, id]);
        await tx.query("INSERT INTO case_events (institution_id, case_id, kind, to_state, actor_id, actor_label, actor_role, rationale, payload) VALUES ($1,$2,'created','detected',$3,$4,$5,$6,$7)", [p.institutionId, c.rows[0]!.id, p.principalId, p.displayName, p.role, b.rationale || null, JSON.stringify({ fromSignal: id })]);
        await tx.query("UPDATE signals SET status = 'in_case', disposition_by = $2, disposition_note = $3 WHERE id = $1", [id, p.displayName, b.rationale || "Opened a case"]);
        await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.created", resourceType: "case", resourceId: c.rows[0]!.id, caseId: c.rows[0]!.id, details: { caseKey: key, fromSignal: id } });
        return { status: "case_opened", caseKey: key };
      }
      const status = b.action === "monitor" ? "monitoring" : "dismissed";
      await tx.query("UPDATE signals SET status = $2, disposition_by = $3, disposition_note = $4 WHERE id = $1", [id, status, p.displayName, b.rationale]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: `signal.${status}`, resourceType: "signal", resourceId: id, details: { rationale: b.rationale } });
      return { status };
    });
  });

  /** Presenter control: inject a labelled simulated event (Q050). */
  app.post("/signals/simulate", { preHandler: requirePermission("evidence.upload") }, async (req, reply) => {
    const { kind } = z.object({ kind: z.string() }).parse(req.body);
    const def = SIMULATED_EVENTS[kind];
    if (!def) return reply.code(400).send({ error: "unknown_event", message: "Unknown simulated event." });
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => raiseSignal(tx, p.institutionId, { ...def, key: `sim:${kind}:${Date.now()}`, eventTime: new Date(), dataMode: "simulated", detectedBy: "stream.simulated" }));
  });

  app.get("/signals/simulated-events", { preHandler: requirePermission("evidence.read") }, async () => ({
    events: Object.entries(SIMULATED_EVENTS).map(([kind, e]) => ({ kind, title: e.title, urgency: e.urgency })),
  }));

  /** Simulated live stream (Server-Sent Events): corridor transit counts, always labelled SIMULATED. */
  app.get("/signals/live", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    const corridors = [
      { key: "chokepoint:hormuz", name: "Strait of Hormuz", baseline: 92, unit: "tanker transits / 24 h" },
      { key: "chokepoint:bab-el-mandeb", name: "Bab el-Mandeb", baseline: 58, unit: "vessel transits / 24 h" },
      { key: "chokepoint:suez", name: "Suez Canal", baseline: 61, unit: "vessel transits / 24 h" },
    ];
    let t = 0;
    const send = () => {
      t++;
      const rows = corridors.map((c, i) => {
        const wave = Math.sin((t + i * 7) / 5) * 0.04 + Math.sin((t + i * 3) / 2.3) * 0.02;
        const dip = c.key === "chokepoint:hormuz" ? -0.23 : c.key === "chokepoint:bab-el-mandeb" ? -0.12 : 0;
        const value = Math.round(c.baseline * (1 + wave + dip));
        return { ...c, value, deltaPct: Math.round(((value - c.baseline) / c.baseline) * 1000) / 10 };
      });
      reply.raw.write(`data: ${JSON.stringify({ mode: "SIMULATED", at: new Date().toISOString(), tick: t, corridors: rows })}\n\n`);
    };
    send();
    const iv = setInterval(send, 2000);
    req.raw.on("close", () => clearInterval(iv));
  });

  // ---------- Cases ----------
  app.get("/cases", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      cases: (await tx.query(
        `SELECT c.id, c.case_key, c.title, c.domain, c.depth, c.state, c.closure, c.sensitivity, c.owner_label, c.last_activity_at, c.created_at,
                (SELECT count(*)::int FROM case_signals x WHERE x.case_id = c.id) AS signals,
                (SELECT count(*)::int FROM case_comments x WHERE x.case_id = c.id) AS comments
           FROM cases c ORDER BY (c.state = 'closed'), c.last_activity_at DESC`)).rows,
      nextActor: NEXT_ACTOR,
    }));
  });

  app.get("/cases/:key", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const p = req.principal!;
    const d = await withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT * FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return undefined;
      const origin = (await tx.query("SELECT e.key FROM case_entities ce JOIN entities e ON e.id = ce.entity_id WHERE ce.case_id = $1 AND ce.role = 'origin' ORDER BY e.type = 'chokepoint' DESC LIMIT 1", [c.id])).rows[0];
      return {
        case: c,
        transitions: TRANSITIONS[c.state as keyof typeof TRANSITIONS].map((t) => ({ to: t.to, label: t.label, roles: t.roles, needsRationale: !!t.needsRationale, allowed: t.roles.includes(p.role) })),
        nextActor: NEXT_ACTOR[c.state as keyof typeof NEXT_ACTOR],
        signals: (await tx.query("SELECT s.id, s.title, s.urgency, s.data_mode, s.confidence, s.event_time FROM case_signals cs JOIN signals s ON s.id = cs.signal_id WHERE cs.case_id = $1", [c.id])).rows,
        evidence: (await tx.query(
          `SELECT ce.note, ce.added_by_label, ce.added_at, e.id AS evidence_id, e.title, e.validation_state, e.data_class, s.name AS source_name, f.id AS fact_id, f.predicate_label, f.value_num, f.unit, f.period, f.claim_class
             FROM case_evidence ce JOIN evidence_objects e ON e.id = ce.evidence_id JOIN sources s ON s.id = e.source_id LEFT JOIN evidence_facts f ON f.id = ce.fact_id WHERE ce.case_id = $1 ORDER BY ce.added_at`, [c.id])).rows,
        entities: (await tx.query("SELECT ce.role, e.key, e.name, e.type, e.claim_class FROM case_entities ce JOIN entities e ON e.id = ce.entity_id WHERE ce.case_id = $1 ORDER BY ce.role, e.name", [c.id])).rows,
        events: (await tx.query("SELECT kind, from_state, to_state, actor_label, actor_role, rationale, payload, occurred_at FROM case_events WHERE case_id = $1 ORDER BY occurred_at", [c.id])).rows,
        comments: (await tx.query("SELECT id, author_label, author_role, body, mentions, created_at FROM case_comments WHERE case_id = $1 ORDER BY created_at", [c.id])).rows,
        linked: c.linked_case_id ? (await tx.query("SELECT case_key, title, state FROM cases WHERE id = $1", [c.linked_case_id])).rows[0] : null,
        impact: origin ? await impactPaths(tx, origin.key, { maxDepth: 3, maxNodes: 120 }) : null,
      };
    });
    return d ?? reply.code(404).send({ error: "not_found", message: "No such case in this institution." });
  });

  app.post("/cases/:key/transition", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const b = z.object({ to: z.enum(CASE_STATES), rationale: z.string().max(2000).optional() }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return reply.code(404).send({ error: "not_found", message: "No such case." });
      const r = await applyTransition(tx, p.institutionId, c.id, b.to, actorOf(p), b.rationale);
      if (r.status === 404) return reply.code(404).send({ error: "not_found", message: "No such case." });
      return r.policy.result === "PASS" ? { policy: r.policy, state: r.state } : reply.code(r.policy.result === "BLOCK" ? 403 : 409).send({ error: r.policy.result.toLowerCase(), policy: r.policy, message: r.policy.explanation });
    });
  });

  app.post("/cases/:key/comments", { preHandler: requirePermission("case.comment") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const b = z.object({ body: z.string().min(1).max(4000), mentions: z.array(z.string().uuid()).max(10).default([]) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id, case_key, title FROM cases WHERE case_key = $1", [key])).rows[0];
      if (!c) return reply.code(404).send({ error: "not_found", message: "No such case." });
      // Mentions must be people in this institution; anything else is dropped (RLS hides other institutions).
      const valid = (await tx.query("SELECT id FROM principals WHERE id = ANY($1)", [b.mentions])).rows.map((r) => r.id as string);
      const r = await tx.query<{ id: string }>("INSERT INTO case_comments (institution_id, case_id, author_id, author_label, author_role, body, mentions) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [p.institutionId, c.id, p.principalId, p.displayName, p.role, b.body, valid]);
      await tx.query("UPDATE cases SET last_activity_at = now() WHERE id = $1", [c.id]);
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'comment',$3,$4,$5,$6)", [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ commentId: r.rows[0]!.id, mentions: valid.length })]);
      await notifyPeople(tx, p.institutionId, valid.filter((x) => x !== p.principalId), { kind: "mention", title: `${p.displayName} mentioned you on ${c.case_key}`, body: b.body.slice(0, 200), link: `/cases/${c.case_key}` });
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.commented", resourceType: "case", resourceId: c.id, caseId: c.id, details: { mentions: valid.length } });
      return { id: r.rows[0]!.id, mentions: valid.length };
    });
  });

  app.post("/cases/:key/evidence", { preHandler: requirePermission("case.edit") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const b = z.object({ evidenceId: z.string().uuid(), factId: z.string().uuid().optional(), note: z.string().max(500).optional() }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const c = (await tx.query("SELECT id FROM cases WHERE case_key = $1", [key])).rows[0];
      const e = (await tx.query("SELECT id, validation_state FROM evidence_objects WHERE id = $1", [b.evidenceId])).rows[0];
      if (!c || !e) return reply.code(404).send({ error: "not_found", message: "Case or evidence not found." });
      if (!["accepted", "warning"].includes(e.validation_state)) return reply.code(409).send({ error: "hold", message: "Quarantined or rejected evidence cannot be attached to a case." });
      await tx.query("INSERT INTO case_evidence (institution_id, case_id, evidence_id, fact_id, note, added_by_label) VALUES ($1,$2,$3,$4,$5,$6)", [p.institutionId, c.id, b.evidenceId, b.factId ?? null, b.note ?? null, p.displayName]);
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'evidence_attached',$3,$4,$5,$6)", [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify(b)]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.evidence_attached", resourceType: "case", resourceId: c.id, caseId: c.id, details: { evidenceId: b.evidenceId } });
      return { status: "attached" };
    });
  });

  // ---------- Search, notifications, domains, attention ----------
  app.get("/search", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const { q } = z.object({ q: z.string().min(2).max(100) }).parse(req.query);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      signals: (await tx.query("SELECT id, title, urgency, data_mode FROM signals WHERE title ILIKE '%' || $1 || '%' OR summary ILIKE '%' || $1 || '%' ORDER BY detected_at DESC LIMIT 6", [q])).rows,
      cases: (await tx.query("SELECT case_key, title, state FROM cases WHERE search @@ plainto_tsquery('simple', $1) OR title ILIKE '%' || $1 || '%' ORDER BY last_activity_at DESC LIMIT 6", [q])).rows,
      entities: (await tx.query("SELECT key, name, type, claim_class FROM entities WHERE name ILIKE '%' || $1 || '%' ORDER BY (type = 'vessel'), length(name) LIMIT 8", [q])).rows,
      evidence: (await tx.query("SELECT id, title, validation_state FROM evidence_objects WHERE title ILIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT 5", [q])).rows,
      memory: [],
    }));
  });

  app.get("/notifications", { preHandler: requirePermission() }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      notifications: (await tx.query("SELECT id, kind, title, body, link, created_at, read_at FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 30", [p.principalId])).rows,
      unread: (await tx.query("SELECT count(*)::int AS n FROM notifications WHERE recipient_id = $1 AND read_at IS NULL", [p.principalId])).rows[0].n,
    }));
  });

  app.post("/notifications/read", { preHandler: requirePermission() }, async (req) => {
    const p = req.principal!;
    await withTenant(p.institutionId, (tx) => tx.query("UPDATE notifications SET read_at = now() WHERE recipient_id = $1 AND read_at IS NULL", [p.principalId]));
    return { status: "read" };
  });

  app.get("/domains", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      domains: (await tx.query(
        `SELECT d.*, (SELECT count(*)::int FROM entities e WHERE d.key = ANY(e.domain_keys)) AS entities,
                (SELECT count(*)::int FROM cases c WHERE c.domain = d.key) AS cases
           FROM domain_packs d ORDER BY d.priority`)).rows,
    }));
  });

  /** Command Centre attention queue: what needs this person now, and why (UX §8). */
  app.get("/attention", { preHandler: requirePermission() }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const items: Array<{ kind: string; title: string; reason: string; urgency: string; link: string; at: string; dataMode?: string }> = [];
      const signals = (await tx.query("SELECT id, title, why_surfaced, urgency, data_mode, detected_at FROM signals WHERE status = 'new' ORDER BY CASE urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, detected_at DESC LIMIT 8")).rows;
      if (can(p.role, "evidence.dispose") || p.role === "executive") for (const s of signals) items.push({ kind: "signal", title: s.title, reason: s.why_surfaced, urgency: s.urgency, link: `/signals?focus=${s.id}`, at: s.detected_at, dataMode: s.data_mode });
      const states = Object.entries(NEXT_ACTOR).filter(([, roles]) => roles.includes(p.role)).map(([s]) => s);
      const cases = (await tx.query("SELECT case_key, title, state, last_activity_at, owner_id FROM cases WHERE state = ANY($1) ORDER BY last_activity_at DESC LIMIT 10", [states])).rows;
      for (const c of cases) {
        const reason = c.state === "review" ? "Waiting for expert review" : c.state === "decision" ? "Waiting for a named decision" : c.state === "handoff" ? "Approved; follow-through and outcome needed" : c.owner_id === p.principalId ? `You own this case; it is in ${c.state}` : `Case in ${c.state}`;
        items.push({ kind: "case", title: `${c.case_key} · ${c.title}`, reason, urgency: c.state === "decision" ? "high" : "medium", link: `/cases/${c.case_key}`, at: c.last_activity_at });
      }
      if (can(p.role, "evidence.dispose")) {
        const n = (await tx.query("SELECT count(*)::int AS n FROM evidence_facts WHERE review_state = 'needs_review'")).rows[0].n;
        if (n) items.push({ kind: "review", title: `${n} extracted figures waiting for review`, reason: "Figures from uploaded documents are not used until an analyst accepts them", urgency: "low", link: "/sources", at: new Date().toISOString() });
      }
      if (can(p.role, "source.manage")) {
        const q = (await tx.query("SELECT count(*)::int AS n FROM evidence_objects WHERE validation_state IN ('quarantined','rejected')")).rows[0].n;
        if (q) items.push({ kind: "source", title: `${q} evidence records quarantined or rejected`, reason: "Source owners decide whether to correct, re-approve or remove them", urgency: "medium", link: "/sources", at: new Date().toISOString() });
        const u = (await tx.query("SELECT count(*)::int AS n FROM sources WHERE status = 'unreachable'")).rows[0].n;
        if (u) items.push({ kind: "source", title: `${u} sources unreachable at last collection`, reason: "Not used until reachable and approved", urgency: "low", link: "/sources", at: new Date().toISOString() });
      }
      const pending = (await tx.query("SELECT count(*)::int AS n FROM cases WHERE state = 'decision'")).rows[0].n;
      return { items, counts: { newSignals: signals.length, decisionsPending: pending, openCases: (await tx.query("SELECT count(*)::int AS n FROM cases WHERE state <> 'closed'")).rows[0].n } };
    });
  });
}
