import type { BenchmarkStatus } from "./diagnosis-rubric";

/**
 * Value-at-stake defaults (brief v3 §4). Modelled in PERCENTAGE POINTS of AUM: the CEO said "basis points", but his
 * $10–30B on ~$1T only works as 1–3 percentage points. Every assumption carries a source and a benchmark status;
 * unverified ones are flagged on screen and in exports. No licence price is stored here (pricing stays out of the
 * public repository); the ROI line appears only when the user enters one.
 */
export interface Assumption { key: string; label: string; value: number; unit: "usd" | "share" | "years" | "days" | "%"; source: string; benchmarkStatus: BenchmarkStatus; min?: number; max?: number; step?: number }

export const VALUATION_DEFAULTS: Assumption[] = [
  { key: "aum_usd", label: "Capital under the mandate", value: 100e9, unit: "usd", source: "Illustrative $100B mandate, as in the client's sandbox (synthetic for Fund A)", benchmarkStatus: "placeholder", min: 1e9, max: 2e12, step: 1e9 },
  { key: "structural_inefficiency", label: "Structural inefficiency (ceiling)", value: 0.15, unit: "share", source: "CEO, citing McKinsey/BCG at 10–20%; exact source not yet located (OPEN_QUESTIONS #1)", benchmarkStatus: "unverified", min: 0.05, max: 0.3, step: 0.01 },
  { key: "improvement_low", label: "Improvement in value realization, low", value: 0.01, unit: "share", source: "CEO's example: 1–3 points", benchmarkStatus: "unverified", min: 0, max: 0.1, step: 0.0025 },
  { key: "improvement_base", label: "Improvement in value realization, base", value: 0.02, unit: "share", source: "CEO's example: 1–3 points", benchmarkStatus: "unverified", min: 0, max: 0.1, step: 0.0025 },
  { key: "improvement_high", label: "Improvement in value realization, high", value: 0.03, unit: "share", source: "CEO's example: 1–3 points", benchmarkStatus: "unverified", min: 0, max: 0.1, step: 0.0025 },
  { key: "years", label: "Years to realise", value: 5, unit: "years", source: "Brief v3 §4.1 default", benchmarkStatus: "placeholder", min: 1, max: 10, step: 1 },
];

/** Before → after KPIs: current values come from the diagnosis inputs; targets are editable assumptions (placeholders). */
export const KPI_DEFS = [
  { key: "time_to_governed_action_days", label: "Time to governed action", unit: "days", target: 3, better: "lower" },
  { key: "signal_to_owner_days", label: "Signal-to-owner latency", unit: "days", target: 0.5, better: "lower" },
  { key: "audit_trail_pct", label: "Decisions with a full audit trail", unit: "%", target: 98, better: "higher" },
  { key: "rationale_pct", label: "Decisions with recorded rationale", unit: "%", target: 90, better: "higher" },
  { key: "value_captured_pct", label: "Identified value captured", unit: "%", target: 50, better: "higher" },
] as const;
