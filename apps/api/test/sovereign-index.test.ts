import { describe, expect, it } from "vitest";
import { SCI_WEIGHTS, sciScore } from "../src/routes/sovereignty";

describe("Sovereign Capability Index", () => {
  it("weights control, convergence and operationalisation 0.4 / 0.3 / 0.3", () => {
    expect(SCI_WEIGHTS.control + SCI_WEIGHTS.convergence + SCI_WEIGHTS.operational).toBeCloseTo(1);
    expect(sciScore(1, 1, 1)).toBe(100);
    expect(sciScore(0, 0, 0)).toBe(0);
  });
  it("is deterministic and rounded to one decimal", () => {
    // 4 sovereign + 2 partly of 6 layers = 5/6; 5 of 6 functions live; 3 of 8 items operational
    expect(sciScore(5 / 6, 5 / 6, 3 / 8)).toBe(69.6);
  });
});
