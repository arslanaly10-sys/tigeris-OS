import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isIndustry } from "@tigeris/shared";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { nextCaseKey } from "../workflow/cases";

/**
 * Sector Command Centres (Command Centres brief, phase 2): what this institution holds for one sector, read through
 * withTenant, and "start a case" from a Command Centre card. Every item carries its own link and data mode
 * (observed, simulated or synthetic); counts are row counts, not estimates. Opening a case executes nothing.
 */
const industryParam = z.object({ industry: z.string().max(40).refine(isIndustry, "Unknown sector") });

export async function sectorRoutes(app: FastifyInstance) {
  app.get("/sectors/:industry", { preHandler: requirePermission("case.read") }, async (req) => {
    const { industry } = industryParam.parse(req.params);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const cases = (await tx.query(
        `SELECT case_key, title, objective, state, owner_label, last_activity_at FROM cases
          WHERE domain = $1 AND state <> 'closed' ORDER BY last_activity_at DESC LIMIT 8`, [industry])).rows;
      const review = (await tx.query(
        `SELECT case_key, title, state, owner_label, last_activity_at FROM cases
          WHERE domain = $1 AND state IN ('review','decision') ORDER BY last_activity_at DESC LIMIT 6`, [industry])).rows;
      const signals = (await tx.query(
        `SELECT id, title, urgency, data_mode, status, why_surfaced, detected_at FROM signals
          WHERE domain = $1 AND status <> 'dismissed'
          ORDER BY (status = 'new') DESC, CASE urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, detected_at DESC LIMIT 6`, [industry])).rows;
      const c = (await tx.query(
        `SELECT count(*) FILTER (WHERE state <> 'closed')::int AS open, count(*) FILTER (WHERE state = 'review')::int AS review,
                count(*) FILTER (WHERE state = 'decision')::int AS decision, count(*) FILTER (WHERE state = 'handoff')::int AS approved,
                count(*) FILTER (WHERE state = 'closed')::int AS closed, max(last_activity_at) AS last_case
           FROM cases WHERE domain = $1`, [industry])).rows[0];
      const sg = (await tx.query(
        `SELECT count(*) FILTER (WHERE status = 'new')::int AS new, count(*)::int AS total, max(detected_at) AS last_signal
           FROM signals WHERE domain = $1 AND status <> 'dismissed'`, [industry])).rows[0];
      const last = [c.last_case, sg.last_signal].filter(Boolean).sort().at(-1) ?? null;
      return {
        industry, cases, review, signals,
        counts: { openCases: c.open, inReview: c.review, awaitingDecision: c.decision, approved: c.approved, closed: c.closed, newSignals: sg.new, signals: sg.total },
        lastUpdated: last,
      };
    });
  });

  app.post("/sectors/:industry/cases", { preHandler: requirePermission("case.create") }, async (req) => {
    const { industry } = industryParam.parse(req.params);
    const body = z.object({ title: z.string().min(3).max(200), objective: z.string().max(600).optional(), card: z.string().max(80) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const inst = (await tx.query("SELECT short_name FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      const caseKey = await nextCaseKey(tx, inst.short_name);
      const objective = body.objective ?? body.title;
      const c = (await tx.query<{ id: string }>(
        `INSERT INTO cases (institution_id, case_key, title, objective, domain, depth, state, owner_id, owner_label, created_by, created_by_label, situation, why_it_matters, open_questions)
         VALUES ($1,$2,$3,$4,$5,'full','detected',$6,$7,$6,$7,$8,$9,$10) RETURNING id`,
        [p.institutionId, caseKey, body.title, objective, industry, p.principalId, p.displayName,
          `Opened from the ${body.card} card of the sector Command Centre. No evidence is attached yet.`,
          "Raised by a named person from the sector Command Centre; it needs evidence before any analysis or decision.",
          ["Which authorised sources hold the evidence for this?", "Who owns the response if it is confirmed?"]],
      )).rows[0]!;
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, to_state, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'created','detected',$3,$4,$5,$6)",
        [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ fromCommandCentre: industry, card: body.card, label: `Opened from the ${body.card} card of the sector Command Centre` })]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.created", resourceType: "case", resourceId: c.id, caseId: c.id, details: { caseKey, fromCommandCentre: industry, card: body.card } });
      return { status: "case_opened", caseKey };
    });
  });
}
