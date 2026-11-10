import { describe, expect, it } from "vitest";
import { DEFAULT_SHOCK, FUND_A_INPUTS, buildFacts, cachedBrief, diagnose, simulate, validateBrief, valuation, authorityFor } from "../src";

const Q = "How do we turn the Hormuz disruption into sovereign capability within 5 months?";
const d = diagnose(FUND_A_INPUTS);
const v = valuation({ aumUsd: 100e9, structuralInefficiency: 0.15, improvement: { low: 0.01, base: 0.02, high: 0.03 }, years: 5 }, d);
const F = buildFacts(simulate(DEFAULT_SHOCK), d, v, 100e9);

describe("decision brief (brief §12)", () => {
  it("cites only engine facts and passes validation", () => {
    const b = cachedBrief(Q, F);
    expect(validateBrief(b, F)).toEqual([]);
    expect(b.effects.first.length + b.effects.second.length + b.effects.third.length).toBeGreaterThan(6);
    expect(b.plan72h.every((p) => p.dueHours <= 72)).toBe(true);
    expect(b.meta).toMatchObject({ model: "cache", promptVersion: "brief.cached.v1" });
  });
  it("rejects an invented number and a claim without evidence", () => {
    const b = cachedBrief(Q, F);
    b.effects.second[0]!.text = "Import costs rise 37.3% next quarter.";
    b.effects.third[0]!.evidenceRefs = [];
    const problems = validateBrief(b, F);
    expect(problems.some((p) => p.includes("37.3"))).toBe(true);
    expect(problems.some((p) => p.startsWith("Claim without evidence"))).toBe(true);
  });
  it("routes authority by size: the modelled shift sits with the Governance Officer, larger moves with the board", () => {
    expect(authorityFor("reallocation", F["sim.shift_pct"]!.value).role).toBe("approver");
    expect(authorityFor("reallocation", 5)).toMatchObject({ role: "executive", approvals: 2 });
  });
  it("is cached: the same facts and question give the same input hash", () => {
    expect(cachedBrief(Q, F).meta.inputHash).toBe(cachedBrief(Q, F).meta.inputHash);
    expect(cachedBrief("Another question", F).meta.inputHash).not.toBe(cachedBrief(Q, F).meta.inputHash);
  });
});
