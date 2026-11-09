import { createHash } from "node:crypto";
import { ANOMALY_LABEL, SCRIPTED_SHIPS, THRESHOLDS, detectScripted, km, type Anomaly, type AnomalyKind, type LngLat } from "@tigeris/shared";
import type { Tx } from "../db";

/**
 * Intelligence correlation (slice 4, 9 Nov 2026). Deterministic and explainable: signals and voyage anomalies are
 * grouped by area of interest and a time window; each group is tested against competing hypotheses with an
 * Analysis of Competing Hypotheses matrix (consistent, inconsistent, neutral). The hypothesis with the fewest
 * inconsistencies ranks first; confidence depends on how many independent kinds of evidence agree and whether any
 * of them is observed rather than simulated. No model is involved and nothing is acted on (rules 4 and 5).
 */

/** Minute of the day in Riyadh time → the most recent past moment at that time. */
export function anomalyTime(minute: number, now = Date.now()): Date {
  const d = new Date(now + 3 * 3_600_000);
  const midnightRiyadhUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 3 * 3_600_000;
  let t = midnightRiyadhUtc + minute * 60_000;
  if (t > now) t -= 86_400_000;
  return new Date(t);
}

export const ANOMALY_SIGNAL: Record<AnomalyKind, { domain: string; eventType: string; urgency: "medium" | "high"; why: string; entities: string[] }> = {
  going_dark: { domain: "defence_security", eventType: "ais_gap", urgency: "high", why: "A tanker that switches off AIS near the strait cannot be seen by other ships or by insurers; gaps often hide transfers or port calls.", entities: ["chokepoint:hormuz"] },
  ship_to_ship: { domain: "insurance", eventType: "ship_to_ship", urgency: "high", why: "Ship-to-ship meetings away from ports are a known way to move cargo past sanctions and insurance controls.", entities: ["port:fujairah", "chokepoint:hormuz"] },
  loitering: { domain: "defence_security", eventType: "loitering", urgency: "medium", why: "Long waits outside designated anchorages can mean waiting for a transfer, for orders, or watching the traffic lane.", entities: ["port:khor-fakkan", "port:fujairah"] },
  route_deviation: { domain: "supply_chain", eventType: "route_deviation", urgency: "medium", why: "Leaving the declared corridor raises collision risk and may avoid inspection or interference.", entities: ["chokepoint:hormuz"] },
  ais_spoofing: { domain: "defence_security", eventType: "ais_spoofing", urgency: "high", why: "Impossible position jumps mean the reported track cannot be trusted; spoofing hides where a ship really is.", entities: ["chokepoint:hormuz", "port:khor-fakkan"] },
};

const shipName = (id: string) => SCRIPTED_SHIPS.find((s) => s.id === id)?.name ?? id;

/** Signals for each scripted anomaly, labelled SIMULATED, with the detector's numbers in the summary. */
export function anomalySignals(now = Date.now()) {
  return detectScripted().map((a) => {
    const m = ANOMALY_SIGNAL[a.kind];
    const names = a.vesselIds.map(shipName).join(" and ");
    return {
      key: `anomaly:${a.id}`, title: `${ANOMALY_LABEL[a.kind]}: ${names}`, summary: `Simulated movement stream: ${a.summary}`, domain: m.domain, eventType: m.eventType,
      urgency: a.confidence === "high" ? m.urgency : ("medium" as const), impact: "medium" as const, dataMode: "simulated" as const, eventTime: anomalyTime(a.startMin, now),
      whySurfaced: m.why, detectedBy: "rule.voyage_anomaly", entityKeys: m.entities, anomaly: a,
    };
  });
}

// ── Hypotheses ─────────────────────────────────────────────────────────────────────────────────────────────
type Fit = "C" | "I" | "N";
export const HYPOTHESES = [
  { key: "interference", title: "Deliberate interference with navigation", detail: "Jamming or spoofing of satellite navigation and AIS in or near the strait." },
  { key: "evasion", title: "Sanctions evasion or concealed transfers", detail: "Ships hiding positions or meeting at sea to move cargo past controls." },
  { key: "ordinary", title: "Ordinary causes", detail: "Congestion, weather, equipment faults or routine waiting for orders." },
] as const;
type HKey = (typeof HYPOTHESES)[number]["key"];

/** How each kind of evidence bears on each hypothesis (C consistent, I inconsistent, N neutral). */
const FIT: Record<string, Record<HKey, Fit>> = {
  navigation_interference: { interference: "C", evasion: "N", ordinary: "I" },
  navigation_anomaly: { interference: "C", evasion: "C", ordinary: "I" },
  ais_spoofing: { interference: "C", evasion: "C", ordinary: "I" },
  ais_gap: { interference: "N", evasion: "C", ordinary: "C" },
  ship_to_ship: { interference: "N", evasion: "C", ordinary: "I" },
  loitering: { interference: "N", evasion: "C", ordinary: "C" },
  route_deviation: { interference: "C", evasion: "C", ordinary: "C" },
  maritime_flow_drop: { interference: "C", evasion: "N", ordinary: "C" },
  insurance_terms: { interference: "C", evasion: "N", ordinary: "N" },
  sanctions_update: { interference: "N", evasion: "C", ordinary: "N" },
};

export const AREAS: Array<{ key: string; name: string; center: LngLat; radiusKm: number }> = [
  { key: "hormuz", name: "Strait of Hormuz and approaches", center: [56.6, 26.0], radiusKm: 260 },
  { key: "bab-el-mandeb", name: "Bab el-Mandeb and southern Red Sea", center: [43.4, 12.6], radiusKm: 400 },
];
const WINDOW_H = 72;

export interface Member { ref: string; kind: "signal" | "anomaly"; eventType: string; title: string; dataMode: string; at: string; lngLat: LngLat | null; detail: string; signalId?: string; anomaly?: Anomaly }
export interface Finding {
  id: string; area: string; areaName: string; windowFrom: string; windowTo: string; title: string;
  members: Member[]; hypotheses: Array<{ key: string; title: string; detail: string; consistent: number; inconsistent: number; neutral: number; rank: number; tiedWithLeader: boolean }>;
  matrix: Array<{ ref: string; fits: Record<string, Fit> }>; confidence: "low" | "medium" | "high"; confidenceBasis: string; dataModes: string[]; leading: string;
}

export async function correlate(tx: Tx, now = Date.now()): Promise<Finding[]> {
  const sig = (await tx.query(
    `SELECT s.id, s.key, s.title, s.event_type, s.data_mode, s.event_time, s.summary,
            (SELECT json_build_array(e.lon, e.lat) FROM signal_entities se JOIN entities e ON e.id = se.entity_id WHERE se.signal_id = s.id AND e.lat IS NOT NULL ORDER BY e.type = 'chokepoint' DESC LIMIT 1) AS ll
       FROM signals s WHERE s.status <> 'dismissed' AND s.event_time > now() - make_interval(hours => $1)`, [WINDOW_H])).rows as Array<{ id: string; key: string; title: string; event_type: string; data_mode: string; event_time: string; summary: string; ll: LngLat | null }>;
  const anomalyKeys = new Set(sig.filter((s) => s.key.startsWith("anomaly:")).map((s) => s.key.slice("anomaly:".length)));
  const members: Member[] = [];
  for (const s of sig) {
    if (!FIT[s.event_type]) continue;
    const a = s.key.startsWith("anomaly:") ? detectScripted().find((x) => x.id === s.key.slice(8)) : undefined;
    members.push({ ref: `signal:${s.id}`, kind: a ? "anomaly" : "signal", eventType: s.event_type, title: s.title, dataMode: s.data_mode, at: new Date(s.event_time).toISOString(), lngLat: a?.lngLat ?? s.ll, detail: s.summary, signalId: s.id, anomaly: a });
  }
  // Anomalies the detectors found that have no signal yet still count, marked as detector output.
  for (const a of detectScripted()) if (!anomalyKeys.has(a.id)) {
    members.push({ ref: `anomaly:${a.id}`, kind: "anomaly", eventType: ANOMALY_SIGNAL[a.kind].eventType, title: `${ANOMALY_LABEL[a.kind]}: ${a.vesselIds.map(shipName).join(" and ")}`, dataMode: "simulated", at: anomalyTime(a.startMin, now).toISOString(), lngLat: a.lngLat, detail: a.summary, anomaly: a });
  }
  const findings: Finding[] = [];
  for (const area of AREAS) {
    const inArea = members.filter((m) => m.lngLat && km(m.lngLat, area.center) <= area.radiusKm).sort((a, b) => a.at.localeCompare(b.at));
    const kinds = new Set(inArea.map((m) => m.eventType));
    if (inArea.length < 3 || kinds.size < 2) continue;
    const scores = HYPOTHESES.map((h) => {
      const fits = inArea.map((m) => FIT[m.eventType]![h.key]);
      return { ...h, consistent: fits.filter((f) => f === "C").length, inconsistent: fits.filter((f) => f === "I").length, neutral: fits.filter((f) => f === "N").length, rank: 0, tiedWithLeader: false };
    }).sort((a, b) => a.inconsistent - b.inconsistent || b.consistent - a.consistent);
    // Equal scores share a rank: the evidence cannot separate them, and the finding says so.
    scores.forEach((s, i) => { const prev = scores[i - 1]; s.rank = prev && prev.inconsistent === s.inconsistent && prev.consistent === s.consistent ? prev.rank : i + 1; });
    scores.forEach((s) => (s.tiedWithLeader = s.rank === 1));
    const leaders = scores.filter((s) => s.rank === 1);
    const modes = [...new Set(inArea.map((m) => m.dataMode))].sort();
    const observed = inArea.some((m) => m.dataMode === "observed");
    const independent = kinds.size;
    const confidence: Finding["confidence"] = observed && independent >= 4 ? "high" : independent >= 4 || observed ? "medium" : "low";
    const lead = scores[0]!;
    findings.push({
      id: `${area.key}-${new Date(now).toISOString().slice(0, 10)}`, area: area.key, areaName: area.name, windowFrom: inArea[0]!.at, windowTo: inArea.at(-1)!.at,
      title: leaders.length > 1
        ? `${area.name}: ${inArea.length} related events; the evidence cannot yet separate ${leaders.map((l) => `"${l.title.toLowerCase()}"`).join(" from ")}`
        : `${area.name}: ${inArea.length} related events point to "${lead.title.toLowerCase()}"`,
      members: inArea, hypotheses: scores, matrix: inArea.map((m) => ({ ref: m.ref, fits: Object.fromEntries(HYPOTHESES.map((h) => [h.key, FIT[m.eventType]![h.key]])) })),
      confidence, confidenceBasis: `${independent} independent kinds of evidence; ${observed ? "includes observed data" : "all inputs are simulated or synthetic, so confidence is capped"}. The ranking follows the fewest inconsistencies (Analysis of Competing Hypotheses), not the most support.`,
      dataModes: modes, leading: lead.key,
    });
  }
  return findings;
}

/** A source package: everything a reviewer needs to check a finding, with a content hash. */
export async function sourcePackage(tx: Tx, f: Finding, by: { name: string; role: string; institution: string }) {
  const signalIds = f.members.map((m) => m.signalId).filter(Boolean) as string[];
  const evidence = signalIds.length ? (await tx.query(
    `SELECT se.signal_id, se.role, e.title, e.sha256, e.retrieved_at, e.source_version, s.key AS source_key, s.name AS source_name, s.licence, f.id AS fact_id, f.predicate_label, f.value_num, f.unit, f.claim_class
       FROM signal_evidence se LEFT JOIN evidence_objects e ON e.id = se.evidence_id LEFT JOIN sources s ON s.id = e.source_id LEFT JOIN evidence_facts f ON f.id = se.fact_id
      WHERE se.signal_id = ANY($1)`, [signalIds])).rows : [];
  const body = {
    format: "tigeris-source-package/1", generatedAt: new Date().toISOString(), generatedBy: by, classification: "internal",
    finding: { id: f.id, title: f.title, area: f.areaName, window: [f.windowFrom, f.windowTo], confidence: f.confidence, confidenceBasis: f.confidenceBasis, dataModes: f.dataModes },
    hypotheses: f.hypotheses, matrix: f.matrix, method: { name: "Analysis of Competing Hypotheses", rule: "Rank by fewest inconsistent items, then most consistent", detectorThresholds: THRESHOLDS },
    members: f.members.map((m) => ({ ref: m.ref, kind: m.kind, eventType: m.eventType, title: m.title, dataMode: m.dataMode, at: m.at, location: m.lngLat, detail: m.detail, anomalyMetrics: m.anomaly?.metrics ?? null })),
    evidence, notice: "Simulated and synthetic items are labelled. This package supports a human judgement; it is not a decision and nothing in TIGERIS acts on it.",
  };
  const json = JSON.stringify(body, null, 2);
  return { json, sha256: createHash("sha256").update(json).digest("hex") };
}
