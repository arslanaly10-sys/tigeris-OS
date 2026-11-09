import { describe, expect, it } from "vitest";
import { aisTime, shipType, summariseAis, type AisMessage } from "../src/ais";

const W = { from: "2026-11-08T17:00:00Z", to: "2026-11-08T17:10:00Z" };
const pos = (mmsi: number, lat: number, lon: number, t: string, extra: Record<string, unknown> = {}): AisMessage => ({
  MessageType: "PositionReport",
  MetaData: { MMSI: mmsi, ShipName: "", latitude: lat, longitude: lon, time_utc: `2026-11-08 ${t}.000000 +0000 UTC` },
  Message: { PositionReport: { Latitude: lat, Longitude: lon, Sog: 12.4, Cog: 110.2, TrueHeading: 111, NavigationalStatus: 0, ...extra } },
});
const statics = (mmsi: number, name: string, type: number, destination = "FUJAIRAH"): AisMessage => ({
  MessageType: "ShipStaticData", MetaData: { MMSI: mmsi, ShipName: name },
  Message: { ShipStaticData: { Name: `${name}@@@@`, Type: type, Destination: destination, CallSign: "ABCD1", ImoNumber: 9123456, Dimension: { A: 200, B: 50, C: 20, D: 20 }, MaximumStaticDraught: 14.2 } },
});

describe("AIS snapshot summary (observed vessels)", () => {
  it("keeps the latest position per vessel and merges static data", () => {
    const s = summariseAis([pos(111111111, 26.5, 56.3, "17:01:00"), pos(111111111, 26.52, 56.35, "17:05:00"), statics(111111111, "GULF STAR", 84)], W);
    expect(s.vessels).toHaveLength(1);
    const v = s.vessels[0]!;
    expect([v.lat, v.lon, v.observedAt, v.reports]).toEqual([26.52, 56.35, "2026-11-08T17:05:00Z", 2]);
    expect([v.name, v.category, v.typeLabel, v.destination, v.imo, v.lengthM, v.draughtM, v.navStatus]).toEqual(["GULF STAR", "tanker", "Tanker", "FUJAIRAH", "9123456", 250, 14.2, "Under way using engine"]);
  });

  it("drops positions outside the box, invalid positions and pleasure craft, and counts each", () => {
    const s = summariseAis([pos(1, 20.0, 50.0, "17:01:00"), pos(2, 91, 181, "17:01:00"), pos(3, 26.0, 56.0, "17:02:00"), statics(3, "SEA BREEZE", 37), pos(4, 26.1, 56.1, "17:02:00")], W);
    expect(s.vessels.map((v) => v.mmsi)).toEqual(["4"]);
    expect(s.excluded).toEqual({ pleasureOrSailing: 1, outsideBox: 1, invalidPosition: 1 });
    expect(s.positionReports).toBe(4);
  });

  it("treats AIS 'not available' values as missing", () => {
    const s = summariseAis([pos(5, 26.2, 56.2, "17:03:00", { Sog: 102.3, Cog: 360, TrueHeading: 511, NavigationalStatus: 15 })], W);
    const v = s.vessels[0]!;
    expect([v.sogKn, v.cogDeg, v.headingDeg, v.navStatus, v.category]).toEqual([null, null, null, null, "other"]);
  });

  it("maps ship type codes and AIS timestamps", () => {
    expect(shipType(81).category).toBe("tanker");
    expect(shipType(70).category).toBe("cargo");
    expect(shipType(52).label).toBe("Tug");
    expect(aisTime("2026-11-08 17:22:31.123456 +0000 UTC", "x")).toBe("2026-11-08T17:22:31Z");
    expect(aisTime(undefined, "fallback")).toBe("fallback");
  });
});

import { estimatePosition } from "../src/ais";
describe("estimated positions from the last AIS report", () => {
  const seen = "2026-11-08T12:00:00Z";
  const t = (min: number) => Date.parse(seen) + min * 60_000;
  it("moves a ship along its course at its speed: 12 kn due east for an hour is 12 nm east", () => {
    const e = estimatePosition({ lat: 26, lon: 56, sogKn: 12, cogDeg: 90, observedAt: seen }, t(60));
    expect(e.lat).toBeCloseTo(26, 6);
    expect((e.lon - 56) * 60 * Math.cos((26 * Math.PI) / 180)).toBeCloseTo(12, 6);
    expect(e.moving).toBe(true);
  });
  it("keeps stopped or unreported ships where they were seen", () => {
    expect(estimatePosition({ lat: 26, lon: 56, sogKn: 0.2, cogDeg: 90, observedAt: seen }, t(60))).toMatchObject({ lat: 26, lon: 56, moving: false });
    expect(estimatePosition({ lat: 26, lon: 56, sogKn: null, cogDeg: null, observedAt: seen }, t(60))).toMatchObject({ lat: 26, lon: 56, moving: false });
  });
  it("stops extrapolating after the limit and says so", () => {
    const a = estimatePosition({ lat: 26, lon: 56, sogKn: 10, cogDeg: 0, observedAt: seen }, t(6 * 60));
    const b = estimatePosition({ lat: 26, lon: 56, sogKn: 10, cogDeg: 0, observedAt: seen }, t(12 * 60));
    expect(b.lat).toBeCloseTo(a.lat, 9);
    expect([b.capped, b.moving]).toEqual([true, false]);
  });
});
