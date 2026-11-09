import { describe, expect, it } from "vitest";
import { DEFAULT_INDUSTRY, INDUSTRIES, isIndustry, jobTitle } from "../src/industries";
import { ROLES } from "../src/roles";

describe("industries (sign-in lens)", () => {
  it("has the eight domain packs plus four more, each key once", () => {
    expect(INDUSTRIES).toHaveLength(12);
    expect(new Set(INDUSTRIES.map((i) => i.key)).size).toBe(12);
    for (const k of ["sovereign_capital", "energy", "banking", "supply_chain", "infrastructure", "manufacturing", "construction_real_estate", "insurance", "defence_security", "healthcare", "telecoms", "transport_aviation"]) expect(isIndustry(k)).toBe(true);
    expect(isIndustry(DEFAULT_INDUSTRY)).toBe(true);
    expect(isIndustry("crypto")).toBe(false);
  });
  it("gives every permission role a job title in English and Arabic in every industry", () => {
    for (const i of INDUSTRIES) for (const r of ROLES) {
      const [en, ar] = i.titles[r];
      expect(en.length).toBeGreaterThan(3);
      expect(ar).toMatch(/[؀-ۿ]/);
    }
    expect(jobTitle("energy", "domain_expert")).toBe("Head of Crude Trading");
    expect(jobTitle("unknown", "analyst")).toBeUndefined();
  });
});
