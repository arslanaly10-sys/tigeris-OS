import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { playbookByKey } from "@tigeris/shared";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { nextCaseKey } from "../workflow/cases";

/**
 * Sovereign playbooks: a playbook is read from @tigeris/shared; starting one opens an ordinary case, pre-filled
 * with the playbook's intent, scenario, doctrine and constraint, which then runs the normal case, scenario,
 * agent and decision flow. Nothing executes; the case starts at "detected" like any other.
 */
export async function playbookRoutes(app: FastifyInstance) {
  app.post("/playbooks/:key/case", { preHandler: requirePermission("case.create") }, async (req, reply) => {
    const { key } = z.object({ key: z.string().max(60) }).parse(req.params);
    const pb = playbookByKey(key);
    if (!pb) return reply.code(404).send({ error: "not_found", message: "No such playbook." });
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const inst = (await tx.query("SELECT short_name FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      const caseKey = await nextCaseKey(tx, inst.short_name);
      const questions = [
        `Does the governance constraint hold here? ${pb.constraint}`,
        `Recommended path or counterfactual? ${pb.recommended} / ${pb.counterfactual}`,
        `What evidence would prove the value? ${pb.validate}`,
      ];
      const c = (await tx.query<{ id: string }>(
        `INSERT INTO cases (institution_id, case_key, title, objective, domain, depth, state, owner_id, owner_label, created_by, created_by_label, situation, why_it_matters, open_questions, scenario_template)
         VALUES ($1,$2,$3,$4,$5,'full','detected',$6,$7,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [p.institutionId, caseKey, pb.title, pb.intent, pb.domain, p.principalId, p.displayName, `${pb.scenario} (Illustrative playbook scenario: confirm it against this institution's evidence before acting.)`, `${pb.doctrine} ${pb.constraint}`, questions, pb.template],
      )).rows[0]!;
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, to_state, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'created','detected',$3,$4,$5,$6)",
        [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ fromPlaybook: pb.key, label: `Opened from the "${pb.title}" playbook` })]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.created", resourceType: "case", resourceId: c.id, caseId: c.id, details: { caseKey, fromPlaybook: pb.key } });
      return { status: "case_opened", caseKey };
    });
  });
}
