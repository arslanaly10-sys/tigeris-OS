import { describe, expect, it } from "vitest";
import { LANES, hormuzTransits, km, makeFleet, makeTrucks, pointAlong, positionsAt } from "../src/movement";

describe("movement simulation (FR-30, Q082–Q087)", () => {
  const fleet = makeFleet();
  const trucks = makeTrucks();

  it("creates about 200 fictional vessels and 40 trucks with simulation ids", () => {
    expect(fleet).toHaveLength(200);
    expect(trucks).toHaveLength(40);
    expect(fleet.every((v) => v.id.startsWith("SIM-V"))).toBe(true);
  });

  it("is deterministic: the same time gives the same positions", () => {
    expect(positionsAt(fleet, trucks, 300)).toEqual(positionsAt(makeFleet(), makeTrucks(), 300));
  });

  it("moves vessels by their speed", () => {
    const a = positionsAt(fleet, [], 0)[0]!;
    const b = positionsAt(fleet, [], 60)[0]!;
    const moved = km(a.lngLat, b.lngLat);
    expect(moved).toBeGreaterThan(fleet[0]!.speedKn * 1.852 * 0.8);
    expect(moved).toBeLessThan(fleet[0]!.speedKn * 1.852 * 1.2);
  });

  it("puts a point exactly on the lane's first and last points", () => {
    const lane = LANES[0]!;
    expect(pointAlong(lane, 0).lngLat).toEqual(lane.points[0]);
  });

  it("the Hormuz disruption holds vessels and cuts transits through the strait", () => {
    const held = positionsAt(fleet, [], 600, "hormuz_disruption").filter((p) => p.status === "holding").length;
    expect(held).toBeGreaterThan(20);
    const base = hormuzTransits(fleet, 0, 24 * 60);
    const disrupted = hormuzTransits(fleet, 0, 24 * 60, "hormuz_disruption");
    expect(base).toBeGreaterThan(0);
    expect(disrupted).toBeLessThan(base * 0.8);
  });

  it("the Red Sea scenario moves Red Sea traffic onto the Cape route", () => {
    const rerouted = positionsAt(fleet, [], 600, "red_sea_reroute").filter((p) => p.status === "rerouted");
    expect(rerouted.length).toBeGreaterThan(5);
    expect(rerouted.every((p) => p.lane === "cape-route")).toBe(true);
  });
});
