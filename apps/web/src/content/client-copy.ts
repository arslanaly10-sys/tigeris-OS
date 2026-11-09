/**
 * The client's approved website copy (tigercapital.ai), used VERBATIM per brief v3 §13A. Edit it here only, and never
 * reword it: if the client changes their site, copy the new text in exactly.
 */

export const WELCOME = {
  eyebrow: "Private Institutional Briefing · Sovereign Alignment",
  headline: "An invitation to shape the Sovereign Intelligence Operating System.",
  body: [
    "TIGERIS AI OS is under active development, advancing a new AI-native architecture for sovereign intelligence and institutional capability.",
    "We invite sovereign states, sovereign wealth funds and strategic economic authorities to engage in private institutional briefings exploring its architecture, strategic applications and deployment priorities.",
    "These engagements are intended to establish strategic alignment and identify potential founding partners in shaping the next generation of sovereign intelligence infrastructure.",
  ],
} as const;

/** "01 TIGERIS Principles". `proof` is our addition: where the prototype demonstrates the principle. */
export const PRINCIPLES = [
  { n: "01", title: "Architecture Before Application", text: "Intelligence is an integrated sovereign operating substrate, not a conversational layer or a collection of disconnected applications.", proof: { label: "The L1–L4 architecture", href: "/architecture" } },
  { n: "02", title: "End to End Provenance", text: "Every scenario, inference and recommendation is designed to preserve its evidence, assumptions, source records and reasoning lineage.", proof: { label: "Lineage on every figure", href: "/sources" } },
  { n: "03", title: "Sovereign Authority and Governed Execution", text: "Agentic intelligence operates within defined institutional authority, human oversight, approval thresholds and auditable execution controls.", proof: { label: "Authority, approvals and envelopes", href: "/decisions" } },
  { n: "04", title: "Compounding Institutional Memory", text: "Every governed decision, simulation and observed outcome contributes to institutional memory, strengthening future decisions and enduring sovereign capability.", proof: { label: "Institutional memory", href: "/memory" } },
] as const;

/** "02 Strategic Use Cases". `status` is ours: only scenario 02 runs in this prototype. */
export const USE_CASES = [
  { n: "01", title: "Capital Intelligence and Sovereign Allocation", text: "Macro synthesis across multi asset sovereign reserves, stress testing geopolitical shocks before they reach the balance sheet.", status: "pilot" as const },
  { n: "02", title: "Trade Corridor and Critical Supply Resilience", text: "Simulation of maritime and logistics choke points, modeling commodity availability and reserve reallocation ahead of market friction.", status: "live" as const },
  { n: "03", title: "National Compute Orchestration and Sovereign AI", text: "Coordinating sovereign compute clusters, energy demand and localized foundational models under strict data sovereignty.", status: "pilot" as const },
  { n: "04", title: "Bilateral Economic Diplomacy and Co Investment", text: "Counterparty intelligence, sovereign FDI impact evaluation and technology transfer verification.", status: "pilot" as const },
  { n: "05", title: "National Development and Regulatory Intelligence", text: "Modeling the economic, institutional and cross sector implications of national policies, regulatory changes and strategic development initiatives.", status: "pilot" as const },
];

export const ENGAGEMENT_FORMATS = [
  { title: "Executive Council Briefing", text: "a private 60-minute strategic briefing introducing the TIGERIS architecture, institutional applications and potential deployment pathways." },
  { title: "Sovereign Intelligence Simulation Workshop", text: "a half-day working session using illustrative national scenarios to explore cross-sector intelligence, foresight, governance and coordinated decision making." },
] as const;

export const DISCLAIMER = "Information submitted through this form will be used to assess and coordinate the requested institutional engagement. Please do not submit classified, restricted or otherwise sensitive information through this form. This page is not an offer of securities or services.";

/** The /briefing form's options, copied exactly (brief v3 §7.1). */
export const INTAKE = {
  categories: ["Sovereign Wealth Fund", "Government Ministry or Authority", "National Development or Economic Planning Authority", "Regulatory Authority", "Central Bank or Monetary Authority", "Royal Court or Family Office", "Strategic Infrastructure Entity"],
  jurisdictions: ["Kingdom of Saudi Arabia", "United Arab Emirates", "Qatar", "North America", "United Kingdom and Europe", "Asia Pacific"],
  interests: ["Sovereign Capital Intelligence and Allocation", "National Economic Transformation and Development", "Geopolitical Foresight and Scenario Simulation", "Trade, Energy and Critical Supply Resilience", "Sovereign AI and National Compute Infrastructure", "Cross Border Investment and Economic Diplomacy", "Institutional Governance, Memory and Continuity", "Regulatory and Policy Impact Intelligence"],
  postures: ["Founding Sovereign Anchor", "Strategic Capital Co-Investor", "Early Government Deployment Pilot", "Bilateral Knowledge Exchange"],
  windows: ["30 days", "60 days", "90 days", "Exploratory"],
  formats: ["In Person Riyadh", "In Person DIFC", "Executive Session Miami", "Secure Virtual Council"],
} as const;

/** The site's own loop line (boot screen) and descriptor. */
export const LOOP_LINE = ["Observe", "Reason", "Simulate", "Govern", "Execute", "Learn"] as const;
export const DOCTRINE = "AI ≠ Sovereign Intelligence";
