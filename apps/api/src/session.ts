import { createHash, randomBytes, randomInt } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ROLES, type Permission, type Role, can } from "@tigeris/shared";
import { appPool, withTenant } from "./db";
import { appendAudit } from "./audit";
import { config } from "./config";

export interface Principal {
  sessionId: string;
  principalId: string;
  institutionId: string;
  role: Role;
  displayName: string;
  title: string;
  mfaVerified: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export const hashToken = (t: string) => createHash("sha256").update(config.sessionSecret).update(t).digest("hex");

export async function createSession(institutionId: string, principalId: string, role: Role) {
  const token = randomBytes(32).toString("base64url");
  const mfaCode = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + config.sessionHours * 3600_000);
  const res = await appPool.query<{ id: string }>(
    `INSERT INTO sessions (token_hash, principal_id, institution_id, role_key, mfa_code_hash, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [hashToken(token), principalId, institutionId, role, hashToken(mfaCode), expires],
  );
  return { token, sessionId: res.rows[0]!.id, mfaCode, expires };
}

/** Loads the session from the cookie, then the principal inside the institution's RLS scope. */
export async function loadPrincipal(req: FastifyRequest): Promise<Principal | undefined> {
  const token = req.cookies[config.cookieName];
  if (!token) return undefined;
  const s = await appPool.query(
    `SELECT id, principal_id, institution_id, role_key, mfa_verified_at FROM sessions
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [hashToken(token)],
  );
  const row = s.rows[0];
  if (!row || !(ROLES as readonly string[]).includes(row.role_key)) return undefined;
  const p = await withTenant(row.institution_id, (tx) =>
    tx.query("SELECT display_name, title FROM principals WHERE id = $1", [row.principal_id]),
  );
  const person = p.rows[0];
  if (!person) return undefined;
  return {
    sessionId: row.id,
    principalId: row.principal_id,
    institutionId: row.institution_id,
    role: row.role_key as Role,
    displayName: person.display_name,
    title: person.title,
    mfaVerified: row.mfa_verified_at !== null,
  };
}

/** Route guard: signed in, MFA passed, and holding the permission. Denials are audited (PRD §5.1). */
export function requirePermission(permission?: Permission) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const principal = await loadPrincipal(req);
    if (!principal) return reply.code(401).send({ error: "not_signed_in", message: "Sign in to continue." });
    if (!principal.mfaVerified) return reply.code(401).send({ error: "mfa_required", message: "Complete the verification step to continue." });
    req.principal = principal;
    if (permission && !can(principal.role, permission)) {
      await withTenant(principal.institutionId, (tx) =>
        appendAudit(tx, principal.institutionId, {
          actorType: "human",
          actorId: principal.principalId,
          actorLabel: principal.displayName,
          actorRole: principal.role,
          action: "access.denied",
          resourceType: "route",
          resourceId: `${req.method} ${req.routeOptions.url}`,
          details: { permission },
        }),
      );
      return reply.code(403).send({
        error: "forbidden",
        permission,
        message: `Your role does not include "${permission}". This attempt was recorded in the audit trail.`,
      });
    }
  };
}
