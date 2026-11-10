/**
 * Hormuz transmission graph (brief v3 §5.2). Transparent and linear: each node's change is the sum of coefficient ×
 * parent change, scaled by how much of the edge's lag the disruption lasts. Every coefficient is a PLACEHOLDER until
 * sourced (assumptionStatus). The engine computes; the AI only narrates (§12).
 */
export type Order = 1 | 2 | 3;
export interface TxNode { id: string; label: string; order: Order; unit: "%" | "pp" | "days" | "priority"; note: string }
export interface TxEdge { from: string; to: string; coef: number; lagDays: number; assumptionStatus: "placeholder" | "sourced" }
export interface ShockParams { durationDays: number; throughputChangePct: number; warRiskChangePct: number; brentMovePct: number }

export const TRANSMISSION_VERSION = "transmission.v1-placeholder";

/** Defaults from the client's sandbox narrative (tanker throughput −18%, war-risk +250%, Brent +8.4%), 45 days. */
export const DEFAULT_SHOCK: ShockParams = { durationDays: 45, throughputChangePct: -18, warRiskChangePct: 250, brentMovePct: 8.4 };
/** Baselines used to turn changes into levels on the impact panel. Placeholders, labelled as such. */
export const BASELINES = { brentUsd: 80, bufferDays: 45, warRiskPremiumPctHull: 0.2 } as const;

export const TX_NODES: TxNode[] = [
  { id: "tanker", label: "Tanker throughput", order: 1, unit: "%", note: "Shock parameter" },
  { id: "brent", label: "Brent", order: 1, unit: "%", note: "Shock parameter" },
  { id: "warrisk", label: "War-risk insurance", order: 1, unit: "%", note: "Shock parameter" },
  { id: "freight", label: "Freight cost", order: 1, unit: "%", note: "Fewer transits raise freight" },
  { id: "oilrev", label: "Oil revenue", order: 2, unit: "%", note: "Price up, volume down" },
  { id: "imports", label: "Import costs", order: 2, unit: "%", note: "Freight and fuel pass through" },
  { id: "inflation", label: "Inflation risk", order: 2, unit: "pp", note: "90-day estimate" },
  { id: "buffer", label: "Buffer days", order: 2, unit: "days", note: "Critical categories, change from baseline" },
  { id: "portfolio", label: "Portfolio exposure", order: 2, unit: "%", note: "Mark-to-market on exposed holdings" },
  { id: "fiscal", label: "Fiscal balance", order: 3, unit: "pp", note: "Share of GDP" },
  { id: "sleeves", label: "Sleeve reallocation", order: 3, unit: "%", note: "Share of the mandate to move" },
  { id: "corridors", label: "Alternative corridors", order: 3, unit: "priority", note: "Opportunity priority 0–100" },
  { id: "storage", label: "Strategic storage", order: 3, unit: "priority", note: "Opportunity priority 0–100" },
  { id: "industry", label: "Industrial acceleration", order: 3, unit: "priority", note: "Opportunity priority 0–100" },
  { id: "partners", label: "Energy partnerships", order: 3, unit: "priority", note: "Opportunity priority 0–100" },
];

const e = (from: string, to: string, coef: number, lagDays: number): TxEdge => ({ from, to, coef, lagDays, assumptionStatus: "placeholder" });
export const TX_EDGES: TxEdge[] = [
  e("tanker", "freight", -1.6, 3),
  e("brent", "oilrev", 0.9, 14), e("tanker", "oilrev", 0.5, 7),
  e("brent", "imports", 0.25, 21), e("freight", "imports", 0.4, 14),
  e("brent", "inflation", 0.03, 30), e("freight", "inflation", 0.02, 30), e("warrisk", "inflation", 0.001, 30),
  e("tanker", "buffer", 1.2, 30),
  e("freight", "portfolio", -0.08, 7), e("warrisk", "portfolio", -0.004, 7), e("brent", "portfolio", 0.05, 7),
  e("oilrev", "fiscal", 0.06, 60), e("imports", "fiscal", -0.03, 60),
  e("portfolio", "sleeves", -0.5, 30), e("inflation", "sleeves", 1.0, 30),
  e("buffer", "corridors", -2, 30), e("inflation", "corridors", 10, 30),
  e("buffer", "storage", -2.5, 30),
  e("imports", "industry", 2, 90),
  e("imports", "partners", 1.5, 60), e("oilrev", "partners", -1, 60),
];
