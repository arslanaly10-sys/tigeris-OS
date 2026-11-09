import { describe, expect, it } from "vitest";
import { DEALS, HOLDINGS, MANDATE, boardReport, fundSummary, icMemo, monitorHolding, screenDeal } from "../src";

const byKey = (k: string) => screenDeal(DEALS.find((d) => d.key === k)!);

describe("fund apps (synthetic)", () => {
  it("screens deals against the mandate and says why", () => {
    expect(byKey("D-101").result).toBe("advance");
    const coal = byKey("D-106");
    expect(coal.result).toBe("decline");
    expect(coal.criteria.find((c) => c.key === "sector")!.verdict).toBe("fail");
    expect(byKey("D-104").criteria.find((c) => c.key === "ticket")!.verdict).toBe("fail"); // above the ticket maximum
    expect(byKey("D-107").criteria.find((c) => c.key === "leverage")!.verdict).toBe("watch"); // 100/24 = 4.2x, between watch and limit
  });
  it("computes valuation and concentration arithmetic exactly", () => {
    const s = byKey("D-101");
    expect(s.impliedEvUsd).toBeCloseTo(180e6 / 0.3 + 95e6, 0);
    expect(s.evToEbitda).toBeCloseTo((600e6 + 95e6) / 46e6, 6);
    const food = HOLDINGS.filter((h) => h.sector === "food security").reduce((a, h) => a + h.valueUsd, 0);
    expect(s.sectorShareAfter).toBeCloseTo((food + 180e6) / (MANDATE.navUsd + 180e6), 9);
  });
  it("flags covenant breaches, short runways and value drops", () => {
    expect(monitorHolding(HOLDINGS.find((h) => h.key === "H-06")!).checks.find((c) => c.key === "covenant")!.verdict).toBe("fail");
    expect(monitorHolding(HOLDINGS.find((h) => h.key === "H-04")!).status).toBe("fail");
    expect(monitorHolding(HOLDINGS.find((h) => h.key === "H-01")!).status).toBe("pass");
    const f = fundSummary();
    expect(f.moic).toBeCloseTo(f.value / f.invested, 9);
    expect(f.breaches.map((x) => x.holding.key).sort()).toEqual(["H-04", "H-06"]);
  });
  it("labels the memo and the report as synthetic and keeps figures from the records", () => {
    const memo = icMemo(byKey("D-102"));
    expect(memo).toMatch(/Synthetic/);
    expect(memo).toMatch(/\$420 m for 45%/);
    const report = boardReport("Q3 2026");
    expect(report).toMatch(/Synthetic/);
    expect(report).toMatch(/BREACH\*\* Barakah Agri-Tech/);
  });
});
