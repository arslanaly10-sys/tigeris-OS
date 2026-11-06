import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { notifyRole } from "./notify";

/**
 * Signals (FR-09, FR-10, UX §8). A signal is something that may need attention, with the reason it was
 * surfaced and a confidence band built from named components, never a bare percentage (FD §6).
 * Data modes: OBSERVED (from an approved source), SIMULATED (labelled demonstration stream), SYNTHETIC.
 */
export type Level = "low" | "medium" | "high";
export interface Confidence { band: Level; components: Array<{ factor: string; level: Level; basis: string }> }

const rank: Record<Level, number> = { low: 0, medium: 1, high: 2 };
const LEVELS: Level[] = ["low", "medium", "high"];

export function confidenceFor(args: { dataMode: "observed" | "simulated" | "synthetic"; corroborations: number; ageHours: number; linkedEntities: number }): Confidence {
  const components: Confidence["components"] = [
    { factor: "Source quality", level: args.dataMode === "observed" ? "high" : args.dataMode === "simulated" ? "medium" : "low", basis: args.dataMode === "observed" ? "Approved public source" : args.dataMode === "simulated" ? "Labelled simulation stream; not a live feed" : "Synthetic demonstration input" },
    { factor: "Corroboration", level: args.corroborations >= 2 ? "high" : args.corroborations === 1 ? "medium" : "low", basis: args.corroborations ? `${args.corroborations} independent corroborating record(s)` : "Not yet corroborated" },
    { factor: "Freshness", level: args.ageHours <= 24 ? "high" : args.ageHours <= 24 * 7 ? "medium" : "low", basis: `${Math.round(args.ageHours)} h since the event` },
    { factor: "Graph coverage", level: args.linkedEntities >= 2 ? "high" : args.linkedEntities === 1 ? "medium" : "low", basis: `${args.linkedEntities} linked entit${args.linkedEntities === 1 ? "y" : "ies"} in the intelligence graph` },
  ];
  // The band follows the weakest of source quality and corroboration, lifted by at most one step by the rest.
  const core = Math.min(rank[components[0]!.level], rank[components[1]!.level]);
  const rest = Math.min(rank[components[2]!.level], rank[components[3]!.level]);
  const band = LEVELS[Math.min(2, rest > core ? core + 1 : core)]!;
  return { band, components };
}

export interface NewSignal {
  key: string; title: string; summary: string; domain: string; eventType: string; urgency: "low" | "medium" | "high" | "critical"; impact: Level;
  dataMode: "observed" | "simulated" | "synthetic"; eventTime: Date; whySurfaced: string; detectedBy: string; entityKeys: string[];
  evidence?: Array<{ evidenceId: string; factId?: string | null; role: "origin" | "corroborating" | "contradicting"; note?: string }>;
}

export async function recomputeConfidence(tx: Tx, signalId: string) {
  const s = (await tx.query("SELECT data_mode, event_time FROM signals WHERE id = $1", [signalId])).rows[0];
  const corr = (await tx.query("SELECT count(*)::int AS n FROM signal_evidence WHERE signal_id = $1 AND role = 'corroborating'", [signalId])).rows[0].n;
  const ents = (await tx.query("SELECT count(*)::int AS n FROM signal_entities WHERE signal_id = $1", [signalId])).rows[0].n;
  const c = confidenceFor({ dataMode: s.data_mode, corroborations: corr, ageHours: (Date.now() - new Date(s.event_time).getTime()) / 3_600_000, linkedEntities: ents });
  await tx.query("UPDATE signals SET confidence = $2 WHERE id = $1", [signalId, JSON.stringify(c)]);
  return c;
}

export async function raiseSignal(tx: Tx, institutionId: string, s: NewSignal): Promise<{ id: string; created: boolean }> {
  const existing = (await tx.query("SELECT id FROM signals WHERE key = $1", [s.key])).rows[0];
  if (existing) return { id: existing.id, created: false };
  const r = await tx.query<{ id: string }>(
    `INSERT INTO signals (institution_id, key, title, summary, domain, event_type, urgency, impact, data_mode, event_time, why_surfaced, detected_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [institutionId, s.key, s.title, s.summary, s.domain, s.eventType, s.urgency, s.impact, s.dataMode, s.eventTime, s.whySurfaced, s.detectedBy],
  );
  const id = r.rows[0]!.id;
  await tx.query(
    `INSERT INTO signal_entities (institution_id, signal_id, entity_id) SELECT $1, $2, id FROM entities WHERE key = ANY($3) ON CONFLICT DO NOTHING`,
    [institutionId, id, s.entityKeys],
  );
  for (const e of s.evidence ?? []) {
    await tx.query("INSERT INTO signal_evidence (institution_id, signal_id, evidence_id, fact_id, role, note) VALUES ($1,$2,$3,$4,$5,$6)", [institutionId, id, e.evidenceId, e.factId ?? null, e.role, e.note ?? null]);
  }
  await recomputeConfidence(tx, id);
  await appendAudit(tx, institutionId, { actorType: "service", actorId: s.detectedBy, actorLabel: `Signal rule ${s.detectedBy}`, action: "signal.raised", resourceType: "signal", resourceId: id, details: { title: s.title, dataMode: s.dataMode, urgency: s.urgency } });
  if (s.urgency === "high" || s.urgency === "critical") {
    await notifyRole(tx, institutionId, ["analyst", "executive"], { kind: "signal_high", title: s.title, body: s.whySurfaced, link: `/signals?focus=${id}` });
  }
  return { id, created: true };
}

/** Rule run on every accepted document: shipping-risk language corroborates the open Hormuz signals (live demo moment). */
export async function onDocumentAccepted(tx: Tx, institutionId: string, evidenceId: string) {
  const facts = (await tx.query("SELECT id, value_text FROM evidence_facts WHERE evidence_id = $1", [evidenceId])).rows;
  const text = facts.map((f) => f.value_text ?? "").join(" ");
  if (!/hormuz|war-risk|insurance premium|tanker|gps interference/i.test(text)) return [];
  const targets = (await tx.query("SELECT s.id, s.title FROM signals s JOIN signal_entities se ON se.signal_id = s.id JOIN entities e ON e.id = se.entity_id WHERE e.key = 'chokepoint:hormuz' AND s.status IN ('new','monitoring','in_case')")).rows;
  const fact = facts.find((f) => /war-risk|insurance/i.test(f.value_text ?? "")) ?? facts[0];
  for (const t of targets) {
    await tx.query("INSERT INTO signal_evidence (institution_id, signal_id, evidence_id, fact_id, role, note) VALUES ($1,$2,$3,$4,'corroborating',$5)", [institutionId, t.id, evidenceId, fact?.id ?? null, "Uploaded advisory describes the same conditions"]);
    await recomputeConfidence(tx, t.id);
    await appendAudit(tx, institutionId, { actorType: "service", actorId: "rule.shipping_advisory", actorLabel: "Signal rule shipping_advisory", action: "signal.corroborated", resourceType: "signal", resourceId: t.id, details: { evidenceId } });
  }
  return targets.map((t) => t.id as string);
}

/** Presenter-triggered simulated events (Q050). Always SIMULATED and labelled as such. */
export const SIMULATED_EVENTS: Record<string, Omit<NewSignal, "key" | "eventTime" | "dataMode" | "detectedBy">> = {
  hormuz_transits_drop: { title: "Tanker transits through the Strait of Hormuz fell 23% below the 7-day average", summary: "The simulated movement stream counted 71 tanker transits in the last 24 hours against a 7-day average of 92.", domain: "energy", eventType: "maritime_flow_drop", urgency: "critical", impact: "high", whySurfaced: "Transit count is more than 20% below its 7-day average at a chokepoint carrying about a fifth of global petroleum liquids.", entityKeys: ["chokepoint:hormuz", "route:gulf-of-oman", "commodity:crude"] },
  gps_interference: { title: "GPS interference reported near the Hormuz traffic separation scheme", summary: "Four vessels in the simulated stream reported position jumps of more than 5 nautical miles within two hours.", domain: "supply_chain", eventType: "navigation_interference", urgency: "high", impact: "medium", whySurfaced: "Navigation interference raises collision and diversion risk at the strait.", entityKeys: ["chokepoint:hormuz", "route:persian-gulf"] },
  red_sea_rerouting: { title: "Container services rerouting away from the Red Sea via the Cape of Good Hope", summary: "Simulated schedules show three Asia–Europe services shifting to the Cape route, adding 10–14 days.", domain: "supply_chain", eventType: "route_diversion", urgency: "high", impact: "high", whySurfaced: "Rerouting lengthens supply lines for Red Sea ports and raises freight and insurance costs.", entityKeys: ["route:red-sea", "chokepoint:bab-el-mandeb", "route:cape", "port:jeddah", "port:king-abdullah"] },
  desal_outage: { title: "Output at the Fujairah desalination plant reduced after a power trip", summary: "Simulated operator report: output at about 60% of normal for an estimated 36 hours.", domain: "infrastructure", eventType: "utility_outage", urgency: "medium", impact: "medium", whySurfaced: "Fujairah and Sharjah draw drinking water from this plant.", entityKeys: ["desal:fujairah", "power:fujairah", "city:fujairah", "city:sharjah"] },
};
