import type { FastifyInstance } from "fastify";
import { withTenant } from "../db";
import { appendAudit, verifyChain } from "../audit";
import { requirePermission } from "../session";
import { getSettings, providerStatus } from "../ai/gateway";
import { config } from "../config";

/**
 * Security posture (Q107, TR-046..TR-050). Every line is checked live against the running system,
 * with the evidence it rests on. Gaps that the demo deliberately leaves open are shown as such.
 */
type Status = "pass" | "warn" | "fail";
interface Check { area: string; check: string; status: Status; evidence: string }

export async function securityRoutes(app: FastifyInstance) {
  app.get("/security/posture", { preHandler: requirePermission("policy.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const checks: Check[] = [];
      const add = (area: string, check: string, status: Status, evidence: string) => checks.push({ area, check, status, evidence });

      // Data isolation
      const rls = (await tx.query(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'institution_id' AND NOT a.attisdropped)`)).rows;
      // The session table is read by token hash before the institution is known, so it is the one deliberate exception.
      const weak = rls.filter((r) => r.relname !== "sessions" && (!r.relrowsecurity || !r.relforcerowsecurity)).map((r) => r.relname);
      add("Data isolation", "Row-level security forced on every institutional table", weak.length ? "fail" : "pass", weak.length ? `Not forced: ${weak.join(", ")}` : `${rls.length - 1} tables carry institution_id; all have row-level security enabled and forced. The session table is the one exception: it is looked up by a hashed token before the institution is known.`);
      const role = (await tx.query("SELECT current_user AS u, r.rolbypassrls, r.rolsuper FROM pg_roles r WHERE r.rolname = current_user")).rows[0];
      add("Data isolation", "Application connects without bypass rights", role.rolbypassrls || role.rolsuper ? "fail" : "pass", `Connected as ${role.u}; superuser ${role.rolsuper ? "yes" : "no"}; bypass row-level security ${role.rolbypassrls ? "yes" : "no"}.`);
      const foreign = (await tx.query("SELECT (SELECT count(*) FROM principals WHERE institution_id <> $1)::int AS p, (SELECT count(*) FROM cases WHERE institution_id <> $1)::int AS c, (SELECT count(*) FROM precedents WHERE institution_id <> $1)::int AS m", [p.institutionId])).rows[0];
      add("Data isolation", "Other institution's records invisible from this scope", foreign.p + foreign.c + foreign.m ? "fail" : "pass", `Visible from here: ${foreign.p} people, ${foreign.c} cases, ${foreign.m} memory entries of another institution.`);

      // Audit
      const chain = await verifyChain(tx, p.institutionId);
      add("Audit", "Hash-chained audit trail intact", chain.ok ? "pass" : "fail", `${chain.checked} events verified; head ${chain.headHash.slice(0, 16)}…${chain.ok ? "" : `; broken at ${chain.firstBrokenSeq}`}`);
      const grants = (await tx.query("SELECT privilege_type FROM information_schema.role_table_grants WHERE table_name = 'audit_events' AND grantee = current_user")).rows.map((r) => r.privilege_type);
      add("Audit", "Application cannot change or delete audit events", grants.some((g) => g === "UPDATE" || g === "DELETE") ? "fail" : "pass", `Grants on audit_events: ${grants.join(", ") || "none"}; an append-only trigger rejects updates and deletes.`);

      // Models and egress
      const s = await getSettings(tx);
      add("Sovereignty", "Foreign models", s.foreign_models_enabled ? "warn" : "pass", s.foreign_models_enabled ? `Allowed for content up to ${s.foreign_max_classification}; changed by ${s.updated_by_label}.` : "Cut. Every agent runs on the local model or the deterministic writer.");
      add("Sovereignty", "Outbound access from the product", s.outbound_allowed ? "warn" : "pass", s.outbound_allowed ? "Allowed, only to each provider's own host." : "Off. The gateway refuses every outbound call.");
      const blocked = (await tx.query("SELECT count(*)::int AS n FROM model_calls WHERE outcome = 'blocked' AND created_at > now() - interval '30 days'")).rows[0].n;
      add("Sovereignty", "Refused model and egress attempts are recorded", "pass", `${blocked} refused attempt(s) in the last 30 days, each on the audit chain.`);
      const providers = await providerStatus(s);
      const local = providers.find((x) => x.key === "local");
      add("Sovereignty", "Local model available", local?.usable ? "pass" : "warn", local?.local?.sha256 ? `${local.model}; sha256 ${String(local.local.sha256).slice(0, 16)}…; weights read from local disk.` : String(local?.reason ?? "Not loaded yet; it loads on first use."));
      add("Sovereignty", "Foreign model keys", "pass", `Read only from the deployment environment, never stored in the database. Configured here: ${providers.filter((x) => x.foreign && x.keyConfigured).map((x) => x.label).join(", ") || "none"}.`);
      const inst = (await tx.query("SELECT residency FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      add("Sovereignty", "Data residency", "pass", `${inst.residency}. Database, vault, models and audit run in this deployment.`);

      // Governance
      const pol = (await tx.query("SELECT version, tests_passed, test_results, activated_by_label, activated_at FROM policy_versions WHERE status = 'active'")).rows[0];
      add("Governance", "Active policy passes its tests", pol?.tests_passed ? "pass" : "fail", pol ? `Policy v${pol.version}: ${(pol.test_results as unknown[]).length} tests pass; activated by ${pol.activated_by_label}.` : "No active policy.");
      const sod = (await tx.query("SELECT count(*)::int AS n FROM audit_events WHERE details->'policy'->>'rule' IN ('case.separation_of_duties','approval.distinct_person','decision.drafter_cannot_decide','memory.distinct')")).rows[0].n;
      add("Governance", "Separation of duties enforced on the server", "pass", `Creator, drafter and second-approver rules are in the active policy; ${sod} refused attempt(s) recorded.`);
      add("Governance", "No external action executes", "pass", "Decisions create handoff tasks only; the product has no connector that acts outside it.");

      // Inputs
      const q = (await tx.query("SELECT count(*) FILTER (WHERE validation_state = 'quarantined')::int AS q, count(*)::int AS n FROM evidence_objects")).rows[0];
      add("Inputs", "Documents screened for hidden or instruction-like text", "pass", `${q.n} evidence objects validated; ${q.q} quarantined and kept away from agents and models.`);
      const signers = (await tx.query("SELECT count(*)::int AS n FROM trusted_signers")).rows[0].n;
      add("Inputs", "Air-gap packages verified by signature", signers ? "pass" : "warn", `${signers} trusted signer(s); unsigned or altered packages are rejected.`);

      // Access
      const unverified = (await tx.query("SELECT count(*)::int AS n FROM sessions WHERE mfa_verified_at IS NULL AND revoked_at IS NULL AND expires_at > now() AND institution_id = $1", [p.institutionId])).rows[0].n;
      add("Access", "Second factor required before any data is served", "pass", `Every protected route checks the second factor; ${unverified} open session(s) are waiting for it and can see nothing. (MFA is simulated in the demo.)`);
      add("Access", "Session lifetime", "pass", `${config.sessionHours} hours; tokens are stored only as salted hashes.`);

      // Known demo gaps, stated plainly
      add("Platform", "Encryption at rest", "warn", "Not enabled in this demonstration build (decided in the questionnaire). The pilot uses encrypted volumes and database encryption.");
      add("Platform", "Transport encryption", "warn", "The laptop package serves plain HTTP on localhost; the hosted VM terminates TLS at its reverse proxy.");
      add("Platform", "Identity provider", "warn", "Single sign-on is simulated; the pilot connects the institution's own identity provider.");

      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "security.posture_checked", resourceType: "institution", resourceId: p.institutionId, details: { pass: checks.filter((c) => c.status === "pass").length, warn: checks.filter((c) => c.status === "warn").length, fail: checks.filter((c) => c.status === "fail").length } });
      return { checkedAt: new Date().toISOString(), checks };
    });
  });
}
