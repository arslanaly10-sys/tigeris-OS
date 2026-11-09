import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEALS, FUND_DATA_LABEL, screenDeal, usd } from "@tigeris/shared";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { nextCaseKey } from "../workflow/cases";

/**
 * Fund applications. Screening, memos, monitoring and reports are deterministic and computed in @tigeris/shared
 * on synthetic data; the one server action is taking a screened deal to committee as an ordinary case, which then
 * runs the normal analysis and named-decision flow. Nothing executes.
 */
export async function fundRoutes(app: FastifyInstance) {
  app.post("/fund/deals/:key/case", { preHandler: requirePermission("case.create") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(20) }).parse(req.params);
    const deal = DEALS.find((d) => d.key === key);
    if (!deal) return reply.code(404).send({ error: "not_found", message: "No such deal." });
    const s = screenDeal(deal);
    if (s.result === "decline") return reply.code(409).send({ error: "declined", message: "This deal fails a mandate limit; it cannot go to committee without a mandate change." });
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const inst = (await tx.query("SELECT short_name FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      const caseKey = await nextCaseKey(tx, inst.short_name);
      const watch = s.criteria.filter((c) => c.verdict === "watch");
      const questions = ["What evidence confirms the growth rate beyond management's own figures?", ...watch.map((c) => `${c.label}: ${c.detail} Is this acceptable?`)];
      const c = (await tx.query<{ id: string }>(
        `INSERT INTO cases (institution_id, case_key, title, objective, domain, depth, state, owner_id, owner_label, created_by, created_by_label, situation, why_it_matters, open_questions)
         VALUES ($1,$2,$3,$4,'sovereign_capital','full','detected',$5,$6,$5,$6,$7,$8,$9) RETURNING id`,
        [p.institutionId, caseKey, `Investment committee: ${deal.name}`, `Decide whether to invest ${usd(deal.ticketUsd)} in ${deal.name} (${deal.stage}).`, p.principalId, p.displayName,
          `${deal.thesis} (${FUND_DATA_LABEL}.)`, `Screen result: ${s.result}. ${s.criteria.map((x) => `${x.label} ${x.verdict}`).join("; ")}.`, questions],
      )).rows[0]!;
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, to_state, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'created','detected',$3,$4,$5,$6)",
        [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ fromDeal: deal.key, label: `Opened from deal screening: ${deal.name}` })]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.created", resourceType: "case", resourceId: c.id, caseId: c.id, details: { caseKey, fromDeal: deal.key, screen: s.result, dataMode: "synthetic" } });
      return { status: "case_opened", caseKey };
    });
  });
}
