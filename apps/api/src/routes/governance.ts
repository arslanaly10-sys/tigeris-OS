import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../db";
import { appendAudit, verifyChain } from "../audit";
import { requirePermission } from "../session";

export async function governanceRoutes(app: FastifyInstance) {
  app.get("/audit/events", { preHandler: requirePermission("audit.read") }, async (req) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
    const p = req.principal!;
    const rows = await withTenant(p.institutionId, (tx) =>
      tx.query(
        `SELECT seq, occurred_at, actor_type, actor_label, actor_role, action, resource_type, resource_id, details, hash, prev_hash
           FROM audit_events ORDER BY seq DESC LIMIT $1`,
        [q.limit],
      ),
    );
    return { events: rows.rows.map((r) => ({ ...r, seq: Number(r.seq) })) };
  });

  /** Recomputes the whole chain for the signed-in institution (Q093). */
  app.post("/audit/verify", { preHandler: requirePermission("audit.verify") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const result = await verifyChain(tx, p.institutionId);
      await appendAudit(tx, p.institutionId, {
        actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role,
        action: "audit.chain_verified", resourceType: "audit_chain",
        details: { ok: result.ok, checked: result.checked, firstBrokenSeq: result.firstBrokenSeq },
      });
      return result;
    });
  });

  /**
   * Isolation check (FR-42, Q091): asks the database, under this institution's scope, how many
   * people and audit events from other institutions it can see. Row-level security must answer zero.
   */
  app.post("/sovereignty/isolation-check", { preHandler: requirePermission("audit.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const foreignPeople = await tx.query("SELECT count(*)::int AS n FROM principals WHERE institution_id <> $1", [p.institutionId]);
      const foreignAudit = await tx.query("SELECT count(*)::int AS n FROM audit_events WHERE institution_id <> $1", [p.institutionId]);
      const ownPeople = await tx.query("SELECT count(*)::int AS n FROM principals");
      const visibleForeign = foreignPeople.rows[0].n + foreignAudit.rows[0].n;
      const result = {
        ok: visibleForeign === 0,
        ownPeopleVisible: ownPeople.rows[0].n,
        foreignPeopleVisible: foreignPeople.rows[0].n,
        foreignAuditEventsVisible: foreignAudit.rows[0].n,
        enforcedBy: "PostgreSQL row-level security (FORCE), non-owner application role without BYPASSRLS",
        checkedAt: new Date().toISOString(),
      };
      await appendAudit(tx, p.institutionId, {
        actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role,
        action: "sovereignty.isolation_checked", resourceType: "institution", resourceId: p.institutionId,
        details: { ok: result.ok, visibleForeign },
      });
      return result;
    });
  });
}
