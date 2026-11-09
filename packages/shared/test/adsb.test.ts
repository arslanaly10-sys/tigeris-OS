import { describe, expect, it } from "vitest";
import { aircraftKind, summariseAdsb } from "../src/adsb";

const T = "2026-11-09T10:00:00.000Z";
describe("ADS-B snapshot summary (observed aircraft)", () => {
  it("keeps airline flights, merges overlapping replies by aircraft, keeps the newest fix", () => {
    const now = Date.parse(T);
    const s = summariseAdsb([
      { now, ac: [{ hex: "AAA111", flight: "QTR8150 ", t: "B77L", lat: 25.1, lon: 55.2, alt_baro: 23375, gs: 445.6, track: 120.4, seen_pos: 10 }] },
      { now, ac: [{ hex: "aaa111", flight: "QTR8150", t: "B77L", lat: 25.2, lon: 55.3, alt_baro: 23500, gs: 446, track: 121, seen_pos: 2 }, { hex: "bbb222", flight: "A6ABC", lat: 25, lon: 55 }, { hex: "ccc333", flight: "UAE5LN", lat: 24.4, lon: 54.6, alt_baro: "ground", gs: 0 }, { hex: "ddd444", flight: "FDB4GP" }] },
    ], T, ["Dubai", "Doha"]);
    expect(s.aircraft.map((a) => a.callsign)).toEqual(["QTR8150", "UAE5LN"]);
    const q = s.aircraft[0]!;
    expect([q.lat, q.lon, q.altitudeFt, q.gsKn, q.trackDeg, q.operator, q.observedAt]).toEqual([25.2, 55.3, 23500, 446, 121, "QTR", "2026-11-09T09:59:58.000Z"]);
    expect(s.aircraft[1]!.onGround).toBe(true);
    expect(s.excluded).toEqual({ notAirline: 1, noPosition: 1, duplicate: 1 });
    expect(s.seen).toBe(5);
  });
  it("classifies aircraft for the map icon", () => {
    expect(aircraftKind("B77L", "QTR8150")).toBe("airliner_wide");
    expect(aircraftKind("A320", "SVA543")).toBe("airliner_narrow");
    expect(aircraftKind("B763", "FDX12")).toBe("freighter");
  });
});
