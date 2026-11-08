/**
 * The ten bounded agents (FR-17..FR-24, Q060). Each agent has a fixed purpose, a fixed list of
 * tools (deterministic data access only), and things it may never do. Agents never write numbers:
 * numbers come from tools; a model may only phrase them, with citations, through the gateway.
 */
export interface AgentSpec {
  key: string;
  name: string;
  purpose: string;
  tools: string[];
  may: string[];
  mayNot: string[];
}

export const AGENTS: AgentSpec[] = [
  { key: "signal_triage", name: "Signal triage", purpose: "Ranks the case's signals by urgency, impact and confidence and says which matter first.",
    tools: ["case.signals", "signal.confidence"], may: ["Rank signals", "Explain the ranking"], mayNot: ["Dismiss or close a signal", "Change a signal's status"] },
  { key: "noise_moderation", name: "Noise moderation", purpose: "Flags simulated, synthetic, stale, duplicate or quarantined inputs before they are relied on.",
    tools: ["case.signals", "evidence.validation", "evidence.quarantine"], may: ["Flag inputs", "Challenge other agents"], mayNot: ["Delete or edit evidence"] },
  { key: "entity_resolution", name: "Entity resolution", purpose: "Matches names in signals and documents to entities in the graph and lists what it could not match.",
    tools: ["graph.entities", "graph.aliases"], may: ["Propose matches"], mayNot: ["Merge or create entities"] },
  { key: "document_extraction", name: "Document extraction", purpose: "Summarises the facts that deterministic parsers extracted from the case's evidence.",
    tools: ["evidence.facts", "evidence.objects"], may: ["Summarise extracted facts"], mayNot: ["Create facts", "Read quarantined content"] },
  { key: "causal_impact", name: "Causal impact", purpose: "Traces how the event propagates through the graph to holdings, mandates and national dependencies.",
    tools: ["graph.impact_paths"], may: ["Explain propagation paths"], mayNot: ["Add or change relationships"] },
  { key: "financial_impact", name: "Financial impact", purpose: "Reads value at risk, export revenue and exposures from the deterministic scenario engine.",
    tools: ["scenario.latest", "scenario.run_baseline"], may: ["Report engine outputs"], mayNot: ["Calculate or estimate numbers itself"] },
  { key: "scenario_analyst", name: "Scenario analyst", purpose: "Compares the baseline with alternatives, reads sensitivity, and measures each option's effect with the engine.",
    tools: ["scenario.compare", "scenario.sensitivity", "engine.run_option"], may: ["Compare scenarios", "Score options"], mayNot: ["Change the baseline", "Tune parameters"] },
  { key: "sector", name: "Sector agents", purpose: "Energy, food security, banking, logistics and insurance specialists who apply their sector's lens and challenge the others.",
    tools: ["domain.facts", "graph.entities"], may: ["Add sector context", "Challenge other agents"], mayNot: ["Override engine outputs"] },
  { key: "governance_checker", name: "Governance checker", purpose: "Checks every option against the policy rules: authority, separation of duties, evidence sufficiency and no external action.",
    tools: ["policy.rules", "case.participants"], may: ["Return PASS or HOLD with reasons"], mayNot: ["Approve or execute anything"] },
  { key: "brief_writer", name: "Brief writer", purpose: "Drafts the executive brief from the other agents' checked outputs only.",
    tools: ["agent_run.outputs"], may: ["Draft the brief"], mayNot: ["Add claims that are not in the checked outputs"] },
];

export const AGENT_NAME: Record<string, string> = Object.fromEntries(AGENTS.map((a) => [a.key, a.name]));

/** Sector lenses used by the sector agents, keyed by case domain. */
export const SECTOR_LENS: Record<string, { name: string; focus: string }> = {
  energy: { name: "Energy sector agent", focus: "export routes, bypass capacity and price" },
  infrastructure: { name: "Infrastructure sector agent", focus: "power, water and desalination continuity" },
  sovereign_capital: { name: "Sovereign capital sector agent", focus: "portfolio concentration and liquidity" },
  supply_chain: { name: "Logistics sector agent", focus: "ports, transit times and alternative supply" },
  banking: { name: "Banking sector agent", focus: "funding costs and liquidity of bank holdings" },
  insurance: { name: "Insurance sector agent", focus: "war-risk cover and sanctions exposure" },
  food: { name: "Food security sector agent", focus: "staple reserve cover and import dependency" },
};
