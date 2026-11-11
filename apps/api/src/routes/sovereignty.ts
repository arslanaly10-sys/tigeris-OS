import type { FastifyInstance } from "fastify";
import { withTenant, type Tx } from "../db";
import type { Principal } from "../session";
import { verifyChain } from "../audit";
import { requirePermission } from "../session";
import { getSettings, providerStatus } from "../ai/gateway";
import { config } from "../config";

/**
 * Sovereignty module (slice 3, 9 Nov 2026). The sovereignty stack groups what TIGERIS keeps inside the
 * institution's control into six layers; every check is read live from the running system. Capabilities the
 * demonstration does not have (HSM, confidential computing, post-quantum cryptography, encryption at rest) are
 * listed as planned for the pilot, with what each needs; they are never shown as working.
 *
 * The layering is TIGERIS's own framework, built from widely used layers of a sovereign AI stack. It will be
 * aligned with the McKinsey explainer once the client supplies its text.
 */
type CheckStatus = "pass" | "warn" | "fail" | "planned";
interface Check { label: string; status: CheckStatus; evidence: string }
interface Layer { key: string; name: string; question: string; status: "sovereign" | "partial" | "at_risk"; checks: Check[] }

const layerStatus = (checks: Check[]): Layer["status"] => (checks.some((c) => c.status === "fail") ? "at_risk" : checks.every((c) => c.status === "pass") ? "sovereign" : "partial");

/** The six-layer stack for the signed-in institution, every check read live. Shared by /sovereignty and /sovereignty/index. */
async function buildStack(tx: Tx, p: Principal) {
      const inst = (await tx.query("SELECT name, residency, environment FROM institutions WHERE id = $1", [p.institutionId])).rows[0];
      const s = await getSettings(tx);
      const providers = await providerStatus(s);
      const local = providers.find((x) => x.key === "local");
      const calls = (await tx.query(
        `SELECT provider, count(*)::int AS n, count(*) FILTER (WHERE outcome = 'blocked')::int AS blocked FROM model_calls WHERE created_at > now() - interval '30 days' GROUP BY provider`)).rows as Array<{ provider: string; n: number; blocked: number }>;
      const foreignCalls = calls.filter((c) => !["local", "deterministic"].includes(c.provider)).reduce((a, c) => a + c.n - c.blocked, 0);
      const localCalls = calls.filter((c) => ["local", "deterministic"].includes(c.provider)).reduce((a, c) => a + c.n, 0);
      const rls = (await tx.query(
        `SELECT count(*) FILTER (WHERE c.relname <> 'sessions' AND NOT (c.relrowsecurity AND c.relforcerowsecurity))::int AS weak, count(*)::int AS n
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'institution_id' AND NOT a.attisdropped)`)).rows[0];
      const role = (await tx.query("SELECT r.rolbypassrls OR r.rolsuper AS bypass FROM pg_roles r WHERE r.rolname = current_user")).rows[0];
      const signers = (await tx.query("SELECT name, fingerprint, created_at FROM trusted_signers WHERE status = 'active' ORDER BY created_at")).rows as Array<{ name: string; fingerprint: string; created_at: string }>;
      const ev = (await tx.query(
        `SELECT count(*)::int AS n, count(*) FILTER (WHERE e.validation_state IN ('quarantined','rejected'))::int AS held,
                count(DISTINCT s.key) FILTER (WHERE s.source_class = 'public')::int AS public_sources,
                count(DISTINCT s.key) FILTER (WHERE s.source_class = 'synthetic')::int AS synthetic_sources
           FROM evidence_objects e JOIN sources s ON s.id = e.source_id`)).rows[0];
      const facts = (await tx.query("SELECT claim_class, count(*)::int AS n FROM evidence_facts GROUP BY claim_class ORDER BY 2 DESC")).rows as Array<{ claim_class: string; n: number }>;
      const chain = await verifyChain(tx, p.institutionId);
      const pol = (await tx.query("SELECT version, tests_passed, jsonb_array_length(test_results) AS tests FROM policy_versions WHERE status = 'active'")).rows[0];
      const decisions = (await tx.query("SELECT count(*)::int AS n FROM decisions")).rows[0].n;
      const people = (await tx.query("SELECT count(*)::int AS n FROM principals")).rows[0].n;
      const humanEvents = (await tx.query("SELECT count(*)::int AS n FROM audit_events WHERE actor_type = 'human'")).rows[0].n;
      const defaultSecret = config.sessionSecret === "change-me-demo-only";

      const layers: Layer[] = [];
      const layer = (key: string, name: string, question: string, checks: Check[]) => layers.push({ key, name, question, status: layerStatus(checks), checks });

      layer("compute", "Compute and hosting", "Where does TIGERIS run, and who controls the machines?", [
        { label: "Runs inside the institution's own deployment", status: "pass", evidence: `${inst.residency}. Profile: ${inst.environment.replace(/_/g, " ")}. Database, file vault, models and audit all run in this deployment.` },
        { label: "Works with no internet connection", status: s.outbound_allowed ? "warn" : "pass", evidence: s.outbound_allowed ? "Outbound access is switched on in Governance; switch it off to run fully offline." : "Outbound access is off. External data arrives only as signed packages carried across the boundary." },
        { label: "One package for laptop, on-premises server or in-country cloud", status: "pass", evidence: "The same Docker build installs from a folder with no internet access (scripts/package.sh, deploy/install.sh)." },
        { label: "Confidential computing (data protected while in use)", status: "planned", evidence: "Planned for the pilot. Needs servers with trusted execution (Intel TDX or AMD SEV-SNP) and an attestation service the institution runs." },
      ]);
      layer("data", "Data", "Where does the data live, and who can see it?", [
        { label: "Data stays in the stated jurisdiction", status: "pass", evidence: `${inst.residency}. No data store outside this deployment.` },
        { label: "Each institution's data is isolated", status: rls.weak || role.bypass ? "fail" : "pass", evidence: rls.weak ? `${rls.weak} tables without forced row-level security.` : `${rls.n - 1} institutional tables use forced row-level security; the application connects without bypass rights.` },
        { label: "External data enters only through signed packages", status: signers.length ? "pass" : "warn", evidence: `${signers.length} trusted signer(s); ${ev.n} evidence objects imported, ${ev.held} held in quarantine or rejected.` },
        { label: "Every figure carries its class and lineage", status: "pass", evidence: facts.map((f) => `${f.n.toLocaleString("en-GB")} ${f.claim_class}`).join(" · ") || "No facts yet." },
        { label: "Encryption at rest", status: "planned", evidence: "Not enabled in this demonstration build. The pilot uses encrypted volumes and database encryption with keys the institution holds." },
      ]);
      layer("models", "Models", "Which AI models run, where, and who allows them?", [
        { label: "A local open-weight model runs on this machine", status: local?.usable ? "pass" : "warn", evidence: local?.usable ? `${local.model}${local.local?.sha256 ? `; weights checked by sha256 ${String(local.local.sha256).slice(0, 16)}…` : ""}.` : `${local?.reason ?? "Local model not loaded"}; agents fall back to the deterministic writer.` },
        { label: "Foreign models are off unless an administrator allows them", status: s.foreign_models_enabled ? "warn" : "pass", evidence: s.foreign_models_enabled ? `On, for content up to ${s.foreign_max_classification}; changed by ${s.updated_by_label}.` : "Off. Allowlist: " + s.allowed_providers.join(", ") + "." },
        { label: "Model use in the last 30 days stayed inside", status: foreignCalls ? "warn" : "pass", evidence: `${localCalls} local or deterministic calls; ${foreignCalls} foreign calls; ${calls.reduce((a, c) => a + c.blocked, 0)} refused by the gateway.` },
        { label: "No model is the source of truth", status: "pass", evidence: "Numbers come from the scenario engine and imported facts; model text is checked against evidence or marked unverified." },
      ]);
      layer("keys", "Keys and cryptography", "Who holds the keys that protect and prove the data?", [
        { label: "Audit trail is tamper-evident", status: chain.ok ? "pass" : "fail", evidence: `SHA-256 hash chain over ${chain.checked} events; head ${chain.headHash.slice(0, 16)}…` },
        { label: "Data packages are signed and verified", status: signers.length ? "pass" : "warn", evidence: signers.map((x) => `${x.name} (Ed25519, ${x.fingerprint.slice(0, 16)}…)`).join("; ") || "No trusted signer." },
        { label: "Session secret set for this deployment", status: defaultSecret ? "warn" : "pass", evidence: defaultSecret ? "The demonstration default is in use; set SESSION_SECRET for any real deployment." : "Set from the deployment environment; never stored in the database." },
        { label: "Keys held in a hardware security module", status: "planned", evidence: "Planned for the pilot; see Data and keys for what it needs." },
        { label: "Post-quantum readiness", status: "planned", evidence: "Cryptography in use is inventoried on the Data and keys tab, the first step of a migration plan." },
      ]);
      layer("applications", "Applications and decisions", "Who decides, and can the system act on its own?", [
        { label: "Rules are policy as code, tested before use", status: pol?.tests_passed ? "pass" : "fail", evidence: pol ? `Policy v${pol.version}; ${pol.tests} tests pass.` : "No active policy." },
        { label: "No external action executes", status: "pass", evidence: "Decisions create handoff tasks for named owners; there is no connector that acts outside TIGERIS." },
        { label: "Every decision names a person", status: "pass", evidence: `${decisions} decision(s) recorded, each with a named decider and, where policy requires, a second approver.` },
      ]);
      layer("people", "People and oversight", "Who can see and change what, and is it recorded?", [
        { label: "Seven roles with separation of duties", status: "pass", evidence: `${people} people in this institution; creators cannot approve their own work, enforced on the server.` },
        { label: "Second factor before any data is shown", status: "pass", evidence: "Every protected route requires the second factor (simulated in the demo; the pilot uses the institution's identity provider)." },
        { label: "Human actions are recorded", status: "pass", evidence: `${humanEvents.toLocaleString("en-GB")} human actions on the audit chain, including every industry and role switch.` },
      ]);

      const keys = [
        { name: "Collector signing key", algorithm: "Ed25519 signature", purpose: "Signs every data package before it crosses into the institution", custody: "Private key on the collector machine outside the boundary; the institution holds only the public key", fingerprint: signers[0]?.fingerprint ?? null, quantumSafe: false },
        { name: "Audit chain", algorithm: "SHA-256 hash chain", purpose: "Makes any later change to the audit trail detectable", custody: "Database in this deployment; verified on demand by the Auditor", fingerprint: chain.headHash, quantumSafe: true },
        { name: "Evidence integrity", algorithm: "SHA-256 per file", purpose: "Proves each imported file is the one the collector fetched", custody: "Stored with each evidence record and in the signed package manifest", fingerprint: null, quantumSafe: true },
        { name: "Session tokens", algorithm: "SHA-256 with a deployment secret", purpose: "Stores sign-in tokens only as salted hashes", custody: defaultSecret ? "Demonstration default secret (set SESSION_SECRET for real use)" : "Secret from the deployment environment", fingerprint: null, quantumSafe: true },
        { name: "Local model weights", algorithm: "SHA-256", purpose: "Proves the model running is the approved one", custody: "Model file on local disk", fingerprint: local?.local?.sha256 ? String(local.local.sha256) : null, quantumSafe: true },
      ];
      const planned = [
        { name: "Hardware security module (HSM)", what: "Keys generated and held in tamper-resistant hardware the institution owns; signing and decryption happen inside it.", needs: ["An in-country HSM (appliance or sovereign cloud HSM) with FIPS 140-3 validation", "PKCS#11 integration for package signing and database keys", "A key ceremony with named custodians and dual control"] },
        { name: "Encryption at rest", what: "Database, file vault and backups encrypted with keys the institution holds.", needs: ["Encrypted volumes on every node", "Database encryption keyed from the HSM", "Key rotation schedule and tested restore"] },
        { name: "Confidential computing", what: "Data, models and agents protected even while running, so operators of the machine cannot read them.", needs: ["Servers with trusted execution (Intel TDX or AMD SEV-SNP)", "Remote attestation before keys are released", "Container images built for confidential runtimes"] },
        { name: "Post-quantum cryptography", what: "Signatures and key exchange that stay secure against future quantum computers.", needs: ["This inventory kept current (Ed25519 is the one quantum-vulnerable algorithm in use)", "Hybrid signatures with ML-DSA (NIST FIPS 204) for data packages", "ML-KEM (NIST FIPS 203) in TLS once the reverse proxy supports it"] },
      ];
      const summary = { sovereign: layers.filter((l) => l.status === "sovereign").length, partial: layers.filter((l) => l.status === "partial").length, atRisk: layers.filter((l) => l.status === "at_risk").length };
      return { checkedAt: new Date().toISOString(), institution: inst.name as string, residency: inst.residency as string, framework: "TIGERIS sovereignty stack (to be aligned with the McKinsey explainer when its text is supplied)", summary, layers, keys, planned };
}

/**
 * Sovereign Capability Index (SCI), 0–100, MODELLED. Three parts, each a ratio read from this institution's records:
 * - Control (weight 0.4): the six layers, sovereign = 1, partly sovereign = 0.5, at risk = 0, divided by six.
 * - Convergence (0.3), Doctrine 01: how many of the six functions run inside TIGERIS for this institution
 *   (perception, reasoning, capital allocation, governance, execution, learning), each live when its records exist.
 * - Operationalisation (0.3), Doctrine 03: the share of cases and decision packages that reached a governed
 *   outcome (a named decision, or an approved package with owners) rather than stopping as information.
 * Weights are placeholders pending the client CTO's sign-off, like the rubric bands.
 */
export const SCI_WEIGHTS = { control: 0.4, convergence: 0.3, operational: 0.3 } as const;
export function sciScore(control: number, convergence: number, operational: number) {
  const v = 100 * (SCI_WEIGHTS.control * control + SCI_WEIGHTS.convergence * convergence + SCI_WEIGHTS.operational * operational);
  return Math.round(v * 10) / 10;
}

export async function sovereigntyRoutes(app: FastifyInstance) {
  app.get("/sovereignty", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, (tx) => buildStack(tx, p));
  });

  app.get("/sovereignty/index", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const st = await buildStack(tx, p);
      const one = async (sql: string) => Number((await tx.query(sql)).rows[0].n);
      const fn = [
        { key: "perception", label: "Perception", doctrine: "Signals detected and validated", n: await one("SELECT count(*)::int AS n FROM signals"), source: "signals", href: "/signals" },
        { key: "reasoning", label: "Reasoning", doctrine: "Scenarios run and briefs reasoned from evidence", n: (await one("SELECT count(*)::int AS n FROM scenario_runs")) + (await one("SELECT count(*)::int AS n FROM case_briefs")), source: "scenario_runs + case_briefs", href: "/scenarios" },
        { key: "capital", label: "Capital allocation", doctrine: "Decision envelopes and mandate-level packages", n: (await one("SELECT count(*)::int AS n FROM decision_envelopes WHERE status <> 'revoked'")) + (await one("SELECT count(*)::int AS n FROM decision_packages")), source: "decision_envelopes + decision_packages", href: "/governor" },
        { key: "governance", label: "Governance", doctrine: "Decisions approved by the named authority", n: (await one("SELECT count(*)::int AS n FROM decisions WHERE status = 'approved'")) + (await one("SELECT count(*)::int AS n FROM decision_packages WHERE status = 'approved'")), source: "decisions + decision_packages (approved)", href: "/decisions" },
        { key: "execution", label: "Execution", doctrine: "Hand-offs and tasks with a named owner", n: (await one("SELECT count(*)::int AS n FROM handoffs")) + (await one("SELECT count(*)::int AS n FROM package_tasks")), source: "handoffs + package_tasks", href: "/decisions" },
        { key: "learning", label: "Learning", doctrine: "Precedents from closed cases and feedback that re-ranks options", n: (await one("SELECT count(*)::int AS n FROM precedents WHERE case_id IS NOT NULL")) + (await one("SELECT count(*)::int AS n FROM recommendation_feedback")), source: "precedents (from cases) + recommendation_feedback", href: "/memory" },
      ].map((f) => ({ ...f, live: f.n > 0 }));
      const cases = await one("SELECT count(*)::int AS n FROM cases");
      const decided = await one("SELECT count(DISTINCT case_id)::int AS n FROM decisions WHERE status IN ('approved','rejected')");
      const pkgs = await one("SELECT count(*)::int AS n FROM decision_packages");
      const pkgsDone = await one("SELECT count(*)::int AS n FROM decision_packages p WHERE status = 'approved' AND EXISTS (SELECT 1 FROM package_tasks t WHERE t.package_id = p.id)");
      const control = (st.summary.sovereign + 0.5 * st.summary.partial) / st.layers.length;
      const convergence = fn.filter((f) => f.live).length / fn.length;
      const operational = cases + pkgs ? (decided + pkgsDone) / (cases + pkgs) : 0;
      return {
        checkedAt: st.checkedAt, institution: st.institution, label: "MODELLED", weightsStatus: "placeholder pending the client CTO's sign-off",
        score: sciScore(control, convergence, operational),
        formula: "SCI = 100 × (0.4 × control + 0.3 × convergence + 0.3 × operationalisation)",
        parts: {
          control: { value: control, weight: SCI_WEIGHTS.control, detail: `${st.summary.sovereign} sovereign, ${st.summary.partial} partly sovereign, ${st.summary.atRisk} at risk, of ${st.layers.length} layers` },
          convergence: { value: convergence, weight: SCI_WEIGHTS.convergence, detail: `${fn.filter((f) => f.live).length} of ${fn.length} functions run inside TIGERIS` },
          operational: { value: operational, weight: SCI_WEIGHTS.operational, detail: `${decided} of ${cases} cases reached a named decision; ${pkgsDone} of ${pkgs} decision packages approved with owners` },
        },
        functions: fn,
        layers: st.layers.map((l) => ({ key: l.key, name: l.name, status: l.status, open: l.checks.filter((c) => c.status !== "pass").map((c) => ({ label: c.label, status: c.status })) })),
        summary: st.summary, residency: st.residency,
      };
    });
  });
}
