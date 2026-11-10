import { describe, expect, it } from "vitest";
import { DEFAULT_SHOCK, SLEEVES_BEFORE, TX_EDGES, normaliseOutlook, simulate, OUTLOOK_DEFAULT } from "../src";

describe("shock simulator (brief §5)", () => {
  const run = simulate(DEFAULT_SHOCK);
  const n = (id: string) => run.nodes.find((x) => x.id === id)!;
  it("propagates first, second and third order exactly by the edge coefficients", () => {
    expect(n("freight").value).toBeCloseTo(-1.6 * -18, 9); // 28.8%
    expect(n("oilrev").value).toBeCloseTo(0.9 * 8.4 + 0.5 * -18, 2);
    expect(n("imports").value).toBeCloseTo(0.25 * 8.4 + 0.4 * 28.8, 2);
    const fiscal = (0.06 * n("oilrev").value - 0.03 * n("imports").value) * (45 / 60); // 60-day lag, 45-day shock
    expect(n("fiscal").value).toBeCloseTo(fiscal, 1);
    expect(n("freight").contributions[0]).toMatchObject({ from: "tanker", coef: -1.6, parent: -18, assumptionStatus: "placeholder" });
  });
  it("scales slow edges by how long the disruption lasts", () => {
    const short = simulate({ ...DEFAULT_SHOCK, durationDays: 15 });
    expect(short.nodes.find((x) => x.id === "buffer")!.value).toBeCloseTo(1.2 * -18 * 0.5, 9);
    expect(n("buffer").value).toBeCloseTo(1.2 * -18, 9);
  });
  it("re-derives the sleeves and keeps them summing to 100%", () => {
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(SLEEVES_BEFORE)).toBe(100);
    expect(sum(run.sleeves.after)).toBeCloseTo(100, 6);
    expect(run.sleeves.after.balanced).toBeLessThan(SLEEVES_BEFORE.balanced);
  });
  it("normalises the scenario outlook to exactly 100%", () => {
    expect(normaliseOutlook(OUTLOOK_DEFAULT).reduce((a, r) => a + r.pct, 0)).toBe(100);
    expect(normaliseOutlook([{ key: "a", label: "a", weight: 1 }, { key: "b", label: "b", weight: 1 }, { key: "c", label: "c", weight: 1 }]).map((r) => r.pct)).toEqual([34, 33, 33]);
  });
  it("is fast and deterministic", () => {
    const t = performance.now(); for (let i = 0; i < 200; i++) simulate(DEFAULT_SHOCK); expect((performance.now() - t) / 200).toBeLessThan(300);
    expect(simulate(DEFAULT_SHOCK).nodes.map((x) => x.value)).toEqual(run.nodes.map((x) => x.value));
    expect(TX_EDGES.every((x) => x.assumptionStatus === "placeholder")).toBe(true);
  });
});
