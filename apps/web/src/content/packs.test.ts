import { describe, expect, it } from "vitest";
import { PACKS, assess } from "./packs";

const verdicts = (key: string) => { const p = PACKS.find((x) => x.key === key)!; return Object.fromEntries(p.queue.items.map((i) => [i.id, assess(p.queue, i).label])); };

describe("Sovereign OS pack queues: the recommendation comes from the rules alone", () => {
  it("has four packs with six workflows and six queue items each", () => {
    expect(PACKS.map((p) => p.key)).toEqual(["finance", "health", "insurance", "government"]);
    for (const p of PACKS) { expect(p.workflows).toHaveLength(6); expect(p.queue.items).toHaveLength(6); }
  });
  it("finance: a sanctions match holds; limits breached need information", () => {
    expect(verdicts("finance")).toEqual({ "FIN-101": "Ready for decision", "FIN-102": "Needs information", "FIN-103": "Hold", "FIN-104": "Needs information", "FIN-105": "Needs information", "FIN-106": "Ready for decision" });
  });
  it("health: an uncredentialed requester holds; a missed clock needs information", () => {
    expect(verdicts("health")).toEqual({ "HLT-201": "Ready for decision", "HLT-202": "Needs information", "HLT-203": "Needs information", "HLT-204": "Hold", "HLT-205": "Ready for decision", "HLT-206": "Needs information" });
  });
  it("insurance: no coverage holds; reserve is min(claimed, limit) less the deductible", () => {
    expect(verdicts("insurance")).toEqual({ "INS-301": "Ready for decision", "INS-302": "Needs information", "INS-303": "Needs information", "INS-304": "Needs information", "INS-305": "Hold", "INS-306": "Ready for decision" });
    expect(PACKS[2]!.queue.items.find((i) => i.id === "INS-302")!.f.reserve).toBe(14.5);
  });
  it("government: unregistered or sanctioned bidders hold", () => {
    expect(verdicts("government")).toEqual({ "GOV-401": "Ready for decision", "GOV-402": "Needs information", "GOV-403": "Needs information", "GOV-404": "Hold", "GOV-405": "Hold", "GOV-406": "Ready for decision" });
  });
});
