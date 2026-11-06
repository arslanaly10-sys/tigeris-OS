import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ROLES, ROLE_DENSITY, ROLE_PERMISSIONS, type Role } from "@tigeris/shared";
import { appPool, withTenant } from "../db";
import { appendAudit } from "../audit";
import { config } from "../config";
import { createSession, hashToken, loadPrincipal, requirePermission } from "../session";

const signInBody = z.object({
  institutionId: z.string().uuid(),
  principalId: z.string().uuid(),
  method: z.enum(["sso_simulated", "demo_entry"]),
});
const mfaBody = z.object({ code: z.string().regex(/^\d{6}$/) });
const switchBody = z.object({ principalId: z.string().uuid() });

export async function authRoutes(app: FastifyInstance) {
  /** People available on the sign-in screen, grouped by institution. Demo principals only. */
  app.get("/auth/demo-directory", async () => {
    const rows = (await appPool.query("SELECT * FROM demo_directory()")).rows;
    const byInst = new Map<string, any>();
    for (const r of rows) {
      if (!byInst.has(r.institution_id)) {
        byInst.set(r.institution_id, {
          id: r.institution_id, name: r.institution_name, shortName: r.institution_short,
          buyerCategory: r.buyer_category, country: r.country, people: [],
        });
      }
      byInst.get(r.institution_id).people.push({
        id: r.principal_id, name: r.display_name, title: r.title, role: r.role_key, division: r.division,
      });
    }
    return { institutions: [...byInst.values()] };
  });

  /** Step 1: simulated SSO or labelled demo entry. Creates a session that still needs MFA. */
  app.post("/auth/sign-in", async (req, reply) => {
    const body = signInBody.parse(req.body);
    const person = await withTenant(body.institutionId, async (tx) => {
      const r = await tx.query(
        `SELECT p.id, p.display_name, pr.role_key FROM principals p
           JOIN principal_roles pr ON pr.principal_id = p.id WHERE p.id = $1 AND p.is_demo`,
        [body.principalId],
      );
      return r.rows[0];
    });
    if (!person) return reply.code(404).send({ error: "unknown_person", message: "That person is not in this institution." });
    const role = person.role_key as Role;
    const s = await createSession(body.institutionId, person.id, role);
    await withTenant(body.institutionId, (tx) =>
      appendAudit(tx, body.institutionId, {
        actorType: "human", actorId: person.id, actorLabel: person.display_name, actorRole: role,
        action: "session.sign_in_started", resourceType: "session", resourceId: s.sessionId,
        details: { method: body.method, mfa: "pending" },
      }),
    );
    reply.setCookie(config.cookieName, s.token, { path: "/", httpOnly: true, sameSite: "lax", expires: s.expires });
    // MFA is simulated in the demo: the code is returned so the screen can show it as a "demo code".
    return { status: "mfa_required", demoMfaCode: s.mfaCode, method: body.method };
  });

  /** Step 2: simulated MFA verification. */
  app.post("/auth/mfa", async (req, reply) => {
    const { code } = mfaBody.parse(req.body);
    const token = req.cookies[config.cookieName];
    if (!token) return reply.code(401).send({ error: "not_signed_in", message: "Start sign-in again." });
    const res = await appPool.query(
      `UPDATE sessions SET mfa_verified_at = now()
        WHERE token_hash = $1 AND mfa_code_hash = $2 AND revoked_at IS NULL AND expires_at > now()
        RETURNING id, principal_id, institution_id, role_key`,
      [hashToken(token), hashToken(code)],
    );
    const s = res.rows[0];
    if (!s) return reply.code(400).send({ error: "mfa_failed", message: "That code is not correct. Check the code and try again." });
    await withTenant(s.institution_id, async (tx) => {
      const p = await tx.query("SELECT display_name FROM principals WHERE id = $1", [s.principal_id]);
      await appendAudit(tx, s.institution_id, {
        actorType: "human", actorId: s.principal_id, actorLabel: p.rows[0]?.display_name ?? "unknown", actorRole: s.role_key,
        action: "session.signed_in", resourceType: "session", resourceId: s.id, details: { mfa: "verified" },
      });
    });
    return { status: "signed_in" };
  });

  /** Who is signed in, their permissions and the institution context shown in the header. */
  app.get("/auth/context", { preHandler: requirePermission() }, async (req) => {
    const p = req.principal!;
    const inst = (await appPool.query("SELECT * FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
    const colleagues = await withTenant(p.institutionId, (tx) =>
      tx.query(
        `SELECT p.id, p.display_name AS name, p.title, pr.role_key AS role FROM principals p
           JOIN principal_roles pr ON pr.principal_id = p.id WHERE p.is_demo ORDER BY pr.role_key`,
      ),
    );
    return {
      principal: { id: p.principalId, name: p.displayName, title: p.title, role: p.role },
      permissions: ROLE_PERMISSIONS[p.role],
      density: ROLE_DENSITY[p.role],
      institution: {
        id: inst.id, name: inst.name, shortName: inst.short_name, buyerCategory: inst.buyer_category,
        country: inst.country, residency: inst.residency, environment: inst.environment,
      },
      dataMode: "public_synthetic",
      roleSwitch: colleagues.rows,
    };
  });

  /** Header role switcher: move to a colleague with another role in the same institution. */
  app.post("/auth/switch-role", { preHandler: requirePermission() }, async (req, reply) => {
    const p = req.principal!;
    const { principalId } = switchBody.parse(req.body);
    const target = await withTenant(p.institutionId, async (tx) => {
      const r = await tx.query(
        `SELECT p.id, p.display_name, pr.role_key FROM principals p JOIN principal_roles pr ON pr.principal_id = p.id
          WHERE p.id = $1 AND p.is_demo`,
        [principalId],
      );
      return r.rows[0];
    });
    if (!target || !(ROLES as readonly string[]).includes(target.role_key)) {
      return reply.code(404).send({ error: "unknown_person", message: "That person is not in your institution." });
    }
    await appPool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [p.sessionId]);
    const s = await createSession(p.institutionId, target.id, target.role_key);
    await appPool.query("UPDATE sessions SET mfa_verified_at = now() WHERE id = $1", [s.sessionId]);
    await withTenant(p.institutionId, (tx) =>
      appendAudit(tx, p.institutionId, {
        actorType: "human", actorId: target.id, actorLabel: target.display_name, actorRole: target.role_key,
        action: "session.role_switched", resourceType: "session", resourceId: s.sessionId,
        details: { from: { principal: p.principalId, role: p.role }, to: { principal: target.id, role: target.role_key }, mfa: "carried_over_demo" },
      }),
    );
    reply.setCookie(config.cookieName, s.token, { path: "/", httpOnly: true, sameSite: "lax", expires: s.expires });
    return { status: "switched", role: target.role_key };
  });

  app.post("/auth/sign-out", async (req, reply) => {
    const p = await loadPrincipal(req);
    if (p) {
      await appPool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [p.sessionId]);
      await withTenant(p.institutionId, (tx) =>
        appendAudit(tx, p.institutionId, {
          actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role,
          action: "session.signed_out", resourceType: "session", resourceId: p.sessionId,
        }),
      );
    }
    reply.clearCookie(config.cookieName, { path: "/" });
    return { status: "signed_out" };
  });
}
