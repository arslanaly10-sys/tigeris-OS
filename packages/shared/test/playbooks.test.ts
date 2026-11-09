import { describe, expect, it } from "vitest";
import { GAP_KEYS, LOOP_STAGES, PLAYBOOKS, SPECIALISTS, playbooksForGap } from "../src";

describe("sovereign playbooks", () => {
  it("has the thirteen Tiger scenarios, each complete, with valid gaps and five hand-offs", () => {
    expect(PLAYBOOKS).toHaveLength(13);
    expect(new Set(PLAYBOOKS.map((p) => p.key)).size).toBe(13);
    for (const p of PLAYBOOKS) {
      expect(p.handoffs).toHaveLength(SPECIALISTS.length - 1);
      expect(p.gaps.length).toBeGreaterThan(0);
      for (const g of p.gaps) expect(GAP_KEYS).toContain(g);
      for (const f of ["intent", "scenario", "doctrine", "constraint", "recommended", "counterfactual", "tradeoff", "validate", "memory", "domain", "template"] as const) expect(p[f].length, `${p.key}.${f}`).toBeGreaterThan(3);
    }
  });
  it("runs the six governed stages and covers every gap with at least one playbook", () => {
    expect(LOOP_STAGES.map((s) => s.key)).toEqual(["intent", "propagate", "challenge", "resilience", "authorize", "remember"]);
    for (const g of GAP_KEYS) expect(playbooksForGap(g).length, g).toBeGreaterThan(0);
  });
});

describe("specialists", () => {
  it("puts each of the ten bounded agents under one of Tiger's six specialists, and every specialist speaks for one", async () => {
    const { AGENT_SPECIALIST, SPECIALISTS, SPECIALIST_ROLE } = await import("../src/playbooks");
    const agents = ["signal_triage", "noise_moderation", "entity_resolution", "document_extraction", "causal_impact", "financial_impact", "scenario_analyst", "sector", "governance_checker", "brief_writer"];
    expect(Object.keys(AGENT_SPECIALIST).sort()).toEqual([...agents].sort());
    for (const sp of SPECIALISTS) {
      expect(Object.values(AGENT_SPECIALIST)).toContain(sp);
      expect(SPECIALIST_ROLE[sp].length).toBeGreaterThan(20);
    }
  });
});
