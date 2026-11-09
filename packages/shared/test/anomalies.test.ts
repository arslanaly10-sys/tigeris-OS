import { describe, expect, it } from "vitest";
import { detectDark, detectDeviation, detectLoiter, detectScripted, detectShipToShip, detectSpoofing, distanceToCorridorNm, scriptedPosition, SCRIPTED_SHIPS, type TrackReport } from "../src/anomalies";

const r = (t: number, lon: number, lat: number, sogKn = 10): TrackReport => ({ t, lon, lat, sogKn, cogDeg: 90 });

describe("voyage anomaly detectors (slice 4)", () => {
  it("finds an AIS gap longer than 90 minutes and only that one", () => {
    const a = detectDark("v", [r(0, 56, 26), r(10, 56.05, 26), r(200, 56.6, 26), r(210, 56.65, 26)]);
    expect(a).toHaveLength(1);
    expect(a[0]!.metrics.gapMin).toBe(190);
  });
  it("finds loitering only when slow and inside the circle long enough", () => {
    const still = Array.from({ length: 40 }, (_, i) => r(i * 6, 56 + (i % 2) * 0.01, 26, 1));
    expect(detectLoiter("v", still)).toHaveLength(1);
    expect(detectLoiter("v", still.slice(0, 20))).toHaveLength(0); // under three hours
    expect(detectLoiter("v", still.map((x) => ({ ...x, sogKn: 8 })))).toHaveLength(0);
  });
  it("finds two ships stopped alongside each other", () => {
    const a = Array.from({ length: 30 }, (_, i) => r(i * 6, 57.25, 25.3, 0.5));
    const b = a.map((x) => ({ ...x, lon: x.lon + 0.003 }));
    const far = a.map((x) => ({ ...x, lon: x.lon + 0.2 }));
    expect(detectShipToShip({ a, b })).toHaveLength(1);
    expect(detectShipToShip({ a, far })).toHaveLength(0);
  });
  it("measures distance to a corridor and flags a sustained deviation", () => {
    const corridor: Array<[number, number]> = [[56, 26], [58, 26]];
    expect(distanceToCorridorNm([57, 26.5], corridor)).toBeCloseTo(30, 0);
    const track = [r(0, 56.2, 26), r(6, 56.6, 26.4), r(12, 57, 26.45), r(18, 57.3, 26.4), r(24, 57.8, 26)];
    expect(detectDeviation("v", track, corridor)).toHaveLength(1);
  });
  it("flags position jumps that imply impossible speeds", () => {
    const a = detectSpoofing("v", [r(0, 56, 26), r(6, 56.5, 26), r(12, 56.02, 26)]);
    expect(a).toHaveLength(1);
    expect(a[0]!.metrics.maxImpliedKn).toBeGreaterThan(200);
    expect(detectSpoofing("v", [r(0, 56, 26), r(6, 56.02, 26)])).toHaveLength(0);
  });
  it("gives each scripted ship exactly the behaviour it was written for", () => {
    const found = detectScripted();
    const kinds = found.map((a) => a.kind).sort();
    expect(kinds).toEqual(["ais_spoofing", "going_dark", "loitering", "route_deviation", "ship_to_ship"]);
    for (const s of SCRIPTED_SHIPS) expect(found.some((a) => a.kind === s.behaviour && a.vesselIds.includes(s.id)), s.id).toBe(true);
    expect(scriptedPosition(SCRIPTED_SHIPS[0]!, 700).dark).toBe(true);
    expect(scriptedPosition(SCRIPTED_SHIPS[0]!, 300).dark).toBe(false);
  });
});
