import type { FastifyInstance } from "fastify";
import { withTenant } from "../db";
import { requirePermission } from "../session";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/people", { preHandler: requirePermission("admin.manage") }, async (req) => {
    const p = req.principal!;
    const rows = await withTenant(p.institutionId, async (tx) => ({
      people: (await tx.query(
        `SELECT p.id, p.display_name AS name, p.title, p.email, p.idp_issuer, d.name AS division, pr.role_key AS role
           FROM principals p JOIN principal_roles pr ON pr.principal_id = p.id
           LEFT JOIN divisions d ON d.id = p.division_id ORDER BY d.name, p.display_name`,
      )).rows,
      divisions: (await tx.query("SELECT id, name FROM divisions ORDER BY name")).rows,
    }));
    return rows;
  });
}
