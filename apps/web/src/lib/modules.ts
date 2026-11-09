import type { I18nKey } from "./i18n";

export interface ModuleDef {
  slug: string;
  nav: I18nKey;
  group: "operate" | "know" | "control" | "meta";
  icon: string; // lucide icon name, resolved in the sidebar
  purpose: string;
  arrives: { week: number; items: string[] }[];
  requirements: string[];
}

/** The PRD's 11 modules plus Reports, Architecture and About (Q028, Q030, Q036). */
export const MODULES: ModuleDef[] = [
  {
    slug: "command-centre", nav: "nav.command-centre", group: "operate", icon: "LayoutGrid",
    purpose: "Where attention is needed now: priority signals, open cases, pending approvals, stale sources and the next task, beside a live map of the Gulf.",
    arrives: [
      { week: 3, items: ["Attention queue with the reason each item is surfaced", "Pending approvals and source-health exceptions"] },
      { week: 4, items: ["GCC map panel with ships, assets and active events"] },
    ],
    requirements: ["PRD §6", "UX §8"],
  },
  {
    slug: "diagnostic", nav: "nav.diagnostic", group: "operate", icon: "Gauge",
    purpose: "Sovereign gap diagnostic: seven gaps scored with their evidence, value at stake as a planning range, and before and after TIGERIS.",
    arrives: [{ week: 9, items: ["Gap diagnostic with saved, audited assessments", "Public readiness check for the website"] }],
    requirements: ["Commercial model, steps 1 to 3"],
  },
  {
    slug: "signals", nav: "nav.signals", group: "operate", icon: "RadioTower",
    purpose: "Validated, unvalidated, conflicting and dismissed signals, with source, freshness, corroboration and disposition.",
    arrives: [
      { week: 4, items: ["Signals placed on the movement map"] },
    ],
    requirements: ["FR-09", "FR-10", "TR-009"],
  },
  {
    slug: "cases", nav: "nav.cases", group: "operate", icon: "FolderKanban",
    purpose: "The primary work object. Each case connects situation, evidence, impact graph, scenarios, options, governance, decision and memory.",
    arrives: [
      { week: 3, items: ["Eight case states from Detected to Closed", "Case workspace tabs, comments and mentions"] },
      { week: 6, items: ["Ask TIGERIS inside the case, grounded on its evidence", "One-page executive brief export"] },
      { week: 8, items: ["Hormuz, resilience and oil USD 45 at full depth; four medium cases; two short cases"] },
    ],
    requirements: ["FR-33", "FR-35", "App Flow §4"],
  },
  {
    slug: "graph", nav: "nav.graph", group: "operate", icon: "Waypoints",
    purpose: "Shared institutional ontology: countries, chokepoints, routes, ports, assets, suppliers, mandates and exposures, with every link labelled observed, sourced, inferred or assumed.",
    arrives: [
      { week: 3, items: ["About 1,000 GCC entities with real geography", "Path tracing with direction, time validity and evidence per edge"] },
      { week: 6, items: ["Plain-language questions about the graph"] },
    ],
    requirements: ["FR-13", "FR-16", "TR-021"],
  },
  {
    slug: "map", nav: "nav.map", group: "operate", icon: "MapPinned",
    purpose: "Ships, trucks, infrastructure and active signals across the GCC, with replay, simulated live mode and scenario overlays.",
    arrives: [], requirements: ["MAP §2–9", "FR-29", "FR-30"],
  },
  {
    slug: "scenarios", nav: "nav.scenarios", group: "operate", icon: "LineChart",
    purpose: "Baseline and what-if comparisons across 72 hours, 90 days, one year and five years, with assumptions, ranges and replay.",
    arrives: [
      { week: 5, items: ["Seven adjustable drivers", "Deterministic values and Monte Carlo ranges", "Hormuz day-by-day cascade to about day 150", "Structural resilience score"] },
    ],
    requirements: ["FR-26", "FR-27", "TR-035"],
  },
  {
    slug: "decisions", nav: "nav.decisions", group: "operate", icon: "Gavel",
    purpose: "Recommendations awaiting a named human decision, with policy result, required authority and separation of duties.",
    arrives: [
      { week: 7, items: ["Approve, reject, defer or request evidence", "Approval rules configurable per action type", "Operations handoff tracking"] },
    ],
    requirements: ["FR-34", "FR-35", "TR-046"],
  },
  {
    slug: "domains", nav: "nav.domains", group: "know", icon: "Layers",
    purpose: "Eight domain packs that extend the shared graph and workflows: sovereign capital, energy, banking, supply chain, infrastructure and utilities, manufacturing, construction and real estate, insurance.",
    arrives: [{ week: 3, items: ["Domain pack registry with ontology extensions"] }, { week: 8, items: ["Domain views linked to their cases"] }],
    requirements: ["FD §4", "TR-024"],
  },
  {
    slug: "memory", nav: "nav.memory", group: "know", icon: "Library",
    purpose: "Approved decisions, rationale, outcomes and lessons, searchable by keyword and by meaning, inside this institution only.",
    arrives: [{ week: 7, items: ["About 50 precedent decisions", "Keyword and semantic search", "Decision drift against mandate", "Recommendations re-ranked from human feedback"] }],
    requirements: ["FR-41", "FR-42"],
  },
  {
    slug: "reports", nav: "nav.reports", group: "know", icon: "FileText",
    purpose: "Case briefs, back-test results and governance reports, each carrying its classification and source labels.",
    arrives: [{ week: 8, items: ["Back-test report from a real historical replay", "Export with redaction and classification"] }],
    requirements: ["AC-12", "Q030"],
  },
  {
    slug: "sources", nav: "nav.sources", group: "control", icon: "Database",
    purpose: "Source registry: owner, licence, purpose, refresh cadence, freshness, lineage and quarantine for every source.",
    arrives: [{ week: 3, items: ["Signals raised from validated evidence", "Simulated live signal stream, clearly labelled"] }],
    requirements: ["FR-06", "FR-08", "TR-017"],
  },
  {
    slug: "sovereignty", nav: "nav.sovereignty", group: "control", icon: "Landmark",
    purpose: "What stays inside the institution's control, layer by layer, checked live; keys and cryptography with the pilot plan.",
    arrives: [{ week: 9, items: ["Sovereignty stack with live checks", "Keys and cryptography inventory", "Pilot plan for HSM, confidential computing and post-quantum cryptography"] }],
    requirements: ["Q063", "TR-046"],
  },
  {
    slug: "governance", nav: "nav.governance", group: "control", icon: "ShieldCheck",
    purpose: "Audit trail, isolation checks, policy rules and sovereignty controls.",
    arrives: [{ week: 6, items: ["Offline switch, outbound blocking and model allowlist"] }, { week: 7, items: ["Policy-as-code editor with tests", "Decision replay from the audit trail", "Security posture page"] }],
    requirements: ["FR-36", "FR-40", "TR-042"],
  },
  {
    slug: "administration", nav: "nav.administration", group: "control", icon: "Settings2",
    purpose: "Institution, divisions, people and roles, retention and deployment settings.",
    arrives: [{ week: 7, items: ["Retention and export settings", "Model and source allowlists"] }],
    requirements: ["FR-03", "TR §11.1"],
  },
  {
    slug: "architecture", nav: "nav.architecture", group: "meta", icon: "Network",
    purpose: "Interactive one-slide architecture for investors and their CTOs.",
    arrives: [{ week: 8, items: ["Clickable layers linked to the live components"] }],
    requirements: ["Q036", "AC-12"],
  },
  {
    slug: "about", nav: "nav.about", group: "meta", icon: "Info",
    purpose: "What TIGERIS is, and what this demonstration does and does not claim.",
    arrives: [],
    requirements: ["FD §3"],
  },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
