import type { Tx } from "../db";
import { raiseSignal, SIMULATED_EVENTS } from "./signals";
import { nextCaseKey } from "./cases";

/**
 * Demonstration storyline (SCOPE §7): real geography and history, hypothetical events.
 * Every simulated event is labelled SIMULATED; the sanctions signal is OBSERVED from the imported list.
 * Three cases at full depth, four medium, two short, spread across the lifecycle so each role has work.
 */
type Person = { id: string; name: string };

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

export async function seedStoryline(tx: Tx, institutionId: string, shortName: string, people: Map<string, Person>) {
  const sig = async (key: string, s: Omit<Parameters<typeof raiseSignal>[2], "key">) => (await raiseSignal(tx, institutionId, { ...s, key })).id;
  const sim = (kind: keyof typeof SIMULATED_EVENTS, h: number) => ({ ...SIMULATED_EVENTS[kind]!, eventTime: hoursAgo(h), dataMode: "simulated" as const, detectedBy: "stream.simulated" });

  const hormuz = await sig("story:hormuz-transits", sim("hormuz_transits_drop", 3));
  const gps = await sig("story:gps", sim("gps_interference", 5));
  const redSea = await sig("story:red-sea", sim("red_sea_rerouting", 30));
  const desal = await sig("story:desal", sim("desal_outage", 8));
  const banking = await sig("story:banking", { title: "Overnight interbank rate in a GCC market rose 85 basis points in two sessions", summary: "Synthetic market feed: the overnight rate moved from 5.35% to 6.20%, the largest two-day rise in the series.", domain: "banking", eventType: "liquidity_stress", urgency: "high", impact: "high", dataMode: "synthetic", eventTime: hoursAgo(20), whySurfaced: "A sharp rise in overnight funding costs can signal tightening liquidity in local banks held by the institution.", detectedBy: "rule.rates_threshold", entityKeys: ["country:SAU", "country:ARE"] });
  const food = await sig("story:food", { title: "Wheat cargoes for Jebel Ali and Dammam delayed by 6–9 days", summary: "Simulated schedule data shows four bulk carriers waiting at anchor after slot cancellations.", domain: "supply_chain", eventType: "import_delay", urgency: "medium", impact: "medium", dataMode: "simulated", eventTime: hoursAgo(14), whySurfaced: "GCC states import most of their staple grain; delays draw down reserve cover.", detectedBy: "stream.simulated", entityKeys: ["commodity:grain", "port:jebel-ali", "port:dammam"] });
  const pandemic = await sig("story:pandemic", { title: "Container dwell times rising at major Asian transhipment hubs", summary: "Synthetic port-health feed: dwell time up 40% over two weeks after workforce absences.", domain: "supply_chain", eventType: "supply_shock", urgency: "medium", impact: "high", dataMode: "synthetic", eventTime: hoursAgo(50), whySurfaced: "Upstream port congestion propagates to GCC import costs and availability within weeks.", detectedBy: "rule.port_dwell", entityKeys: ["chokepoint:malacca", "commodity:containers", "port:jebel-ali"] });
  const ukEvidence = (await tx.query("SELECT e.id, e.source_version FROM evidence_objects e JOIN sources s ON s.id = e.source_id WHERE s.key = 'uk.sanctions' AND e.duplicate_of IS NULL LIMIT 1")).rows[0];
  const ships = (await tx.query("SELECT count(*)::int AS n FROM entities WHERE type = 'vessel'")).rows[0].n;
  const sanctions = await sig("story:sanctions", { title: `Sanctions lists cover ${ships.toLocaleString("en-GB")} designated vessels in the latest snapshot`, summary: `OFAC SDN and UK Sanctions List vessel entries imported in the public snapshot${ukEvidence?.source_version ? ` (${ukEvidence.source_version})` : ""}.`, domain: "insurance", eventType: "sanctions_update", urgency: "low", impact: "medium", dataMode: "observed", eventTime: hoursAgo(26), whySurfaced: "Counterparties and chartered vessels should be screened against the current lists.", detectedBy: "rule.sanctions_snapshot", entityKeys: [], evidence: ukEvidence ? [{ evidenceId: ukEvidence.id, role: "origin" }] : [] });

  const analyst = people.get("analyst")!;
  const expert = people.get("domain_expert")!;
  const exec = people.get("executive")!;
  const eia = (await tx.query("SELECT e.id AS evidence_id, f.id AS fact_id FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id WHERE s.key = 'eia.chokepoints' AND f.predicate IN ('oil_transit_flow','bypass_capacity_available') ORDER BY f.predicate DESC")).rows;
  const jodi = (await tx.query("SELECT e.id AS evidence_id FROM evidence_objects e JOIN sources s ON s.id = e.source_id WHERE s.key = 'jodi.oil' ORDER BY e.title DESC LIMIT 1")).rows[0];

  const cases: Array<{ template?: string; title: string; objective: string; domain: string; depth: "full" | "medium" | "short"; path: string[]; owner: Person; creator: Person; signals: string[]; entities: Array<[string, string]>; situation: string; why: string; questions: string[]; evidence?: Array<{ evidence_id: string; fact_id?: string; note: string }>; link?: number; closure?: string }> = [
    { template: "hormuz", title: "Strait of Hormuz transit disruption", objective: "Establish what a sustained fall in Hormuz transits means for this institution's mandates, holdings and national dependencies, and which options are available.", domain: "energy", depth: "full", path: ["triaged", "analysis"], owner: analyst, creator: analyst, signals: [hormuz],
      entities: [["chokepoint:hormuz", "origin"], ["pipeline:east-west", "alternative"], ["pipeline:adcop", "alternative"], ["port:ras-tanura", "affected"], ["port:jebel-ali", "affected"], ["port:ras-laffan", "affected"]],
      situation: "Simulated transit counts through the Strait of Hormuz are 23% below their 7-day average, alongside reports of GPS interference near the traffic separation scheme.",
      why: "About 20 million b/d of oil moved through the strait in 2024 (EIA). Gulf export terminals, LNG from Ras Laffan and food imports to inner-Gulf ports all depend on it; only about 2.6 million b/d of pipeline capacity can bypass it.",
      questions: ["How long could a disruption last, and at what intensity?", "Which holdings depend on exports through the strait?", "How much of the bypass capacity is actually available?"],
      evidence: eia.map((e) => ({ evidence_id: e.evidence_id, fact_id: e.fact_id, note: "EIA baseline for flows and bypass capacity" })) },
    { template: "resilience", title: "Institutional resilience to a Hormuz disruption", objective: "Measure how exposed the institution's portfolio and national services are to the same Hormuz event, and how fast they could recover.", domain: "infrastructure", depth: "full", path: ["triaged"], owner: analyst, creator: analyst, signals: [], link: 0,
      entities: [["chokepoint:hormuz", "origin"], ["desal:taweelah", "affected"], ["city:doha", "affected"], ["port:hamad", "affected"]],
      situation: "Linked to the Hormuz case. Inner-Gulf ports carry most food and goods imports; power and water plants depend on gas supply that also moves by sea.",
      why: "Resilience depends on alternative routes, reserve cover and how long dependent services can run on buffers.",
      questions: ["Which dependencies have no tested alternative?", "How many days of reserve cover exist for staples?"] },
    { template: "oil45", title: "Oil falls to USD 45: capital allocation stress test", objective: "Compare hold, defer, hedge and reallocate options for the portfolio under a sustained oil price of USD 45 per barrel.", domain: "sovereign_capital", depth: "full", path: [], owner: analyst, creator: exec, signals: [],
      entities: [["commodity:crude", "origin"], ["country:SAU", "affected"]],
      situation: "Requested by the Strategy Office. The oil price is a scenario assumption, not a market observation.",
      why: "Energy-linked holdings and fiscal-dependent sectors are concentrated in the portfolio; mandates set drawdown and liquidity limits.",
      questions: ["Which mandates would be breached first?", "How much liquidity is needed to avoid forced sales?"],
      evidence: jodi ? [{ evidence_id: jodi.evidence_id, note: "JODI production and export baseline" }] : [] },
    { template: "red_sea", title: "Red Sea shipping rerouting", objective: "Assess cost and timing effects of Asia–Europe services avoiding the Red Sea on Red Sea ports and dependent holdings.", domain: "supply_chain", depth: "medium", path: ["triaged", "analysis", "scenario"], owner: analyst, creator: analyst, signals: [redSea],
      entities: [["route:red-sea", "origin"], ["route:cape", "alternative"], ["port:jeddah", "affected"], ["port:king-abdullah", "affected"]],
      situation: "Simulated schedules show three services moving to the Cape route.", why: "Longer routes raise freight and insurance costs and reduce Red Sea port volumes.", questions: ["How long have past diversions lasted?"] },
    { template: "pandemic", title: "Pandemic-type supply shock through Asian hubs", objective: "Trace how congestion at Asian transhipment hubs reaches GCC import availability and prices.", domain: "supply_chain", depth: "medium", path: ["triaged"], owner: analyst, creator: analyst, signals: [pandemic],
      entities: [["chokepoint:malacca", "origin"], ["commodity:containers", "affected"], ["port:jebel-ali", "affected"]],
      situation: "Synthetic port-health feed shows dwell times rising.", why: "Upstream congestion reaches GCC shelves within weeks.", questions: ["Which goods have the shortest buffers?"] },
    { template: "banking", title: "Banking liquidity stress", objective: "Assess exposure of banking holdings to tightening interbank liquidity.", domain: "banking", depth: "medium", path: ["triaged", "analysis", "scenario", "review"], owner: analyst, creator: analyst, signals: [banking],
      entities: [["country:SAU", "affected"], ["country:ARE", "affected"]],
      situation: "Synthetic market feed: overnight rate up 85 basis points in two sessions.", why: "Bank holdings are sensitive to funding costs; liquidity mandate sets a 10% buffer.", questions: ["Is the rise driven by local or global factors?"] },
    { template: "food", title: "Food security: delayed grain imports", objective: "Check reserve cover against delayed wheat cargoes and identify alternative supply.", domain: "supply_chain", depth: "medium", path: ["triaged", "analysis"], owner: analyst, creator: analyst, signals: [food],
      entities: [["commodity:grain", "origin"], ["port:jebel-ali", "affected"], ["port:dammam", "affected"]],
      situation: "Simulated schedules show four bulk carriers delayed 6–9 days.", why: "Staple imports cover most demand; the food mandate requires 90 days of cover.", questions: ["What is current reserve cover by country?"] },
    { template: "resilience", title: "Fujairah desalination output reduced", objective: "Confirm duration and downstream water supply effects.", domain: "infrastructure", depth: "short", path: [], owner: expert, creator: analyst, signals: [desal],
      entities: [["desal:fujairah", "origin"], ["city:fujairah", "affected"], ["city:sharjah", "affected"]],
      situation: "Simulated operator report: output at about 60% for 36 hours.", why: "Two cities draw on this plant.", questions: [] },
    { template: "hormuz", title: "Sanctions change affecting a chartered vessel", objective: "Screen chartered vessels against the latest lists.", domain: "insurance", depth: "short", path: ["triaged"], owner: analyst, creator: analyst, signals: [], closure: "non_actionable",
      entities: [], situation: "Latest OFAC and UK vessel lists imported.", why: "Chartering a designated vessel creates legal and insurance exposure.", questions: [] },
  ];

  const ids: string[] = [];
  for (const [i, c] of cases.entries()) {
    const key = await nextCaseKey(tx, shortName);
    const finalState = c.closure ? "closed" : c.path.at(-1) ?? "detected";
    const r = await tx.query<{ id: string }>(
      `INSERT INTO cases (institution_id, case_key, title, objective, domain, depth, state, closure, owner_id, owner_label, created_by, created_by_label, source_signal_id, linked_case_id, situation, why_it_matters, open_questions, created_at, last_activity_at, scenario_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
      [institutionId, key, c.title, c.objective, c.domain, c.depth, finalState, c.closure ?? null, c.owner.id, c.owner.name, c.creator.id, c.creator.name, c.signals[0] ?? null,
        c.link !== undefined ? ids[c.link] : null, c.situation, c.why, c.questions, hoursAgo(48 - i * 3), hoursAgo(Math.max(1, 20 - i * 2)), c.template ?? "hormuz"],
    );
    const id = r.rows[0]!.id;
    ids.push(id);
    for (const s of c.signals) {
      await tx.query("INSERT INTO case_signals (institution_id, case_id, signal_id) VALUES ($1,$2,$3)", [institutionId, id, s]);
      await tx.query("UPDATE signals SET status = 'in_case', disposition_by = $2, disposition_note = 'Opened a case' WHERE id = $1", [s, c.creator.name]);
    }
    for (const [k, role] of c.entities) await tx.query("INSERT INTO case_entities (institution_id, case_id, entity_id, role) SELECT $1, $2, id, $3 FROM entities WHERE key = $4 ON CONFLICT DO NOTHING", [institutionId, id, role, k]);
    for (const e of c.evidence ?? []) await tx.query("INSERT INTO case_evidence (institution_id, case_id, evidence_id, fact_id, note, added_by_label) VALUES ($1,$2,$3,$4,$5,$6)", [institutionId, id, e.evidence_id, e.fact_id ?? null, e.note, c.owner.name]);
    await tx.query("INSERT INTO case_events (institution_id, case_id, kind, to_state, actor_id, actor_label, actor_role, occurred_at) VALUES ($1,$2,'created','detected',$3,$4,$5,$6)", [institutionId, id, c.creator.id, c.creator.name, c.creator === exec ? "executive" : "analyst", hoursAgo(48 - i * 3)]);
    let from = "detected";
    for (const [j, to] of (c.closure ? [...c.path, "closed"] : c.path).entries()) {
      await tx.query("INSERT INTO case_events (institution_id, case_id, kind, from_state, to_state, actor_id, actor_label, actor_role, rationale, occurred_at) VALUES ($1,$2,'transition',$3,$4,$5,$6,'analyst',$7,$8)",
        [institutionId, id, from, to, analyst.id, analyst.name, to === "closed" ? "No chartered vessel matched the current lists." : null, hoursAgo(40 - i * 3 - j * 4)]);
      from = to;
    }
  }
  await tx.query("UPDATE signals SET status = 'new' WHERE id = ANY($1) AND id NOT IN (SELECT signal_id FROM case_signals)", [[hormuz, gps, redSea, desal, banking, food, pandemic, sanctions]]);
  // Fresh, unassigned signals for the attention queue and live triage
  await raiseSignal(tx, institutionId, { key: "story:hormuz-insurance", title: "War-risk cover for Gulf transits under review by marine insurers", summary: "Synthetic market note: several insurers are reviewing cover terms for transits inside the Gulf.", domain: "insurance", eventType: "insurance_terms", urgency: "high", impact: "medium", dataMode: "synthetic", eventTime: hoursAgo(2), whySurfaced: "Insurance terms change shipping costs and availability at the strait before volumes move.", detectedBy: "rule.insurance_terms", entityKeys: ["chokepoint:hormuz", "port:fujairah"] });
  return { cases: ids.length };
}
