import type { GapKey } from "./diagnostic";

/**
 * Sovereign playbooks: the thirteen worked scenarios from Tiger Capital's TIGERIS demonstration
 * (tigerisos.ai), in Tiger's wording; a few lines the site leaves implicit (some frictions and
 * counterfactuals) are filled in to match. Each runs the same governed loop and specialist hand-off.
 * They are illustrative: no connected evidence, live transactions or measured value.
 */

/** The six governed stages that connect sovereign intent to enduring capability. */
export const LOOP_STAGES = [
  { key: "intent", name: "Intent", body: "Mandate boundaries, intergenerational hurdle rates and non-negotiable policy redlines are established before any signal is considered." },
  { key: "propagate", name: "Propagate", body: "Verified signals propagate across the sovereign intelligence graph, exposing first, second and third-order consequences across assets and institutions." },
  { key: "challenge", name: "Challenge", body: "Domain specialist agents challenge the decision: mandate guardianship, governance constraints, capital stewardship and counterfactual stress." },
  { key: "resilience", name: "Resilience", body: "Absorptive, recovery and adaptive capacity are evaluated against the sovereign balance sheet and critical corridors before commitment." },
  { key: "authorize", name: "Authorize", body: "The proposed path is weighed against the counterfactual. Trade-offs are exposed. Authorization remains with the appropriate human sovereign authority." },
  { key: "remember", name: "Remember", body: "Outcomes are recorded as institutional memory. Every decision, precedent and evidence trail compounds into enduring sovereign capability." },
] as const;

/** The specialist chain every playbook passes through, in order. */
export const SPECIALISTS = ["Sentinel", "Macro", "Resilience", "Capital", "Mandate", "Governance"] as const;

/**
 * Tiger's decision-envelope doctrine: "Speed with authority. Never speed instead of authority." Envelopes are
 * pre-approved by the committee; every action inside one still needs human authorization. A recommendation is
 * promoted to the sovereign council only when the specialists' aggregate confidence reaches this threshold.
 */
export const COUNCIL_PROMOTION_THRESHOLD = 0.75;

export interface Playbook {
  key: string;
  title: string;
  gaps: GapKey[];
  /** Case domain and scenario-engine template used when a case is started from the playbook. */
  domain: string;
  template: string;
  intent: string;
  scenario: string;
  doctrine: string;
  constraint: string;
  /** How the problem shows up today (not every playbook lists these). */
  frictions: string[];
  /** Five hand-offs: Sentinel to Macro, Macro to Resilience, Resilience to Capital, Capital to Mandate, Mandate to Governance. */
  handoffs: [string, string, string, string, string];
  graph: string;
  recommended: string;
  counterfactual: string;
  tradeoff: string;
  outcome: string;
  validate: string;
  memory: string;
  /** Where the same pattern can be seen working in this OS, if anywhere. */
  inOs?: { label: string; href: string };
}

export const PLAYBOOKS: Playbook[] = [
  {
    key: "energy-export", title: "Energy export continuity", gaps: ["fragmentation", "capital_orchestration"],
    domain: "energy", template: "hormuz",
    intent: "Protect sovereign export continuity and fiscal stability without breaching strategic reserve floors.",
    scenario: "Hypothetical Hormuz transit restriction coincides with tanker delays and rising insurance exposure.",
    doctrine: "Strategic autonomy through energy continuity.",
    constraint: "Reserve floor protected. Treasury approval required for liquidity support. Operators retain dispatch authority.",
    frictions: [],
    handoffs: [
      "Test transit restriction against export schedules. Source agreement is assumed, not attested.",
      "Delayed receipts intersect reserve requirements. Test storage and alternate capacity.",
      "Stage reserve sequencing against confirmed terminal capacity, not a blanket reroute.",
      "Propose a liquidity buffer. Protect the reserve floor and strategic investment commitments.",
      "Retain operator dispatch rights and treasury approval. Prepare both options for principals.",
    ],
    graph: "The graph promotes export terminals and fiscal receipts, activates energy and treasury specialists, and recalls reserve policy.",
    recommended: "Stage reserve sequencing and alternate export capacity with a temporary liquidity buffer.",
    counterfactual: "Hold the current export schedule and fund delayed receipts from existing liquidity.",
    tradeoff: "Alternate capacity may preserve receipts but increases transport cost. Reserve use narrows future shock capacity.",
    outcome: "Illustrative path preserves export optionality and protects fiscal commitments within the reserve floor.",
    validate: "Compare actual export receipts, logistics costs and reserve balances against the agreed baseline before claiming realized value.",
    memory: "Retain the corridor dependency map, reserve constraint and operator capacity assumptions for the next energy shock.",
    inOs: { label: "The Strait of Hormuz case", href: "/cases/GSF-2026-0001" },
  },
  {
    key: "food-imports", title: "Essential food imports", gaps: ["fragmentation", "sovereign_control"],
    domain: "supply_chain", template: "food",
    intent: "Maintain access to essential food imports while preserving affordability and national buffer capacity.",
    scenario: "Hypothetical port congestion delays grain imports while inland warehouse stocks decline.",
    doctrine: "National continuity through diversified supply dependencies.",
    constraint: "Food reserve minimum retained. Emergency procurement requires designated ministry approval.",
    frictions: [],
    handoffs: [
      "Import arrival delays intersect falling warehouse coverage in the scenario.",
      "Model regional availability, not just aggregate national stock.",
      "Test alternate unloading slots and inland delivery before using reserves.",
      "Compare emergency freight funding with phased procurement and reserve sequencing.",
      "Preserve the reserve minimum. Procurement authority remains with designated principals.",
    ],
    graph: "The graph replaces export dependencies with port, stock and distribution links. Supply specialists receive the food security mandate.",
    recommended: "Diversify unloading slots and stage regional distribution with bounded reserve support.",
    counterfactual: "Wait for the original port backlog to clear and rely on existing warehouse coverage.",
    tradeoff: "Alternate freight costs more. Waiting conserves reserves but exposes underserved regions to shortages.",
    outcome: "Illustrative path improves essential supply continuity while retaining the national reserve minimum.",
    validate: "Validate delivered volumes, regional availability, landed cost and remaining buffer before attributing value.",
    memory: "Preserve port capacity assumptions, regional stock dependencies and the procurement approval sequence.",
    inOs: { label: "The food-security domain", href: "/domains" },
  },
  {
    key: "water-power", title: "Water and power continuity", gaps: ["fragmentation", "capital_orchestration"],
    domain: "infrastructure", template: "resilience",
    intent: "Protect essential water and electricity services while aligning infrastructure capital with national continuity priorities.",
    scenario: "Hypothetical peak demand strains a substation serving desalination and a coastal population centre.",
    doctrine: "Resilience as a sovereign infrastructure capability.",
    constraint: "Essential service priority retained. Grid switching requires operator approval. Capital support follows the investment mandate.",
    frictions: [],
    handoffs: [
      "Model a constrained substation with shared water production dependencies.",
      "Trace critical service exposure through power and water, not separate dashboards.",
      "Test feasible load transfer and storage duration with operator constraints.",
      "Compare targeted network renewal with temporary continuity support.",
      "Separate operator switching rights from investment committee approval.",
    ],
    graph: "Shared power and water nodes become the graph priority. Infrastructure specialists test continuity before capital options are ranked.",
    recommended: "Prioritize critical service supply and prepare targeted renewal of the shared transmission dependency.",
    counterfactual: "Use temporary reserve capacity and defer network renewal pending further demand evidence.",
    tradeoff: "Immediate renewal ties up capital. Temporary cover leaves a recurring shared dependency unresolved.",
    outcome: "Illustrative path prioritizes essential service continuity and links renewal capital to a specific dependency.",
    validate: "Check service interruptions, water availability, network capacity and renewal milestones against the approved baseline.",
    memory: "Store the shared dependency, critical service hierarchy and operator feasibility checks for future demand events.",
    inOs: { label: "Desalination and power on the movement map", href: "/map" },
  },
  {
    key: "industrial-capability", title: "Domestic industrial capability", gaps: ["capital_orchestration", "sovereign_control"],
    domain: "manufacturing", template: "resilience",
    intent: "Strengthen domestic industrial capability and protect strategic production without substituting capital for untested supply assumptions.",
    scenario: "Hypothetical export controls constrain a critical imported component used by domestic manufacturing.",
    doctrine: "Economic diversification through enduring domestic capability.",
    constraint: "Technical qualification precedes supplier substitution. New commitments require investment committee approval.",
    frictions: [],
    handoffs: [
      "Scenario controls affect a critical component, not every industrial input.",
      "Connect output commitments to supplier concentration and qualification time.",
      "Inventory buys time. It does not prove domestic substitution is feasible.",
      "Propose staged domestic capacity funding tied to technical qualification milestones.",
      "Retain procurement and technical signoff. Escalate capital commitments to the committee.",
    ],
    graph: "Supplier and qualification nodes replace shipping costs as dominant links. Industrial specialists connect diversification intent to milestone funding.",
    recommended: "Bridge qualified inventory while staging domestic component capacity against technical milestones.",
    counterfactual: "Secure an alternate imported supplier and defer domestic capacity funding.",
    tradeoff: "Local capacity strengthens autonomy but takes time and capital. Alternate imports retain external dependency.",
    outcome: "Illustrative path connects near term production continuity to a governed domestic capability programme.",
    validate: "Confirm qualified output, supplier concentration, domestic content and capital milestones before recording realized value.",
    memory: "Retain supplier dependencies, qualification gates and investment milestones across future leadership cycles.",
  },
  {
    key: "sovereign-liquidity", title: "Sovereign liquidity posture", gaps: ["capital_orchestration", "governance_velocity"],
    domain: "sovereign_capital", template: "banking",
    intent: "Protect intergenerational capital and domestic strategic commitments through a disciplined sovereign liquidity posture.",
    scenario: "Hypothetical global rate repricing coincides with capital calls and domestic project funding needs.",
    doctrine: "Intergenerational stewardship with governed capital optionality.",
    constraint: "Liquidity floor and concentration limits retained. Asset sales and new allocations require authorized committee decisions.",
    frictions: [],
    handoffs: [
      "Test rate repricing alongside the scenario commitment calendar.",
      "Distinguish valuation pressure from the timing of actual cash obligations.",
      "Compare liquidity coverage under delayed distributions and concurrent calls.",
      "Propose staged funding and a liquid reserve posture without forced strategic asset sales.",
      "Apply the liquidity floor and concentration limits. No allocation changes without committee authority.",
    ],
    graph: "The graph shifts to duration, cash timing and capital calls. Treasury reasoning connects external market signals to domestic commitments.",
    recommended: "Stage funding obligations and preserve liquid reserves while testing commitment timing with counterparties.",
    counterfactual: "Liquidate selected holdings to fund every commitment immediately.",
    tradeoff: "Retaining liquidity may defer optional deployments. Forced sales could crystallize repricing losses and weaken strategic holdings.",
    outcome: "Illustrative path preserves sovereign funding optionality and domestic commitments within policy limits.",
    validate: "Assess cash coverage, funding costs, commitment delivery and policy compliance. No simulated return is treated as realized value.",
    memory: "Preserve the cash dependency graph, committee constraints and commitment timing lessons for the next market regime.",
    inOs: { label: "Scenarios against holdings", href: "/scenarios" },
  },
  {
    key: "execution-leakage", title: "Execution leakage", gaps: ["value_realization", "capital_orchestration"],
    domain: "sovereign_capital", template: "banking",
    intent: "Recover capital lost to execution friction and intermediary layers so more of the mandate return reaches national programmes.",
    scenario: "Hypothetical large rebalancing across external managers meets layered fees, information signalling and slow transitions.",
    doctrine: "Every basis point retained is sovereign capability, not a trading result.",
    constraint: "Manager changes require investment committee approval. Transition sequencing stays within liquidity and concentration limits.",
    frictions: [
      "Allocation intent is diluted as it passes through intermediary layers.",
      "Layered fees and slow transitions leak value before capital is deployed.",
      "Signalling during transitions creates avoidable market impact.",
      "Leaked capital reduces capacity for strategic domestic commitments.",
    ],
    handoffs: [
      "Transition calendar overlaps with thin liquidity windows in the scenario.",
      "Separate unavoidable cost from structural leakage across layers.",
      "Phase the transition. Avoid concentrated exposure while mandates move.",
      "Propose staged internalization measured against an agreed leakage baseline.",
      "Committee retains manager decisions. Record the baseline before any change.",
    ],
    graph: "The graph promotes intermediary and transition nodes. Execution specialists connect leakage sources to the mandate return path.",
    recommended: "Phase a governed internal transition and measure leakage against an agreed baseline.",
    counterfactual: "Retain the current manager structure and renegotiate fees at the next cycle.",
    tradeoff: "Internalization builds capability but requires talent and controls. Status quo preserves continuity and the leakage.",
    outcome: "Illustrative path retains more mandate return for national programmes within policy limits.",
    validate: "Compare realized transition costs and fees against the agreed baseline before attributing recovered value.",
    memory: "Retain leakage sources, transition sequencing and manager terms for the next rebalancing.",
    inOs: { label: "Value at stake in the gap diagnostic", href: "/diagnostic" },
  },
  {
    key: "mandate-drift", title: "Mandate alignment", gaps: ["decision_drift", "capital_orchestration"],
    domain: "sovereign_capital", template: "oil45",
    intent: "Keep the portfolio aligned with evolving national priorities so capital serves the mandate it was entrusted with.",
    scenario: "Hypothetical policy update raises diversification priorities while the portfolio still carries legacy exposures.",
    doctrine: "Alignment is continuous, not an annual exercise.",
    constraint: "Rebalancing stays within concentration limits. Allocation changes require authorized committee decisions.",
    frictions: [
      "A new national priority changes what the mandate requires.",
      "Holdings still reflect the previous policy horizon.",
      "Legacy concentration grows unnoticed in strategic sectors.",
      "Drift surfaces late, compressing time for governed options.",
    ],
    handoffs: [
      "Policy revision recorded. Holdings have not been tested against it.",
      "Quantify the gap between priorities and actual exposure.",
      "Rebalancing must not create new concentration while closing the gap.",
      "Propose a governed path within limits, sequenced across quarters.",
      "Allocation authority remains with the committee. Log the drift register.",
    ],
    graph: "Policy and holdings nodes are linked directly. Mandate specialists test every exposure against the latest priority.",
    recommended: "Stage a governed rebalancing path within concentration limits.",
    counterfactual: "Wait for the next annual strategic allocation review.",
    tradeoff: "Earlier action closes the gap but adds transition cost. Waiting saves cost and extends misalignment.",
    outcome: "Illustrative path narrows the gap between mandate and holdings within policy.",
    validate: "Measure exposure against the updated priorities and limit compliance before claiming alignment.",
    memory: "Retain a drift register tied to each policy revision for future reviews.",
    inOs: { label: "Decision drift checks", href: "/decisions" },
  },
  {
    key: "leadership-memory", title: "Continuity across leadership changes", gaps: ["memory"],
    domain: "sovereign_capital", template: "hormuz",
    intent: "Preserve decision rationale across leadership cycles so continuity does not depend on individuals.",
    scenario: "Hypothetical rotation of senior investment leaders during an active co-investment programme.",
    doctrine: "Continuity does not depend on individuals.",
    constraint: "New commitments wait for rationale review. Counterparty terms follow the approved precedent unless the committee decides otherwise.",
    frictions: [
      "Rationale exists in fragments across memos and inboxes.",
      "Incoming leaders repeat diligence already completed.",
      "Inconsistent terms appear when precedent is not recalled.",
      "Decisions slow while context is rebuilt.",
    ],
    handoffs: [
      "Three active programmes lose their principal sponsor in the scenario.",
      "Identify which commitments depend on undocumented rationale.",
      "Reconstruct the decision lineage before any new tranche.",
      "Propose holding new commitments until rationale is reviewed.",
      "Incoming principals approve continuation with full lineage.",
    ],
    graph: "Memory nodes become central. Prior decisions, constraints and outcomes are recalled into the active programme.",
    recommended: "Rebuild the rationale graph from records before new commitments.",
    counterfactual: "Restart diligence under the incoming leadership.",
    tradeoff: "Reconstruction takes effort upfront. Restarting duplicates work and risks inconsistent terms.",
    outcome: "Illustrative path preserves programme continuity across the leadership transition.",
    validate: "Check diligence duplication, term consistency and commitment timing against the prior record.",
    memory: "Retain the decision lineage so it carries across every future leadership cycle.",
    inOs: { label: "Institutional memory", href: "/memory" },
  },
  {
    key: "decision-velocity", title: "Decision velocity with authority", gaps: ["governance_velocity"],
    domain: "sovereign_capital", template: "oil45",
    intent: "Compress deliberation time so sovereign capital can act within strategic windows without weakening governance.",
    scenario: "Hypothetical market dislocation opens a short entry window while the committee cycle takes weeks.",
    doctrine: "Speed with authority. Never speed instead of authority.",
    constraint: "Decision envelopes are pre-approved by the committee. Every action inside an envelope still requires human authorization.",
    frictions: [
      "The window is detected early but waits for memo drafting.",
      "Sequential drafting consumes most of the window.",
      "Serial reviews repeat the same questions.",
      "Approval arrives after the window has narrowed.",
    ],
    handoffs: [
      "Entry window detected. Historical cycle exceeds the window length.",
      "Test whether the opportunity fits an existing approved envelope.",
      "Prepare the dossier in parallel, not in sequence.",
      "Propose action inside the envelope, sized within limits.",
      "Principals authorize within hours. Envelope rules logged.",
    ],
    graph: "Parallel review nodes replace the sequential chain. Envelope rules connect speed to pre-agreed authority.",
    recommended: "Use a pre-authorized decision envelope with human approval intact.",
    counterfactual: "Convene an ad hoc emergency committee.",
    tradeoff: "Envelopes need upfront design. Ad hoc committees are flexible but slow and inconsistent.",
    outcome: "Illustrative path keeps strategic optionality within governed authority.",
    validate: "Measure decision time, envelope compliance and outcomes against the committee baseline.",
    memory: "Retain envelope rules and missed windows to refine future authority design.",
    inOs: { label: "Policy as code and approvals", href: "/governance" },
  },
  {
    key: "sovereign-intelligence", title: "Sovereign intelligence, not borrowed", gaps: ["sovereign_control"],
    domain: "sovereign_capital", template: "resilience",
    intent: "Turn proprietary sovereign data into sovereign decision intelligence instead of relying on external research and foreign models.",
    scenario: "Hypothetical review finds critical decisions rely on licensed external platforms while internal data stays siloed.",
    doctrine: "Sovereign capital deserves sovereign intelligence.",
    constraint: "Data stays within national jurisdiction. Model changes follow security and governance review.",
    frictions: [
      "Central intelligence is thin while data is distributed.",
      "Rich proprietary data is unused in decisions.",
      "Decisions depend on research outside sovereign control.",
      "Jurisdictional exposure grows with every external dependency.",
    ],
    handoffs: [
      "Most decision inputs originate outside the institution in the scenario.",
      "Map which mandates depend on external interpretation.",
      "Test continuity if an external platform becomes unavailable.",
      "Propose sovereign-hosted intelligence contextualized to the mandate.",
      "Security review precedes any migration. Data residency is non-negotiable.",
    ],
    graph: "Internal data nodes connect to decision nodes. External dependencies are mapped and ranked by mandate exposure.",
    recommended: "Deploy sovereign-hosted intelligence contextualized to the mandate.",
    counterfactual: "Keep licensing external research and platforms.",
    tradeoff: "Sovereign intelligence requires investment and talent. External licensing is faster and keeps the dependency.",
    outcome: "Illustrative path converts proprietary data into a durable sovereign capability.",
    validate: "Assess dependency reduction, data residency compliance and decision quality before attributing value.",
    memory: "Retain the dependency map and data sovereignty record.",
    inOs: { label: "The sovereignty stack", href: "/sovereignty" },
  },
  {
    key: "one-truth", title: "One governed view of exposure", gaps: ["fragmentation"],
    domain: "banking", template: "banking",
    intent: "Give leadership one governed view of exposure so limits are respected across every portfolio.",
    scenario: "Hypothetical review finds risk, treasury, private markets and ESG each report a different exposure to one counterparty.",
    doctrine: "One institution. One truth. Governed lineage.",
    constraint: "No new allocation to the counterparty until exposure is reconciled. Limit breaches escalate to the risk committee.",
    frictions: [
      "Each function reports exposure on its own entity definition.",
      "Systems hold different counterparty hierarchies.",
      "Look-through exposure is not combined.",
      "Concentration stays hidden between reporting cycles.",
    ],
    handoffs: [
      "Four systems disagree on the same counterparty in the scenario.",
      "Resolve entities before measuring concentration.",
      "Combined exposure may exceed the limit once look-through is applied.",
      "Pause new allocation until the unified view is confirmed.",
      "Escalate to the risk committee with full lineage.",
    ],
    graph: "Entity resolution links the silos. The graph exposes concentration no single system could see.",
    recommended: "Establish a unified intelligence graph view before the next allocation.",
    counterfactual: "Reconcile by hand at the next reporting cycle.",
    tradeoff: "Unification needs data governance work. Manual reconciliation leaves concentration hidden between cycles.",
    outcome: "Illustrative path surfaces hidden concentration before it becomes a breach.",
    validate: "Validate reconciled exposure and limit compliance against source systems.",
    memory: "Retain the entity resolution and lineage map.",
    inOs: { label: "The intelligence graph", href: "/graph" },
  },
  {
    key: "national-programme", title: "National programme coordination", gaps: ["fragmentation", "governance_velocity"],
    domain: "construction_real_estate", template: "resilience",
    intent: "Align fund capital, ministry approvals and portfolio company delivery behind one national programme.",
    scenario: "Hypothetical giga-project needs capital, permits and portfolio supply at the same time on misaligned timelines.",
    doctrine: "National programmes succeed through coordinated decision rights.",
    constraint: "Each entity retains its own authority. Shared schedule changes require agreement of the designated principals.",
    frictions: [
      "Capital, approvals and delivery each follow a separate calendar.",
      "Capital is committed ahead of permits.",
      "Delivery slips when inputs arrive out of sequence.",
      "Idle capital waits on approvals.",
    ],
    handoffs: [
      "Three entities plan the same project on different calendars.",
      "Trace how one permit delay cascades into cost and idle capital.",
      "Stage capital calls against confirmed approvals.",
      "Propose a shared dependency schedule with clear decision rights.",
      "Each principal retains authority. Escalation path agreed.",
    ],
    graph: "Cross-entity dependency nodes appear. The graph connects permits, procurement and capital calls in one sequence.",
    recommended: "Adopt a shared dependency schedule with explicit decision rights.",
    counterfactual: "Each entity proceeds on its own plan.",
    tradeoff: "Coordination requires shared governance. Independence is simpler and accumulates cost and delay.",
    outcome: "Illustrative path reduces duplication and idle capital across the programme.",
    validate: "Compare delivery milestones, procurement cost and capital utilization against the programme baseline.",
    memory: "Retain coordination patterns and escalation paths for future national programmes.",
  },
  {
    key: "compounding", title: "Compounding precedent", gaps: ["memory", "value_realization"],
    domain: "energy", template: "hormuz",
    intent: "Ensure every decision makes the institution stronger for the next one.",
    scenario: "Hypothetical recurrence of a shock type the institution has faced before.",
    doctrine: "Intelligence into Capability. Capital into Sovereign Advantage.",
    constraint: "Recalled precedent informs options. Principals decide whether it still applies.",
    frictions: [
      "Prior decisions, constraints and outcomes are recalled.",
      "Validated doctrine shapes the option set.",
      "Agents start from precedent, not from zero.",
      "Principals judge what has changed since the last cycle.",
    ],
    handoffs: [
      "Signal pattern matches a recorded prior event.",
      "Recall what worked and what the evidence later showed.",
      "Adjust the prior response for current constraints.",
      "Propose the refined response with its lineage.",
      "Principals confirm relevance. Outcome feeds memory again.",
    ],
    graph: "Memory feeds the front of the loop. Each cycle starts from validated precedent.",
    recommended: "Reuse the validated response with adjustments for current conditions.",
    counterfactual: "Analyse the event from scratch.",
    tradeoff: "Precedent accelerates framing but can mislead if conditions changed. Starting fresh is slower and loses learning.",
    outcome: "Illustrative path shows capability compounding across decision cycles.",
    validate: "Compare framing time and outcome quality against prior cycles before claiming improvement.",
    memory: "Retain the doctrine evolution so the institution strengthens with every cycle.",
    inOs: { label: "Precedents in institutional memory", href: "/memory" },
  },
];

export const playbooksForGap = (gap: GapKey) => PLAYBOOKS.filter((p) => p.gaps.includes(gap));
export const playbookByKey = (key: string) => PLAYBOOKS.find((p) => p.key === key);
