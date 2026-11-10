/**
 * Diagnosis rubric v3 (brief v3 §3). Typed, versioned, editable without touching the engine.
 * Each metric is normalised 0–100 against a benchmark band [best, worst] where 100 = the biggest gap.
 * Every band is a STARTER PLACEHOLDER until sourced and signed off by the client CTO (OPEN_QUESTIONS #6).
 */
export type BenchmarkStatus = "placeholder" | "unverified" | "sourced";

export interface RubricMetric {
  id: string;
  label: string;
  unit: "count" | "days" | "%";
  best: number;
  worst: number;
  weight: number;
  benchmarkStatus: BenchmarkStatus;
}
export interface RubricGap {
  id: number;
  key: string;
  name: string;
  /** Weight of the gap in CSAI (equal by default). */
  weight: number;
  metrics: RubricMetric[];
}

export const RUBRIC_VERSION = "rubric.v3.0-placeholder";

const m = (id: string, label: string, unit: RubricMetric["unit"], best: number, worst: number, weight: number): RubricMetric => ({ id, label, unit, best, worst, weight, benchmarkStatus: "placeholder" });

export const RUBRIC: RubricGap[] = [
  { id: 1, key: "coordination_debt", name: "Coordination debt", weight: 1, metrics: [
    m("handoffs", "Handoffs per cross-institution decision", "count", 2, 12, 0.35),
    m("signal_to_owner_days", "Decision latency, signal to owner assigned", "days", 0.5, 14, 0.4),
    m("single_owner_pct", "Decisions with a single accountable owner", "%", 95, 40, 0.25),
  ] },
  { id: 2, key: "institutional_fragmentation", name: "Institutional fragmentation", weight: 1, metrics: [
    m("shared_layer_pct", "Core institutions on a shared data layer", "%", 90, 10, 0.4),
    m("shared_definitions_pct", "Shared data definitions across institutions", "%", 85, 15, 0.3),
    m("systems_per_mandate", "Disconnected systems per mandate", "count", 2, 15, 0.3),
  ] },
  { id: 3, key: "governance_velocity", name: "Governance velocity", weight: 1, metrics: [
    m("time_to_governed_action_days", "Time to governed action", "days", 1, 30, 0.5),
    m("approval_steps", "Approval steps per material decision", "count", 2, 9, 0.25),
    m("audit_trail_pct", "Decisions with full audit trail", "%", 100, 30, 0.25),
  ] },
  { id: 4, key: "institutional_memory", name: "Institutional memory", weight: 1, metrics: [
    m("rationale_pct", "Decisions with recorded rationale", "%", 90, 20, 0.4),
    m("key_role_turnover_pct", "Key-role annual turnover", "%", 5, 25, 0.3),
    m("searchable_knowledge_pct", "Institutional knowledge in searchable systems", "%", 85, 20, 0.3),
  ] },
  { id: 5, key: "capital_orchestration", name: "Capital orchestration", weight: 1, metrics: [
    m("capital_mapped_pct", "Capital explicitly mapped to national priorities", "%", 90, 30, 0.4),
    m("reallocation_days", "Reallocation lead time", "days", 5, 120, 0.35),
    m("chokepoint_exposure_pct", "Exposure concentrated on one chokepoint or corridor", "%", 10, 50, 0.25),
  ] },
  { id: 6, key: "decision_drift", name: "Decision drift", weight: 1, metrics: [
    m("intent_gap_pct", "Gap between board intent KPIs and executed outcomes", "%", 5, 40, 0.6),
    m("off_target_pct", "Initiatives off-target at mid-point", "%", 10, 50, 0.4),
  ] },
  { id: 7, key: "economic_sovereignty", name: "Economic sovereignty", weight: 1, metrics: [
    m("foreign_intel_pct", "Critical intelligence or data from foreign providers", "%", 20, 90, 0.4),
    m("sovereign_compute_pct", "Domestic or sovereign compute share for critical AI", "%", 80, 10, 0.3),
    m("single_corridor_pct", "Single-corridor dependency for critical imports", "%", 20, 70, 0.3),
  ] },
  { id: 8, key: "value_realization", name: "Value realization", weight: 1, metrics: [
    m("pilots_to_production_pct", "AI pilots reaching production", "%", 60, 6, 0.5),
    m("value_captured_pct", "Identified value actually captured", "%", 70, 10, 0.5),
  ] },
];

export const METRIC_BY_ID: Record<string, RubricMetric & { gapId: number }> = Object.fromEntries(
  RUBRIC.flatMap((g) => g.metrics.map((x) => [x.id, { ...x, gapId: g.id }])),
);

/**
 * Fund A's baseline inputs (golden path). SYNTHETIC: generated for the demonstration, never a real institution's data.
 * One input is deliberately missing to show that confidence drops and nothing is imputed.
 */
export const FUND_A_INPUTS: Record<string, number | null> = {
  handoffs: 9, signal_to_owner_days: 11, single_owner_pct: 52,
  shared_layer_pct: 28, shared_definitions_pct: 30, systems_per_mandate: 11,
  time_to_governed_action_days: 22, approval_steps: 7, audit_trail_pct: 55,
  rationale_pct: 38, key_role_turnover_pct: 18, searchable_knowledge_pct: null,
  capital_mapped_pct: 55, reallocation_days: 75, chokepoint_exposure_pct: 38,
  intent_gap_pct: 27, off_target_pct: 36,
  foreign_intel_pct: 70, sovereign_compute_pct: 30, single_corridor_pct: 52,
  pilots_to_production_pct: 12, value_captured_pct: 22,
};
