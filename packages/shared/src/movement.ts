/**
 * Movement simulation for the map (Q082, Q083, Q086, Q087; MAP §3–6).
 * Deterministic and SYNTHETIC: fictional vessels and trucks on approximate real lanes and roads.
 * It never represents a real vessel's position. Same inputs always give the same positions,
 * so a replay can be reproduced (FR-30).
 */
export type LngLat = [number, number];
export type VesselType = "crude_tanker" | "lng_carrier" | "product_tanker" | "container" | "bulk_grain";
export type Scenario = "baseline" | "hormuz_disruption" | "red_sea_reroute";

export interface Lane { key: string; name: string; points: LngLat[]; viaHormuz: boolean; viaRedSea: boolean; kind: "sea" | "road" | "scenario" }
export interface Vessel { id: string; name: string; type: VesselType; lane: string; speedKn: number; phase: number; direction: 1 | -1; flag: string }
export interface Truck { id: string; name: string; lane: string; speedKmh: number; phase: number; direction: 1 | -1; cargo: string }
export interface MovingPoint {
  id: string; name: string; kind: "vessel" | "truck"; type: string; lngLat: LngLat; bearing: number; status: "underway" | "holding" | "rerouted";
  lane: string; laneName: string; speedLabel: string; detail: string;
}

// Shared sea legs (lon, lat). Approximate traffic lanes, simplified.
const GULF_TRUNK: LngLat[] = [[48.9, 29.3], [50.4, 27.9], [51.6, 26.95], [53.5, 26.6], [55.3, 26.35], [56.35, 26.55], [56.9, 26.0], [57.6, 25.4], [58.6, 24.9], [60.5, 24.1], [63.0, 22.5]];
const TO_INDIA: LngLat[] = [[63.0, 22.5], [67.0, 20.5], [71.5, 19.2]];
const TO_ASIA: LngLat[] = [[63.0, 22.5], [67.5, 16.0], [74.0, 9.5], [79.5, 5.8]];
const RED_SEA: LngLat[] = [[51.5, 12.8], [47.0, 12.2], [43.45, 12.6], [42.2, 14.6], [40.3, 18.5], [38.8, 21.4], [37.4, 24.2], [35.2, 26.9], [33.8, 28.3], [32.55, 29.9]];
const CAPE: LngLat[] = [[51.5, 12.8], [51.0, 4.0], [45.0, -8.0], [40.0, -20.0], [33.0, -30.0], [25.0, -35.5], [18.4, -34.6]];
const ARABIAN_SEA_TO_ADEN: LngLat[] = [[63.0, 22.5], [60.0, 18.5], [56.0, 15.2], [51.5, 12.8]];

const join = (...legs: LngLat[][]): LngLat[] => legs.flatMap((l, i) => (i === 0 ? l : l.slice(1)));
const spur = (from: LngLat[], ...rest: LngLat[][]) => join(from, ...rest);

/** Trunk from a given index of GULF_TRUNK outwards. */
const trunkFrom = (i: number) => GULF_TRUNK.slice(i);

export const LANES: Lane[] = [
  { key: "gulf-kuwait-asia", name: "Kuwait and Basra to Asia via Hormuz", points: join(GULF_TRUNK, TO_ASIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "ras-tanura-asia", name: "Ras Tanura to Asia via Hormuz", points: spur([[50.2, 26.65], [50.9, 26.95]], trunkFrom(2), TO_ASIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "ras-tanura-india", name: "Ras Tanura to India via Hormuz", points: spur([[50.2, 26.65], [50.9, 26.95]], trunkFrom(2), TO_INDIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "ras-laffan-asia", name: "Ras Laffan LNG to Asia via Hormuz", points: spur([[51.62, 25.95], [52.4, 26.45]], trunkFrom(3), TO_ASIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "das-asia", name: "Das Island to Asia via Hormuz", points: spur([[52.9, 25.2], [53.6, 25.95]], trunkFrom(4), TO_ASIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "jebel-ali-india", name: "Jebel Ali to India via Hormuz", points: spur([[55.0, 25.05], [55.1, 25.6], [55.6, 26.15]], trunkFrom(5), TO_INDIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "jebel-ali-europe", name: "Jebel Ali to Europe via Hormuz and the Red Sea", points: spur([[55.0, 25.05], [55.1, 25.6], [55.6, 26.15]], trunkFrom(5), ARABIAN_SEA_TO_ADEN, RED_SEA), viaHormuz: true, viaRedSea: true, kind: "sea" },
  { key: "dammam-grain", name: "Grain to Dammam via Hormuz", points: spur([[50.2, 26.5], [50.9, 26.95]], trunkFrom(2), TO_INDIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "hamad-asia", name: "Hamad Port to Asia via Hormuz", points: spur([[51.62, 25.0], [52.2, 25.9]], trunkFrom(3), TO_ASIA), viaHormuz: true, viaRedSea: false, kind: "sea" },
  { key: "fujairah-asia", name: "Fujairah to Asia (outside Hormuz)", points: spur([[56.38, 25.17], [57.6, 25.0]], [[58.6, 24.9], [60.5, 24.1], [63.0, 22.5]], TO_ASIA), viaHormuz: false, viaRedSea: false, kind: "sea" },
  { key: "sohar-india", name: "Sohar to India (outside Hormuz)", points: spur([[56.75, 24.5], [58.0, 24.2]], [[60.5, 24.1], [63.0, 22.5]], TO_INDIA), viaHormuz: false, viaRedSea: false, kind: "sea" },
  { key: "yanbu-suez", name: "Yanbu to Suez (Red Sea)", points: spur([[38.2, 23.95], [37.4, 24.2]], RED_SEA.slice(7)), viaHormuz: false, viaRedSea: true, kind: "sea" },
  { key: "jeddah-europe", name: "Jeddah to Europe via Suez", points: spur([[39.1, 21.47], [38.8, 21.4]], RED_SEA.slice(6)), viaHormuz: false, viaRedSea: true, kind: "sea" },
  { key: "asia-europe-red-sea", name: "Asia to Europe via Bab el-Mandeb and Suez", points: join(TO_ASIA.slice().reverse(), ARABIAN_SEA_TO_ADEN.slice(1), RED_SEA.slice(1)), viaHormuz: false, viaRedSea: true, kind: "sea" },
  { key: "salalah-aden", name: "Salalah towards the Gulf of Aden", points: [[54.0, 16.9], [53.0, 15.0], [51.5, 12.8], [47.0, 12.2]], viaHormuz: false, viaRedSea: true, kind: "sea" },
];

/** Alternative route used by the Red Sea rerouting scenario (shown dashed). */
export const CAPE_LANE: Lane = { key: "cape-route", name: "Cape of Good Hope route (rerouting)", points: join(TO_ASIA.slice().reverse(), ARABIAN_SEA_TO_ADEN.slice(1), CAPE), viaHormuz: false, viaRedSea: false, kind: "scenario" };

export const ROADS: Lane[] = [
  { key: "dammam-riyadh", name: "Dammam–Riyadh corridor", points: [[50.1, 26.43], [49.6, 25.9], [47.6, 24.9], [46.7, 24.7]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "riyadh-jeddah", name: "Riyadh–Jeddah corridor", points: [[46.7, 24.7], [44.5, 23.7], [42.0, 22.4], [39.8, 21.5], [39.2, 21.5]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "jebel-ali-ruwais", name: "Jebel Ali–Abu Dhabi–Ruwais corridor", points: [[55.05, 25.0], [54.6, 24.6], [54.4, 24.45], [53.4, 24.1], [52.7, 24.1]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "fujairah-dubai", name: "Fujairah–Dubai corridor", points: [[56.33, 25.12], [55.9, 25.2], [55.3, 25.2]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "sohar-muscat", name: "Sohar–Muscat corridor", points: [[56.7, 24.36], [57.5, 23.8], [58.4, 23.6]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "kuwait-dammam", name: "Kuwait–Dammam corridor", points: [[47.98, 29.37], [48.4, 28.4], [49.6, 27.0], [50.1, 26.43]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "doha-riyadh", name: "Doha–Riyadh corridor", points: [[51.53, 25.29], [51.0, 24.7], [50.8, 24.75], [49.0, 24.5], [46.7, 24.7]], viaHormuz: false, viaRedSea: false, kind: "road" },
  { key: "jeddah-mecca", name: "Jeddah port–Mecca corridor", points: [[39.17, 21.47], [39.86, 21.39]], viaHormuz: false, viaRedSea: false, kind: "road" },
];

/** Approximate pipeline routes for the infrastructure layer (curated, ILLUSTRATIVE geometry). */
export const PIPELINE_PATHS: Record<string, LngLat[]> = {
  "pipeline:east-west": [[49.67, 25.93], [47.5, 25.0], [44.5, 24.6], [41.5, 24.3], [38.25, 23.95]],
  "pipeline:adcop": [[53.67, 23.83], [54.6, 24.2], [55.7, 24.6], [56.36, 25.17]],
  "pipeline:goreh-jask": [[51.1, 29.0], [54.5, 27.4], [57.77, 25.64]],
  "pipeline:dolphin": [[51.55, 25.92], [52.6, 25.5], [54.69, 24.77]],
  "pipeline:ab-bahrain": [[49.67, 25.93], [50.3, 26.0], [50.63, 26.15]],
  "pipeline:sumed": [[32.35, 29.6], [31.2, 30.4], [29.6, 31.0]],
};

/** Where vessels wait in the Hormuz disruption scenario. */
export const ANCHORAGES: Record<"gulf" | "fujairah", LngLat> = { gulf: [55.4, 26.0], fujairah: [56.62, 25.15] };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
export function km(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

interface Measured { lane: Lane; cumulative: number[]; total: number }
const measured = new Map<string, Measured>();
function measure(lane: Lane): Measured {
  const m = measured.get(lane.key);
  if (m) return m;
  const cumulative = [0];
  for (let i = 1; i < lane.points.length; i++) cumulative.push(cumulative[i - 1]! + km(lane.points[i - 1]!, lane.points[i]!));
  const out = { lane, cumulative, total: cumulative.at(-1)! };
  measured.set(lane.key, out);
  return out;
}

/** Position and heading at a distance along a lane (distance wraps around the lane length). */
export function pointAlong(lane: Lane, distanceKm: number, direction: 1 | -1 = 1): { lngLat: LngLat; bearing: number } {
  const m = measure(lane);
  let d = ((distanceKm % m.total) + m.total) % m.total;
  if (direction === -1) d = m.total - d;
  let i = 1;
  while (i < m.cumulative.length - 1 && m.cumulative[i]! < d) i++;
  const a = lane.points[i - 1]!;
  const b = lane.points[i]!;
  const seg = m.cumulative[i]! - m.cumulative[i - 1]! || 1;
  const t = (d - m.cumulative[i - 1]!) / seg;
  const p: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { lngLat: p, bearing: direction === 1 ? bearing(a, b) : bearing(b, a) };
}

const ADJ = ["Coral", "Pearl", "Desert", "Falcon", "Amber", "Saffron", "Cedar", "Azure", "Crescent", "Oasis", "Monsoon", "Dune", "Harbour", "Silver", "Northern", "Eastern", "Golden", "Gulf", "Atlas", "Meridian"];
const NOUN = ["Dawn", "Star", "Spirit", "Voyager", "Pride", "Horizon", "Glory", "Trader", "Venture", "Navigator", "Wind", "Tide", "Crest", "Light", "Harmony", "Journey"];
const FLAGS = ["Panama", "Liberia", "Marshall Islands", "Singapore", "Malta", "Bahamas", "Saudi Arabia", "United Arab Emirates", "Greece", "Hong Kong"];
const LANE_TYPES: Record<string, VesselType[]> = {
  "gulf-kuwait-asia": ["crude_tanker", "product_tanker"], "ras-tanura-asia": ["crude_tanker"], "ras-tanura-india": ["crude_tanker", "product_tanker"],
  "ras-laffan-asia": ["lng_carrier"], "das-asia": ["crude_tanker", "lng_carrier"], "jebel-ali-india": ["container", "product_tanker"], "jebel-ali-europe": ["container"],
  "dammam-grain": ["bulk_grain"], "hamad-asia": ["container", "bulk_grain"], "fujairah-asia": ["product_tanker", "crude_tanker"], "sohar-india": ["container", "product_tanker"],
  "yanbu-suez": ["crude_tanker", "product_tanker"], "jeddah-europe": ["container", "bulk_grain"], "asia-europe-red-sea": ["container"], "salalah-aden": ["container"],
};
const SPEED: Record<VesselType, [number, number]> = { crude_tanker: [11, 14], lng_carrier: [15, 18], product_tanker: [11, 14], container: [15, 20], bulk_grain: [10, 13] };
export const VESSEL_LABEL: Record<VesselType, string> = { crude_tanker: "Crude tanker", lng_carrier: "LNG carrier", product_tanker: "Product tanker", container: "Container ship", bulk_grain: "Bulk carrier (grain)" };

/** About 200 fictional vessels, weighted towards the Hormuz lanes. */
export function makeFleet(count = 200, seed = 42): Vessel[] {
  const r = rng(seed);
  const weights = LANES.map((l) => (l.viaHormuz ? 3 : 1.4));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Vessel[] = [];
  for (let i = 0; i < count; i++) {
    let x = r() * total;
    let li = 0;
    while (x > weights[li]!) x -= weights[li++]!;
    const lane = LANES[li]!;
    const types = LANE_TYPES[lane.key]!;
    const type = types[Math.floor(r() * types.length)]!;
    const [lo, hi] = SPEED[type];
    out.push({
      id: `SIM-V${String(i + 1).padStart(3, "0")}`, name: `${ADJ[Math.floor(r() * ADJ.length)]} ${NOUN[Math.floor(r() * NOUN.length)]}`, type, lane: lane.key,
      speedKn: Math.round((lo + r() * (hi - lo)) * 10) / 10, phase: r(), direction: r() < 0.62 ? 1 : -1, flag: FLAGS[Math.floor(r() * FLAGS.length)]!,
    });
  }
  return out;
}

const CARGO = ["Food and groceries", "Construction materials", "Fuel products", "Containers from port", "Medical supplies", "Industrial parts"];
export function makeTrucks(count = 40, seed = 7): Truck[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const lane = ROADS[Math.floor(r() * ROADS.length)]!;
    return { id: `SIM-T${String(i + 1).padStart(3, "0")}`, name: `Truck ${String(i + 1).padStart(3, "0")}`, lane: lane.key, speedKmh: Math.round(70 + r() * 30), phase: r(), direction: r() < 0.5 ? 1 : -1, cargo: CARGO[Math.floor(r() * CARGO.length)]! };
  });
}

const laneByKey = new Map([...LANES, ...ROADS, CAPE_LANE].map((l) => [l.key, l]));
export const laneOf = (key: string) => laneByKey.get(key);

/**
 * Positions at `minutes` after the replay origin under a scenario.
 * hormuz_disruption: about 40% of vessels on Hormuz lanes hold at anchorages either side of the strait.
 * red_sea_reroute: vessels on Red Sea lanes switch to the Cape route.
 */
export function positionsAt(fleet: Vessel[], trucks: Truck[], minutes: number, scenario: Scenario = "baseline"): MovingPoint[] {
  const out: MovingPoint[] = [];
  for (const v of fleet) {
    let lane = laneOf(v.lane)!;
    let status: MovingPoint["status"] = "underway";
    if (scenario === "red_sea_reroute" && lane.viaRedSea) { lane = CAPE_LANE; status = "rerouted"; }
    const m = measure(lane);
    const dist = v.phase * m.total + (v.speedKn * 1.852 * minutes) / 60;
    const holds = scenario === "hormuz_disruption" && lane.viaHormuz && v.phase < 0.4;
    if (holds) {
      const anchor = ANCHORAGES[v.direction === 1 ? "gulf" : "fujairah"];
      const jitter = rng(Number(v.id.slice(5)) * 97);
      out.push({ id: v.id, name: v.name, kind: "vessel", type: v.type, lngLat: [anchor[0] + (jitter() - 0.5) * 0.35, anchor[1] + (jitter() - 0.5) * 0.22], bearing: jitter() * 360, status: "holding", lane: lane.key, laneName: lane.name, speedLabel: "0 kn (holding)", detail: `${VESSEL_LABEL[v.type]} · flag ${v.flag}` });
      continue;
    }
    const p = pointAlong(lane, dist, v.direction);
    out.push({ id: v.id, name: v.name, kind: "vessel", type: v.type, lngLat: p.lngLat, bearing: p.bearing, status, lane: lane.key, laneName: lane.name, speedLabel: `${v.speedKn} kn`, detail: `${VESSEL_LABEL[v.type]} · flag ${v.flag}` });
  }
  for (const t of trucks) {
    const lane = laneOf(t.lane)!;
    const m = measure(lane);
    const p = pointAlong(lane, t.phase * m.total + (t.speedKmh * minutes) / 60, t.direction);
    out.push({ id: t.id, name: t.name, kind: "truck", type: "truck", lngLat: p.lngLat, bearing: p.bearing, status: "underway", lane: lane.key, laneName: lane.name, speedLabel: `${t.speedKmh} km/h`, detail: t.cargo });
  }
  return out;
}

/** Vessels that cross the strait line (lon 56.35) within a window: the transit count shown on the map. */
export function hormuzTransits(fleet: Vessel[], fromMin: number, toMin: number, scenario: Scenario = "baseline"): number {
  let n = 0;
  const step = 20;
  for (let t = fromMin; t < toMin; t += step) {
    const a = positionsAt(fleet, [], t, scenario);
    const b = positionsAt(fleet, [], t + step, scenario);
    for (let i = 0; i < a.length; i++) {
      const x0 = a[i]!.lngLat[0], x1 = b[i]!.lngLat[0];
      if (a[i]!.status !== "holding" && Math.abs(x1 - x0) < 2 && (x0 - 56.35) * (x1 - 56.35) < 0) n++;
    }
  }
  return n;
}
