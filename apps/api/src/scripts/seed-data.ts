import { ROLES, ROLE_LABELS, type Role } from "@tigeris/shared";
import { ownerPool } from "../db";
import { appendAudit } from "../audit";
import { migrate } from "./migrate";

/**
 * Demo institutions are fictional (Q025). They are labelled by buyer category only (Q123).
 * Stable IDs keep links and tests predictable across resets.
 */
export const DEMO_INSTITUTIONS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "gulf-sovereign-fund",
    name: "Gulf Sovereign Fund",
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

const slugName = (n: string) => n.toLowerCase().replace(/^dr\.\s*/, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

/** Drops all demo data and seeds a clean state. Runs as the database owner. */
export async function resetDemo() {
  await migrate(() => {});
  const pool = ownerPool();
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("TRUNCATE audit_events, sessions, principal_roles, principals, divisions, institutions, roles CASCADE");
    for (const r of ROLES) await c.query("INSERT INTO roles (key, label) VALUES ($1,$2)", [r, ROLE_LABELS[r]]);
    for (const inst of DEMO_INSTITUTIONS) {
      await c.query(
        `INSERT INTO institutions (id, slug, name, short_name, buyer_category, country, residency) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [inst.id, inst.slug, inst.name, inst.shortName, inst.buyerCategory, inst.country, inst.residency],
      );
      // Tables are under FORCE row-level security, so even the owner seeds inside the tenant scope.
      await c.query("SELECT set_config('app.institution_id', $1, true)", [inst.id]);
      const divIds = new Map<string, string>();
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
      }
      await appendAudit(c, inst.id, {
        actorType: "service", actorId: "demo-seeder", actorLabel: "Demo seeder", action: "demo.reset",
        resourceType: "institution", resourceId: inst.id, details: { people: inst.people.length, divisions: inst.divisions.length },
      });
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
