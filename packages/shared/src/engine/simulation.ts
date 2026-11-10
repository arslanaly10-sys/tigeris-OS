import { BASELINES, TRANSMISSION_VERSION, TX_EDGES, TX_NODES, type ShockParams, type TxEdge, type TxNode } from "../config/transmission";

/**
 * Shock simulator (brief v3 §5): deterministic, propagates first → second → third order through the transmission
 * graph. Each node's value keeps the contributions that made it (provenance drawer). Also re-derives the illustrative
 * mandate sleeves by rule and normalises the scenario outlook to 100%.
 */
export interface Contribution { from: string; coef: number; parent: number; lagFactor: number; value: number; assumptionStatus: string }
export interface SimNode extends TxNode { value: number; contributions: Contribution[] }
export interface SimRun { version: string; params: ShockParams; nodes: SimNode[]; impact: Impact; sleeves: Sleeves; ms: number }
export interface Impact { brentUsd: number; warRiskPct: number; throughputPct: number; inflation90dPp: number; bufferDays: number }
export type SleeveKey = "balanced" | "resilience" | "liquidity" | "localization";
export interface Sleeves { before: Record<SleeveKey, number>; after: Record<SleeveKey, number>; shiftPct: number }

/** Illustrative $100B mandate sleeves (share of mandate, %), as in the client's sandbox. */
export const SLEEVES_BEFORE: Record<SleeveKey, number> = { balanced: 45, resilience: 20, liquidity: 20, localization: 15 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function simulate(params: ShockParams, edges: TxEdge[] = TX_EDGES, nodes: TxNode[] = TX_NODES): SimRun {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const v: Record<string, number> = { tanker: params.throughputChangePct, brent: params.brentMovePct, warrisk: params.warRiskChangePct };
  const contrib: Record<string, Contribution[]> = {};
  // Nodes are listed in order (1 → 2 → 3) and each only depends on earlier ones, so one pass suffices.
  for (const n of nodes) {
    if (n.id in v) { contrib[n.id] = []; continue; }
    const cs = edges.filter((x) => x.to === n.id).map((x) => {
      const parent = v[x.from] ?? 0, lagFactor = Math.min(1, params.durationDays / Math.max(1, x.lagDays));
      return { from: x.from, coef: x.coef, parent, lagFactor: r2(lagFactor), value: x.coef * parent * lagFactor, assumptionStatus: x.assumptionStatus };
    });
    let total = cs.reduce((s, c) => s + c.value, 0);
    if (n.unit === "priority") total = Math.max(0, Math.min(100, total));
    v[n.id] = total;
    contrib[n.id] = cs.map((c) => ({ ...c, value: r2(c.value) }));
  }
  const out = nodes.map((n) => ({ ...n, value: r2(v[n.id]!), contributions: contrib[n.id] ?? [] }));
  const impact: Impact = {
    brentUsd: r2(BASELINES.brentUsd * (1 + params.brentMovePct / 100)),
    warRiskPct: params.warRiskChangePct, throughputPct: params.throughputChangePct,
    inflation90dPp: r2(v.inflation!), bufferDays: r2(Math.max(0, BASELINES.bufferDays + v.buffer!)),
  };
  const shift = Math.max(0, Math.min(SLEEVES_BEFORE.balanced, v.sleeves!));
  const after = { balanced: SLEEVES_BEFORE.balanced - shift, resilience: SLEEVES_BEFORE.resilience + shift * 0.4, liquidity: SLEEVES_BEFORE.liquidity + shift * 0.4, localization: SLEEVES_BEFORE.localization + shift * 0.2 };
  const sleeves: Sleeves = { before: SLEEVES_BEFORE, after: Object.fromEntries(Object.entries(after).map(([k, x]) => [k, r2(x)])) as Record<SleeveKey, number>, shiftPct: r2(shift) };
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return { version: TRANSMISSION_VERSION, params, nodes: out, impact, sleeves, ms: r2(t1 - t0) };
}

/** Scenario outlook: named scenarios with editable weights, always shown normalised to sum to exactly 100%. */
export const OUTLOOK_DEFAULT = [
  { key: "prolonged", label: "Prolonged disruption", weight: 30 },
  { key: "base", label: "Base case", weight: 25 },
  { key: "contained", label: "Contained disruption", weight: 20 },
  { key: "escalation", label: "Regional escalation", weight: 15 },
  { key: "deescalation", label: "De-escalation", weight: 10 },
];
export function normaliseOutlook(rows: Array<{ key: string; label: string; weight: number }>) {
  const total = rows.reduce((s, r) => s + Math.max(0, r.weight), 0) || 1;
  const raw = rows.map((r) => (Math.max(0, r.weight) / total) * 100);
  const floored = raw.map((x) => Math.floor(x));
  let rest = 100 - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; floored[i]!++; rest--; }
  return rows.map((r, i) => ({ ...r, pct: floored[i]! }));
}
