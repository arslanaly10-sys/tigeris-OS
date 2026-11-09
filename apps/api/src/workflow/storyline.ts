import type { Tx } from "../db";
import { raiseSignal, SIMULATED_EVENTS } from "./signals";
import { nextCaseKey } from "./cases";
import { anomalySignals, realAnomalySignals } from "../intel/correlation";

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

  // One signal per industry added on 9 Nov 2026 (synthetic or simulated, labelled), so every industry lens has work.
  const syn = (key: string, x: { title: string; summary: string; domain: string; eventType: string; urgency: "low" | "medium" | "high" | "critical"; impact: "low" | "medium" | "high"; mode?: "simulated" | "synthetic"; h: number; why: string; rule: string; entities: string[] }) =>
    sig(key, { title: x.title, summary: x.summary, domain: x.domain, eventType: x.eventType, urgency: x.urgency, impact: x.impact, dataMode: x.mode ?? "synthetic", eventTime: hoursAgo(x.h), whySurfaced: x.why, detectedBy: x.mode === "simulated" ? "stream.simulated" : x.rule, entityKeys: x.entities });
  const petchem = await syn("story:petchem", { title: "Feedstock allocation to Jubail petrochemical plants cut by 15% for the next quarter", summary: "Synthetic allocation notice: ethane and naphtha supply to downstream plants reduced while upstream maintenance runs.", domain: "manufacturing", eventType: "input_shortfall", urgency: "medium", impact: "medium", h: 16, why: "Feedstock cuts reduce plant output and margins for industrial holdings within weeks.", rule: "rule.allocation_notice", entities: ["commodity:petchem", "refinery:jubail", "port:jubail"] });
  const materials = await syn("story:materials", { title: "Imported rebar and cement prices up 18% in one quarter", summary: "Synthetic price index: construction materials landed at Dammam and Jeddah rose faster than contract escalation allows.", domain: "construction_real_estate", eventType: "cost_escalation", urgency: "medium", impact: "high", h: 30, why: "Fixed-price contracts on national development projects absorb the rise until budgets are reset.", rule: "rule.price_index", entities: ["port:dammam", "port:jeddah", "city:riyadh"] });
  const spoofing = await syn("story:spoofing", { title: "Repeated AIS position jumps from vessels near the Hormuz anchorages", summary: "Simulated movement stream: five vessels reported positions that jumped more than 20 nautical miles between consecutive reports.", domain: "defence_security", eventType: "navigation_anomaly", urgency: "high", impact: "medium", mode: "simulated", h: 4, why: "Position jumps suggest AIS spoofing or interference, which raises collision and misidentification risk in the strait.", rule: "stream.simulated", entities: ["chokepoint:hormuz", "port:fujairah", "port:khor-fakkan"] });
  const coldChain = await syn("story:cold-chain", { title: "Insulin and vaccine air cargo through Dubai delayed by 48 hours", summary: "Synthetic cargo feed: temperature-controlled shipments held after a handling-system outage at the main cargo terminal.", domain: "healthcare", eventType: "medicine_delay", urgency: "high", impact: "medium", h: 9, why: "Cold-chain medicines have short shelf lives; hospital stocks for several medicines cover under two weeks.", rule: "rule.cargo_delay", entities: ["airport:dxb", "airport:dwc", "city:dubai", "city:abu-dhabi"] });
  const cables = await syn("story:cables", { title: "Latency up on two subsea cable routes through the Red Sea", summary: "Synthetic network telemetry: round-trip latency to Europe rose 35% on two routes, consistent with a cable fault near Bab el-Mandeb.", domain: "telecoms", eventType: "network_degradation", urgency: "high", impact: "high", h: 12, why: "Most Gulf–Europe data traffic runs on a few subsea routes; banks, cloud services and government systems depend on them.", rule: "rule.latency_threshold", entities: ["chokepoint:bab-el-mandeb", "route:red-sea", "city:jeddah", "city:muscat"] });
  const airspace = await syn("story:airspace", { title: "Airspace restrictions add about 40 minutes to Gulf–Europe flights", summary: "Simulated flight plans: carriers reroute around a restricted area, adding fuel and crew time.", domain: "transport_aviation", eventType: "route_restriction", urgency: "medium", impact: "medium", mode: "simulated", h: 7, why: "Longer routes raise costs at Gulf hubs and can push connections past their minimum transfer times.", rule: "stream.simulated", entities: ["airport:dxb", "airport:doh", "airport:ruh"] });

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
    { template: "pandemic", title: "Feedstock shortfall at Jubail petrochemical plants", objective: "Estimate the output and margin effect of a 15% feedstock cut on industrial holdings and find alternative supply.", domain: "manufacturing", depth: "short", path: ["triaged"], owner: analyst, creator: analyst, signals: [petchem],
      entities: [["commodity:petchem", "origin"], ["refinery:jubail", "affected"], ["port:jubail", "affected"]],
      situation: "Synthetic allocation notice: feedstock to downstream plants cut by 15% for a quarter.", why: "Industrial holdings depend on contracted feedstock volumes.", questions: ["Which plants can switch feedstock?"] },
    { template: "pandemic", title: "Material cost overrun on national development projects", objective: "Measure how an 18% rise in rebar and cement prices affects project budgets, timelines and real estate holdings.", domain: "construction_real_estate", depth: "short", path: [], owner: analyst, creator: analyst, signals: [materials],
      entities: [["port:dammam", "affected"], ["port:jeddah", "affected"], ["city:riyadh", "affected"]],
      situation: "Synthetic price index: imported materials up 18% in a quarter.", why: "Fixed-price contracts absorb the rise until budgets are reset.", questions: ["Which projects have escalation clauses?"] },
    { template: "hormuz", title: "Navigation safety and AIS spoofing near Hormuz", objective: "Establish whether position jumps near the Hormuz anchorages are spoofing, and what they mean for shipping safety and insured exposure.", domain: "defence_security", depth: "medium", path: ["triaged"], owner: analyst, creator: analyst, signals: [spoofing],
      entities: [["chokepoint:hormuz", "origin"], ["port:fujairah", "affected"], ["port:khor-fakkan", "affected"]],
      situation: "Simulated stream: five vessels reported position jumps of more than 20 nautical miles.", why: "Spoofed positions raise collision risk and can hide ship-to-ship transfers.", questions: ["Are the jumps clustered in time and place?", "Which chartered or insured vessels were nearby?"] },
    { template: "food", title: "Cold-chain medicine supply disruption", objective: "Check hospital stock cover for temperature-controlled medicines against a 48-hour air cargo delay and identify alternative routes.", domain: "healthcare", depth: "short", path: ["triaged"], owner: analyst, creator: analyst, signals: [coldChain],
      entities: [["airport:dxb", "origin"], ["airport:dwc", "alternative"], ["city:dubai", "affected"], ["city:abu-dhabi", "affected"]],
      situation: "Synthetic cargo feed: temperature-controlled shipments held 48 hours.", why: "Several medicines have under two weeks of stock.", questions: ["Which medicines run out first?"] },
    { template: "red_sea", title: "Subsea cable fault in the Red Sea: connectivity resilience", objective: "Assess which services lose capacity if two Red Sea cable routes are degraded for weeks, and which alternatives exist.", domain: "telecoms", depth: "medium", path: ["triaged", "analysis"], owner: analyst, creator: analyst, signals: [cables],
      entities: [["chokepoint:bab-el-mandeb", "origin"], ["route:red-sea", "affected"], ["city:jeddah", "affected"], ["city:muscat", "alternative"]],
      situation: "Synthetic telemetry: latency to Europe up 35% on two routes.", why: "Banks, cloud and government systems share a few subsea routes.", questions: ["How much traffic can move to overland routes?"] },
    { template: "red_sea", title: "Airspace restrictions and Gulf hub connectivity", objective: "Estimate cost and missed-connection effects of rerouted Gulf–Europe flights at the main hubs.", domain: "transport_aviation", depth: "short", path: [], owner: analyst, creator: analyst, signals: [airspace],
      entities: [["airport:dxb", "affected"], ["airport:doh", "affected"], ["airport:ruh", "affected"]],
      situation: "Simulated flight plans: about 40 minutes added to Gulf–Europe flights.", why: "Longer routes raise costs and break tight connections.", questions: ["Which connections fall below minimum transfer time?"] },
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
  // Voyage anomalies on real AIS tracks (observed), linked to the AIS evidence they come from.
  for (const r of await realAnomalySignals(tx)) await raiseSignal(tx, institutionId, r);
  // Voyage anomalies from the scripted ships (slice 4): one SIMULATED signal each; spoofing and the AIS gap also
  // corroborate the navigation-safety case.
  const navCase = (await tx.query("SELECT id FROM cases WHERE title = 'Navigation safety and AIS spoofing near Hormuz'")).rows[0]?.id as string | undefined;
  for (const a of anomalySignals()) {
    const { anomaly, ...signal } = a;
    const id = (await raiseSignal(tx, institutionId, signal)).id;
    if (navCase && (anomaly.kind === "ais_spoofing" || anomaly.kind === "going_dark")) {
      await tx.query("INSERT INTO case_signals (institution_id, case_id, signal_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [institutionId, navCase, id]);
      await tx.query("UPDATE signals SET status = 'in_case', disposition_by = $2, disposition_note = 'Added to the navigation-safety case' WHERE id = $1", [id, analyst.name]);
    }
  }
  // Fresh, unassigned signals for the attention queue and live triage
  await raiseSignal(tx, institutionId, { key: "story:hormuz-insurance", title: "War-risk cover for Gulf transits under review by marine insurers", summary: "Synthetic market note: several insurers are reviewing cover terms for transits inside the Gulf.", domain: "insurance", eventType: "insurance_terms", urgency: "high", impact: "medium", dataMode: "synthetic", eventTime: hoursAgo(2), whySurfaced: "Insurance terms change shipping costs and availability at the strait before volumes move.", detectedBy: "rule.insurance_terms", entityKeys: ["chokepoint:hormuz", "port:fujairah"] });
  return { cases: ids.length };
}
