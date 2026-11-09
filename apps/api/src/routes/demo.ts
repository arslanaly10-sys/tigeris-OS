import type { FastifyInstance } from "fastify";
import { requirePermission } from "../session";
import { resetDemo } from "../scripts/seed-data";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { config } from "../config";

export async function demoRoutes(app: FastifyInstance) {
  /**
   * One-click reset to the clean demo state (Q117). Signs everyone out. Only an administrator may reset,
   * and only where demo mode is on: a reset erases every institution's data, audit trail included.
   */
  app.post("/demo/reset", { preHandler: requirePermission("admin.manage") }, async (req, reply) => {
    if (!config.demoMode) return reply.code(403).send({ error: "demo_mode_off", message: "Reset is only available in a demonstration deployment." });
    const p = req.principal!;
    await resetDemo();
    // The new chain starts by saying who reset it.
    await withTenant(p.institutionId, (tx) => appendAudit(tx, p.institutionId, {
      actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role,
      action: "demo.reset", resourceType: "deployment", details: { note: "All demo data was reset to the clean state" },
    }));
    reply.clearCookie(config.cookieName, { path: "/" });
    return { status: "reset" };
  });
}
