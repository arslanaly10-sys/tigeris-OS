/** Data classes carried from ingest to export (TR-013, FR-15). */
export const DATA_CLASSES = [
  "public",
  "third_party_derived",
  "licensed",
  "client_validated",
  "inferred",
  "assumed",
  "synthetic",
  "illustrative",
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

/** Classification labels shown on records and exports (Q096). */
export const CLASSIFICATIONS = ["public", "internal", "confidential", "secret"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

/** The eight case states from the App Flow (Q105). */
export const CASE_STATES = [
  "detected",
  "triaged",
  "analysis",
  "scenario",
  "review",
  "decision",
  "handoff",
  "closed",
] as const;
export type CaseState = (typeof CASE_STATES)[number];

/** Data mode shown persistently in the header. */
export const DATA_MODES = ["public_synthetic", "validated_client"] as const;
export type DataMode = (typeof DATA_MODES)[number];

/** Deployment profiles from the TRD. The demo runs as `controlled_demo`. */
export const ENVIRONMENTS = ["developer_sandbox", "controlled_demo", "sovereign_pilot", "air_gap"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const POLICY_RESULTS = ["PASS", "HOLD", "BLOCK"] as const;
export type PolicyResult = (typeof POLICY_RESULTS)[number];
