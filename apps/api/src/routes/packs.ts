import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { nextCaseKey } from "../workflow/cases";

/**
 * Sovereign OS Packs (docs/research/brain-co.md §4): open a worked-queue item as a case. The pack's rule
 * verdict travels with it as context; nothing is decided here; the case starts at "detected" with a named owner.
 */
const PACK_DOMAIN = { finance: "banking", health: "healthcare", insurance: "insurance", government: "public_sector" } as const;

export async function packsRoutes(app: FastifyInstance) {
  app.post("/packs/:pack/cases", { preHandler: requirePermission("case.create") }, async (req) => {
    const { pack } = z.object({ pack: z.enum(["finance", "health", "insurance", "government"]) }).parse(req.params);
    const body = z.object({ itemId: z.string().regex(/^[A-Z]{3}-\d{3}$/), title: z.string().min(3).max(200), workflow: z.string().min(3).max(120), verdict: z.string().max(60), failed: z.array(z.string().max(120)).max(10) }).parse(req.body);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const inst = (await tx.query("SELECT short_name FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      const caseKey = await nextCaseKey(tx, inst.short_name);
      const title = `${body.itemId} · ${body.title}`;
      const c = (await tx.query<{ id: string }>(
        `INSERT INTO cases (institution_id, case_key, title, objective, domain, depth, state, owner_id, owner_label, created_by, created_by_label, situation, why_it_matters, open_questions)
         VALUES ($1,$2,$3,$4,$5,'full','detected',$6,$7,$6,$7,$8,$9,$10) RETURNING id`,
        [p.institutionId, caseKey, title, `Decide ${body.itemId} in ${body.workflow}.`, PACK_DOMAIN[pack], p.principalId, p.displayName,
          `Opened from the ${body.workflow} queue of the Sovereign OS ${pack} pack (synthetic item). Rule verdict: ${body.verdict}.`,
          body.failed.length ? `Rules not met: ${body.failed.join("; ")}.` : "Every rule passed; it needs a named decision.",
          ["Which authorised record confirms the item's facts?", "Who holds the authority to decide it?"]],
      )).rows[0]!;
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, to_state, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'created','detected',$3,$4,$5,$6)",
        [p.institutionId, c.id, p.principalId, p.displayName, p.role, JSON.stringify({ fromPack: pack, itemId: body.itemId, label: `Opened from the ${body.workflow} queue` })]);
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "case.created", resourceType: "case", resourceId: c.id, caseId: c.id, details: { caseKey, fromPack: pack, itemId: body.itemId, verdict: body.verdict } });
      return { status: "case_opened", caseKey };
    });
  });
}
