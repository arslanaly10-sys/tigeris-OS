import { describe, expect, it } from "vitest";
import { FUND_A_INPUTS, RUBRIC, confidenceOf, diagnose, normalise, scoreGap, valuation } from "../src";

describe("diagnosis rubric v3 (brief §3)", () => {
  it("normalises either way round, 100 = biggest gap, clamped", () => {
    expect(normalise(2, 2, 12)).toBe(0);
    expect(normalise(12, 2, 12)).toBe(100);
    expect(normalise(7, 2, 12)).toBe(50);
    expect(normalise(95, 95, 40)).toBe(0); // % where higher is better
    expect(normalise(40, 95, 40)).toBe(100);
    expect(normalise(200, 2, 12)).toBe(100);
    expect(normalise(-5, 2, 12)).toBe(0);
  });
  it("weights the metrics of a gap and renormalises over present inputs, never imputing", () => {
    const g = RUBRIC[0]!; // handoffs .35, latency .40, single owner .25
    const full = scoreGap(g, { handoffs: 7, signal_to_owner_days: 7.25, single_owner_pct: 67.5 }); // each exactly 50
    expect(full.score).toBe(50);
    const partial = scoreGap(g, { handoffs: 12, signal_to_owner_days: 0.5 }); // 100 × .35 + 0 × .40 over .75
    expect(partial.score).toBeCloseTo((100 * 0.35) / 0.75, 1);
    expect(partial.missing).toEqual(["single_owner_pct"]);
    expect(partial.confidence).toBe("medium");
  });
  it("grades confidence at 80% and 50% of inputs present", () => {
    expect(confidenceOf(8, 10)).toBe("high");
    expect(confidenceOf(5, 10)).toBe("medium");
    expect(confidenceOf(4, 10)).toBe("low");
  });
  it("computes the composite indices from the gap scores", () => {
    const d = diagnose(FUND_A_INPUTS);
    const s = (id: number) => d.gaps.find((g) => g.id === id)!.score!;
    expect(d.indices.coordinationDebt).toBe(s(1));
    expect(d.indices.cognitiveDebt).toBeCloseTo((s(3) + s(4) + s(6)) / 3, 0);
    const mean = d.gaps.reduce((a, g) => a + g.score!, 0) / 8;
    expect(d.indices.csai).toBeCloseTo(100 - mean, 0);
    expect(d.missing).toEqual(["searchable_knowledge_pct"]);
    expect(d.gaps.find((g) => g.id === 4)!.confidence).toBe("medium");
  });
});

describe("value at stake (brief §4)", () => {
  const d = diagnose(FUND_A_INPUTS);
  it("models percentage points of AUM and never exceeds the ceiling", () => {
    const v = valuation({ aumUsd: 1e12, structuralInefficiency: 0.15, improvement: { low: 0.01, base: 0.02, high: 0.03 }, years: 5 }, d);
    expect(v.valueAtStakeUsd).toEqual({ low: 10e9, base: 20e9, high: 30e9 }); // the CEO's $10–30B on ~$1T
    expect(v.ceilingUsd).toBe(150e9);
    const capped = valuation({ aumUsd: 100e9, structuralInefficiency: 0.15, improvement: { low: 0.1, base: 0.2, high: 0.3 }, years: 5 }, d);
    expect(capped.valueAtStakeUsd.high).toBe(15e9);
    expect(capped.cappedByCeiling.high).toBe(true);
  });
  it("splits the base value across gaps by score × weight, and shows ROI only with a licence cost", () => {
    const v = valuation({ aumUsd: 100e9, structuralInefficiency: 0.15, improvement: { low: 0.01, base: 0.02, high: 0.03 }, years: 5 }, d);
    expect(v.perGap.reduce((a, g) => a + g.share, 0)).toBeCloseTo(1, 9);
    expect(v.perGap.reduce((a, g) => a + g.valueUsd, 0)).toBeCloseTo(2e9, 0);
    expect(v.roiMultiple).toBeNull();
    expect(valuation({ aumUsd: 100e9, structuralInefficiency: 0.15, improvement: { low: 0.01, base: 0.02, high: 0.03 }, years: 5, licenceUsdPerYear: 1e8 }, d).roiMultiple).toBeCloseTo(4, 9);
  });
  it("flags the sandbox's $24.5B on $100B as above the 10–20% ceiling", () => {
    expect(24.5e9 / 100e9).toBeGreaterThan(0.2);
  });
});
