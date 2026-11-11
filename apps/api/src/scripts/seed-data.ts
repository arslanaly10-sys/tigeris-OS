import { compile, runTests } from "../policy/engine";
import { DEFAULT_POLICY } from "../policy/default-policy";
import { activateEnvelope, proposeEnvelope } from "../workflow/envelopes";
import { seedFundA } from "../workflow/engagements";

/** Sample envelope limit on an option's remaining 90-day value at risk (synthetic). */
export const ENVELOPE_SAMPLE_LIMIT_USD = 1_000_000_000;
import { seedPrecedents } from "../memory/memory";
import { RESET_LOCK } from "../evidence/jobs";
import { ROLES, ROLE_LABELS, type Role } from "@tigeris/shared";
import { ownerPool } from "../db";
import { appendAudit } from "../audit";
import { migrate } from "./migrate";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash, createPublicKey } from "node:crypto";
import { SOURCE_CATALOG } from "../evidence/catalog";
import { enqueue, processNext } from "../evidence/jobs";
import { allBundledPackages } from "../routes/evidence";
import { withTenant, type Tx } from "../db";
import { saveAssessment } from "../routes/diagnostic";
import { seedStoryline } from "../workflow/storyline";

const ROOT = process.env.TIGERIS_ROOT ?? path.resolve(import.meta.dirname, "../../../..");
const PUBKEY = path.join(ROOT, "data/keys/collector-ed25519.pub.pem");
const PACKAGES = path.join(ROOT, "data/packages");

/**
 * Demo institutions are fictional (Q025). They are labelled by buyer category only (Q123).
 * Stable IDs keep links and tests predictable across resets.
 */
export const DEMO_INSTITUTIONS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "gulf-sovereign-fund",
    name: "GCC Sovereign Fund A",
    shortName: "GSF",
    buyerCategory: "Sovereign wealth fund",
    country: "Saudi Arabia",
    residency: "In-Kingdom · Riyadh data centre",
    domain: "gsf.example",
    divisions: ["Strategy Office", "Investment", "Risk", "Energy & Resources", "Governance & Platform", "Internal Audit"],
    people: [
      ["executive", "Faisal Al-Rashed", "Governor", "Strategy Office"],
      ["analyst", "Noura Al-Harbi", "Senior Intelligence Analyst", "Strategy Office"],
      ["domain_expert", "Dr. Khalid Al-Mutairi", "Energy Markets Adviser", "Energy & Resources"],
      ["approver", "Reem Al-Qahtani", "Chief Risk Officer", "Risk"],
      ["operations_owner", "Omar Al-Shehri", "Head of Portfolio Operations", "Investment"],
      ["administrator", "Sara Al-Dosari", "Governance & Platform Administrator", "Governance & Platform"],
      ["auditor", "Yousef Al-Zahrani", "Internal Audit Lead", "Internal Audit"],
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "al-noor-investment-authority",
    name: "Al Noor National Investment Authority",
    shortName: "ANIA",
    buyerCategory: "National investment authority",
    country: "United Arab Emirates",
    residency: "In-country · Abu Dhabi data centre",
    domain: "ania.example",
    divisions: ["Office of the Managing Director", "Macro & Geopolitics", "Infrastructure", "Risk & Compliance", "Technology", "Audit"],
    people: [
      ["executive", "Mariam Al-Mansoori", "Managing Director", "Office of the Managing Director"],
      ["analyst", "Hamdan Al-Ketbi", "Geopolitical Intelligence Analyst", "Macro & Geopolitics"],
      ["domain_expert", "Dr. Aisha Al-Nuaimi", "Infrastructure & Logistics Adviser", "Infrastructure"],
      ["approver", "Saeed Al-Falasi", "Head of Risk & Compliance", "Risk & Compliance"],
      ["operations_owner", "Latifa Al-Shamsi", "Operations Director", "Infrastructure"],
      ["administrator", "Rashid Al-Zaabi", "Platform & Governance Administrator", "Technology"],
      ["auditor", "Fatima Al-Suwaidi", "Chief Internal Auditor", "Audit"],
    ],
  },
] as const satisfies ReadonlyArray<{ people: ReadonlyArray<readonly [Role, string, string, string]> } & Record<string, unknown>>;

/** The domain packs (FD §4; eight, plus four added 9 Nov 2026), in priority order. They extend one shared graph; none is a separate product. */
const DOMAIN_PACKS = [
  { key: "sovereign_capital", name: "Sovereign capital, treasury and investment", status: "active", entityTypes: ["institution", "mandate", "holding"], description: "Mandates, holdings and exposures. The central decision context; portfolio data here is synthetic." },
  { key: "energy", name: "Energy, oil and gas", status: "active", entityTypes: ["field", "facility", "pipeline", "refinery", "terminal", "chokepoint"], description: "First full pack: fields, processing, pipelines, terminals and the Hormuz anchor case." },
  { key: "banking", name: "Banking and fintech", status: "configured", entityTypes: ["country", "holding"], description: "Exposure and liquidity scenarios; not a core banking replacement." },
  { key: "supply_chain", name: "Supply chain and logistics", status: "active", entityTypes: ["port", "route", "airport", "commodity", "vessel"], description: "Ports, corridors, routes and alternatives through which disruption propagates." },
  { key: "infrastructure", name: "Infrastructure and utilities", status: "active", entityTypes: ["desalination", "power_plant", "city"], description: "Water and power dependencies for service continuity and resilience." },
  { key: "manufacturing", name: "Manufacturing and industrials", status: "configured", entityTypes: ["refinery", "holding"], description: "Production and supplier relationships, reusing the energy and logistics graph." },
  { key: "construction_real_estate", name: "Construction and real estate", status: "configured", entityTypes: ["city", "holding"], description: "Later pack for project, asset and counterparty dependencies." },
  { key: "insurance", name: "Insurance", status: "configured", entityTypes: ["vessel", "sanctions_regime", "holding"], description: "Marine and war-risk exposure; scenario analysis only until actuarial controls exist." },
  { key: "defence_security", name: "Defence and security", status: "configured", entityTypes: ["chokepoint", "port", "airport", "facility"], description: "Maritime security, navigation safety and critical sites. Added 9 Nov 2026; vessels and infrastructure only, no tracking of people." },
  { key: "healthcare", name: "Healthcare", status: "configured", entityTypes: ["city", "airport", "port", "commodity"], description: "Medicine supply, cold chain and hospital capacity. Added 9 Nov 2026." },
  { key: "telecoms", name: "Telecoms and digital", status: "configured", entityTypes: ["city", "facility", "chokepoint"], description: "Subsea cables, data centres and network resilience. Added 9 Nov 2026." },
  { key: "transport_aviation", name: "Transport and aviation", status: "configured", entityTypes: ["airport", "port", "route", "city"], description: "Airports, air corridors, ports and road freight. Added 9 Nov 2026." },
] as const;

const slugName = (n: string) => n.toLowerCase().replace(/^dr\.\s*/, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

/** Drops all demo data and seeds a clean state. Runs as the database owner. */
/**
 * One sample gap diagnostic per institution, so the module opens on a report. The answers are synthetic and
 * the row says so; the asset figure is a fictional round number for a fictional institution.
 */
const SAMPLE_DIAGNOSTIC: Record<string, { aumUsd: number; scores: Record<string, number> }> = {
  GSF: { aumUsd: 650e9, scores: { "frag.handoffs": 1, "frag.view": 1, "gov.speed": 1, "gov.rules": 2, "mem.find": 2, "mem.leavers": 1, "cap.mapped": 2, "cap.exposure": 1, "drift.record": 2, "drift.check": 1, "sov.hosting": 2, "sov.models": 1, "val.production": 1, "val.tracking": 2 } },
  ANIA: { aumUsd: 300e9, scores: { "frag.handoffs": 2, "frag.view": 1, "gov.speed": 2, "gov.rules": 2, "mem.find": 1, "mem.leavers": 1, "cap.mapped": 1, "cap.exposure": 1, "drift.record": 2, "drift.check": 2, "sov.hosting": 3, "sov.models": 2, "val.production": 1, "val.tracking": 1 } },
};
/** One synthetic, committee-approved decision envelope per institution, so the single-authoriser path can be shown. */
async function seedEnvelope(tx: Tx, institutionId: string, exec: { id: string; name: string }, approver: { id: string; name: string }) {
  const r = await proposeEnvelope(tx, institutionId, { id: exec.id, label: exec.name, role: "executive" }, {
    name: "Energy continuity, board items", mandate: "Protect export continuity and national supply in an energy disruption, within the board's risk appetite, without waiting for an emergency committee.",
    domain: "energy", authority: "Board investment committee", maxVarUsd: ENVELOPE_SAMPLE_LIMIT_USD, authoriserRoles: ["approver", "executive"], validDays: 90,
  });
  if (r.status !== 200) throw new Error(`Sample envelope refused: ${r.message}`);
  await activateEnvelope(tx, institutionId, { id: approver.id, label: approver.name, role: "approver" }, r.envelopeId, "Approved by the board investment committee for the demonstration (synthetic).");
  await tx.query("UPDATE decision_envelopes SET data_mode = 'synthetic' WHERE id = $1", [r.envelopeId]);
}

async function seedDiagnostic(tx: Tx, institutionId: string, shortName: string, analyst: { id: string; name: string }) {
  const sample = SAMPLE_DIAGNOSTIC[shortName] ?? SAMPLE_DIAGNOSTIC.GSF!;
  await saveAssessment(tx, institutionId, { id: analyst.id, label: analyst.name, role: "analyst" }, {
    title: "Sample gap diagnostic (synthetic answers)", subjectLabel: `${shortName} · whole institution`, priority: "How exposed are our holdings and national supply if the Strait of Hormuz is disrupted for 30 days, and who decides what?", aumUsd: sample.aumUsd, dataMode: "synthetic",
    answers: Object.entries(sample.scores).map(([questionId, score]) => ({ questionId, score, evidence: "self_report" as const })),
  });
}

export async function resetDemo() {
  await migrate(() => {});
  const pool = ownerPool();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock($1)", [RESET_LOCK]); // waits for any running import, then keeps the worker out
    await c.query("TRUNCATE package_tasks, decision_packages, engagement_inputs, engagement_assumptions, engagements, decision_envelopes, diagnostic_assessments, backtest_runs, precedents, handoff_updates, handoffs, decision_approvals, decisions, policy_versions, case_briefs, confidence_adjustments, recommendation_feedback, recommendations, model_calls, agent_steps, agent_runs, sovereignty_settings, scenario_result_inputs, scenario_results, scenario_assumptions, scenario_runs, notifications, case_comments, case_events, case_entities, case_evidence, case_signals, case_participants, cases, signal_entities, signal_evidence, signals, graph_snapshots, relationship_evidence, entity_relationships, entity_aliases, entities, domain_packs, evidence_facts, validation_runs, evidence_objects, ingestion_jobs, trusted_signers, sources, audit_events, sessions, principal_roles, principals, divisions, institutions, roles CASCADE");
    for (const r of ROLES) await c.query("INSERT INTO roles (key, label) VALUES ($1,$2)", [r, ROLE_LABELS[r]]);
    for (const inst of DEMO_INSTITUTIONS) {
      await c.query(
        `INSERT INTO institutions (id, slug, name, short_name, buyer_category, country, residency) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [inst.id, inst.slug, inst.name, inst.shortName, inst.buyerCategory, inst.country, inst.residency],
      );
      // Tables are under FORCE row-level security, so even the owner seeds inside the tenant scope.
      await c.query("SELECT set_config('app.institution_id', $1, true)", [inst.id]);
      const divIds = new Map<string, string>();
      const peopleByRole = new Map<string, { id: string; name: string }>();
      for (const d of inst.divisions) {
        const r = await c.query("INSERT INTO divisions (institution_id, name) VALUES ($1,$2) RETURNING id", [inst.id, d]);
        divIds.set(d, r.rows[0].id);
      }
      for (const [role, name, title, division] of inst.people) {
        const email = `${slugName(name)}@${inst.domain}`;
        const r = await c.query(
          `INSERT INTO principals (institution_id, division_id, idp_issuer, idp_subject, display_name, title, email)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [inst.id, divIds.get(division), `https://idp.${inst.domain}/saml (simulated)`, email, name, title, email],
        );
        await c.query("INSERT INTO principal_roles (institution_id, principal_id, role_key) VALUES ($1,$2,$3)", [inst.id, r.rows[0].id, role]);
        peopleByRole.set(role, { id: r.rows[0].id, name });
      }
      // Each institution keeps its own source registry and its own list of trusted package signers.
      for (const src of SOURCE_CATALOG) {
        await c.query(
          `INSERT INTO sources (institution_id, key, name, publisher, source_class, country, access_method, url, licence, owner_label, allowed_purposes, cadence, freshness_limit_hours, status, status_note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [inst.id, src.key, src.name, src.publisher, src.sourceClass, src.country, src.accessMethod, src.url, src.licence, peopleByRole.get(src.ownerRole)?.name ?? "Unassigned",
            src.purposes, src.cadence, src.freshnessLimitHours, src.status, src.statusNote ?? null],
        );
      }
      const pub = await readFile(PUBKEY, "utf8").catch(() => undefined);
      if (pub) {
        const fp = createHash("sha256").update(createPublicKey(pub).export({ type: "spki", format: "der" })).digest("hex").slice(0, 32);
        await c.query("INSERT INTO trusted_signers (institution_id, name, public_key_pem, fingerprint) VALUES ($1,$2,$3,$4)", [inst.id, "TIGERIS public-data collector (demonstration)", pub, fp]);
      }
      const admin = peopleByRole.get("administrator")!;
      // Sovereignty defaults: foreign models cut, outbound off, local model and deterministic writer only (Q063).
      await c.query("INSERT INTO sovereignty_settings (institution_id) VALUES ($1)", [inst.id]);
      await seedPrecedents(c, inst.id);
      // Policy v1: the default rules, tested before activation like any later version (Q090).
      const pol = compile(DEFAULT_POLICY);
      await c.query("INSERT INTO policy_versions (institution_id, version, status, source, compiled, test_results, tests_passed, content_hash, note, created_by_label, activated_by_label, activated_at) VALUES ($1,1,'active',$2,$3,$4,$5,$6,$7,'System default','System default',now())",
        [inst.id, DEFAULT_POLICY, JSON.stringify(pol.policy), JSON.stringify(runTests(pol.policy!, pol.hash)), runTests(pol.policy!, pol.hash).every((t) => t.pass), pol.hash, "Default rule set for the demonstration"]);
      for (const pkg of await allBundledPackages()) {
        const bytes = await readFile(path.join(PACKAGES, pkg));
        await enqueue(c, { institutionId: inst.id, kind: "package_import", label: pkg, bytes, actorId: admin.id, actorLabel: admin.name, actorRole: "administrator" });
      }
      for (const [i, d] of DOMAIN_PACKS.entries()) {
        await c.query("INSERT INTO domain_packs (institution_id, key, name, description, status, entity_types, priority) VALUES ($1,$2,$3,$4,$5,$6,$7)", [inst.id, d.key, d.name, d.description, d.status, d.entityTypes, i + 1]);
      }
      await appendAudit(c, inst.id, {
        actorType: "service", actorId: "demo-seeder", actorLabel: "Demo seeder", action: "demo.reset",
        resourceType: "institution", resourceId: inst.id, details: { people: inst.people.length, divisions: inst.divisions.length },
      });
    }
    await c.query("ALTER SEQUENCE case_number_seq RESTART WITH 1");
    await c.query("COMMIT");
    // Refresh table statistics after each import: straight after the truncate the planner thinks the tables are
    // empty and picks plans that take minutes once they fill (this made resets, and test setup, slow and flaky).
    while (await processNext()) await c.query("ANALYZE evidence_facts, evidence_objects, entities, entity_relationships");
    // Storyline after the graph exists: signals and cases link to entities and evidence.
    for (const inst of DEMO_INSTITUTIONS) {
      await withTenant(inst.id, async (tx) => {
        const people = new Map((await tx.query("SELECT pr.role_key, p.id, p.display_name AS name FROM principals p JOIN principal_roles pr ON pr.principal_id = p.id")).rows.map((r) => [r.role_key, { id: r.id, name: r.name }]));
        await seedStoryline(tx, inst.id, inst.shortName, people);
        await seedDiagnostic(tx, inst.id, inst.shortName, people.get("analyst")!);
        await seedEnvelope(tx, inst.id, people.get("executive")!, people.get("approver")!);
        if (inst.shortName === "GSF") { const an = people.get("analyst")!; await seedFundA(tx, inst.id, { id: an.id, label: an.name, role: "analyst" }); }
      });
    }
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
