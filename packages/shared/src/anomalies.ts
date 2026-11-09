/**
 * Voyage anomalies (slice 4, 9 Nov 2026). Pure detectors over position tracks, and six scripted fictional ships
 * that act out each behaviour on a daily cycle so the demo always has something to find. The same detectors run on
 * real AIS tracks when there are enough reports. Ships and aircraft only: no tracking of people.
 *
 * Detectors are deliberately simple, explainable rules with stated thresholds; each finding carries the numbers it
 * rests on, so an analyst can check it.
 */
import { km, type LngLat } from "./movement";

export interface TrackReport { t: number; lon: number; lat: number; sogKn: number | null; cogDeg: number | null }
export type AnomalyKind = "going_dark" | "loitering" | "ship_to_ship" | "route_deviation" | "ais_spoofing";
export interface Anomaly {
  id: string; kind: AnomalyKind; vesselIds: string[]; startMin: number; endMin: number; lngLat: LngLat;
  confidence: "low" | "medium" | "high"; summary: string; metrics: Record<string, number>;
}

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  going_dark: "Going dark (AIS gap)", loitering: "Loitering", ship_to_ship: "Ship-to-ship meeting", route_deviation: "Route deviation", ais_spoofing: "AIS position jumps (possible spoofing)",
};
export const THRESHOLDS = { darkGapMin: 90, loiterRadiusNm: 3, loiterMinDurationMin: 180, loiterMaxKn: 3, stsDistanceNm: 0.5, stsMinDurationMin: 90, stsMaxKn: 1.5, deviationNm: 12, spoofMaxKn: 45 };

const NM = 1.852;
const nm = (a: LngLat, b: LngLat) => km(a, b) / NM;
const fmt = (min: number) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(Math.floor(((min % 60) + 60) % 60)).padStart(2, "0")}`;

/** Gaps between consecutive reports longer than the threshold, with the distance covered across the gap. */
export function detectDark(id: string, track: TrackReport[], gapMin = THRESHOLDS.darkGapMin): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!, b = track[i]!;
    const gap = b.t - a.t;
    if (gap < gapMin) continue;
    const dist = nm([a.lon, a.lat], [b.lon, b.lat]);
    out.push({ id: `${id}:dark:${a.t}`, kind: "going_dark", vesselIds: [id], startMin: a.t, endMin: b.t, lngLat: [a.lon, a.lat], confidence: gap >= 2 * gapMin ? "high" : "medium",
      summary: `No AIS reports for ${Math.round(gap)} minutes (${fmt(a.t)}–${fmt(b.t)}); reappeared ${dist.toFixed(1)} nm away.`, metrics: { gapMin: Math.round(gap), distanceNm: Math.round(dist * 10) / 10 } });
  }
  return out;
}

/** Long stays inside a small circle at low speed, away from the start of the track. */
export function detectLoiter(id: string, track: TrackReport[], o = THRESHOLDS): Anomaly[] {
  const out: Anomaly[] = [];
  let i = 0;
  while (i < track.length) {
    const c: LngLat = [track[i]!.lon, track[i]!.lat];
    let j = i;
    while (j + 1 < track.length && nm(c, [track[j + 1]!.lon, track[j + 1]!.lat]) <= o.loiterRadiusNm && (track[j + 1]!.sogKn ?? 0) <= o.loiterMaxKn) j++;
    const dur = track[j]!.t - track[i]!.t;
    if (dur >= o.loiterMinDurationMin) {
      out.push({ id: `${id}:loiter:${track[i]!.t}`, kind: "loitering", vesselIds: [id], startMin: track[i]!.t, endMin: track[j]!.t, lngLat: c, confidence: dur >= 2 * o.loiterMinDurationMin ? "high" : "medium",
        summary: `Stayed within ${o.loiterRadiusNm} nm at ${o.loiterMaxKn} kn or less for ${Math.round(dur / 60 * 10) / 10} hours (${fmt(track[i]!.t)}–${fmt(track[j]!.t)}).`, metrics: { durationMin: Math.round(dur), radiusNm: o.loiterRadiusNm } });
      i = j + 1;
    } else i++;
  }
  return out;
}

/** Two ships within half a nautical mile, both nearly stopped, for long enough to transfer cargo. */
export function detectShipToShip(tracks: Record<string, TrackReport[]>, o = THRESHOLDS): Anomaly[] {
  const ids = Object.keys(tracks).sort();
  const out: Anomaly[] = [];
  for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
    const a = tracks[ids[x]!]!, b = tracks[ids[y]!]!;
    const byT = new Map(b.map((r) => [r.t, r]));
    let start: TrackReport | null = null, last: TrackReport | null = null, minD = Infinity;
    const close = () => {
      if (start && last && last.t - start.t >= o.stsMinDurationMin) {
        out.push({ id: `sts:${ids[x]}:${ids[y]}:${start.t}`, kind: "ship_to_ship", vesselIds: [ids[x]!, ids[y]!], startMin: start.t, endMin: last.t, lngLat: [start.lon, start.lat], confidence: last.t - start.t >= 2 * o.stsMinDurationMin ? "high" : "medium",
          summary: `Two ships within ${o.stsDistanceNm} nm of each other at ${o.stsMaxKn} kn or less for ${Math.round((last.t - start.t) / 60 * 10) / 10} hours (${fmt(start.t)}–${fmt(last.t)}), away from any port.`, metrics: { durationMin: Math.round(last.t - start.t), closestNm: Math.round(minD * 100) / 100 } });
      }
      start = null; last = null; minD = Infinity;
    };
    for (const r of a) {
      const s = byT.get(r.t);
      const d = s ? nm([r.lon, r.lat], [s.lon, s.lat]) : Infinity;
      if (s && d <= o.stsDistanceNm && (r.sogKn ?? 0) <= o.stsMaxKn && (s.sogKn ?? 0) <= o.stsMaxKn) { start ??= r; last = r; minD = Math.min(minD, d); }
      else close();
    }
    close();
  }
  return out;
}

/** Distance from a point to a polyline corridor, in nautical miles (flat approximation, fine at Gulf scale). */
export function distanceToCorridorNm(p: LngLat, corridor: LngLat[]): number {
  let best = Infinity;
  for (let i = 1; i < corridor.length; i++) {
    const a = corridor[i - 1]!, b = corridor[i]!;
    const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
    const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-12;
    const u = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
    best = Math.min(best, Math.hypot(px - (ax + u * (bx - ax)), py - (ay + u * (by - ay))) * 60);
  }
  return best;
}

/** Stretches of a voyage further from the ship's declared corridor than the threshold. */
export function detectDeviation(id: string, track: TrackReport[], corridor: LngLat[], thresholdNm = THRESHOLDS.deviationNm): Anomaly[] {
  const out: Anomaly[] = [];
  let run: TrackReport[] = [];
  const flush = () => {
    if (run.length >= 3) {
      const far = run.reduce((m, r) => Math.max(m, distanceToCorridorNm([r.lon, r.lat], corridor)), 0);
      const mid = run[Math.floor(run.length / 2)]!;
      out.push({ id: `${id}:dev:${run[0]!.t}`, kind: "route_deviation", vesselIds: [id], startMin: run[0]!.t, endMin: run.at(-1)!.t, lngLat: [mid.lon, mid.lat], confidence: far >= 2 * thresholdNm ? "high" : "medium",
        summary: `Left its corridor by up to ${far.toFixed(1)} nm (threshold ${thresholdNm} nm) between ${fmt(run[0]!.t)} and ${fmt(run.at(-1)!.t)}.`, metrics: { maxOffsetNm: Math.round(far * 10) / 10 } });
    }
    run = [];
  };
  for (const r of track) (distanceToCorridorNm([r.lon, r.lat], corridor) > thresholdNm ? run.push(r) : flush());
  flush();
  return out;
}

/** Consecutive reports that imply an impossible speed: a sign of spoofed or corrupted positions. */
export function detectSpoofing(id: string, track: TrackReport[], maxKn = THRESHOLDS.spoofMaxKn): Anomaly[] {
  const jumps: Array<{ a: TrackReport; b: TrackReport; kn: number; d: number }> = [];
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]!, b = track[i]!;
    const h = (b.t - a.t) / 60;
    if (h <= 0) continue;
    const d = nm([a.lon, a.lat], [b.lon, b.lat]);
    if (d / h > maxKn && d > 5) jumps.push({ a, b, kn: d / h, d });
  }
  if (!jumps.length) return [];
  const first = jumps[0]!, lastJ = jumps.at(-1)!;
  return [{ id: `${id}:spoof:${first.a.t}`, kind: "ais_spoofing", vesselIds: [id], startMin: first.a.t, endMin: lastJ.b.t, lngLat: [first.a.lon, first.a.lat], confidence: jumps.length >= 3 ? "high" : jumps.length === 2 ? "medium" : "low",
    summary: `${jumps.length} position jump(s) of up to ${Math.max(...jumps.map((j) => j.d)).toFixed(0)} nm implying ${Math.max(...jumps.map((j) => j.kn)).toFixed(0)} kn (limit ${maxKn} kn), ${fmt(first.a.t)}–${fmt(lastJ.b.t)}.`,
    metrics: { jumps: jumps.length, maxImpliedKn: Math.round(Math.max(...jumps.map((j) => j.kn))), maxJumpNm: Math.round(Math.max(...jumps.map((j) => j.d))) } }];
}

// ── Scripted fictional ships (SYNTHETIC) ────────────────────────────────────────────────────────────────────
type Waypoint = [number, number, number]; // minute of day, lon, lat
export interface ScriptedShip { id: string; name: string; type: "crude_tanker" | "product_tanker" | "bulk_grain" | "container"; behaviour: AnomalyKind; waypoints: Waypoint[]; dark?: [number, number]; spoofAt?: number[]; corridor?: LngLat[] }

const HORMUZ_CORRIDOR: LngLat[] = [[55.3, 26.35], [56.35, 26.55], [56.9, 26.0], [57.6, 25.4], [58.6, 24.9], [60.5, 24.1], [63.0, 22.5]];
export const SCRIPTED_SHIPS: ScriptedShip[] = [
  { id: "SIM-X01", name: "Northern Tide", type: "crude_tanker", behaviour: "going_dark", waypoints: [[0, 54.0, 26.5], [600, 56.1, 26.5], [870, 56.9, 26.0], [1439, 59.4, 24.6]], dark: [610, 860] },
  { id: "SIM-X02", name: "Amber Crest", type: "crude_tanker", behaviour: "ship_to_ship", waypoints: [[0, 58.6, 24.4], [450, 57.25, 25.3], [780, 57.25, 25.3], [1439, 59.8, 24.0]] },
  { id: "SIM-X03", name: "Cedar Light", type: "product_tanker", behaviour: "ship_to_ship", waypoints: [[0, 56.6, 25.9], [450, 57.255, 25.304], [780, 57.255, 25.304], [1439, 55.4, 26.2]] },
  { id: "SIM-X04", name: "Desert Venture", type: "bulk_grain", behaviour: "loitering", waypoints: [[0, 57.4, 24.9], [330, 56.95, 25.45], [960, 56.95, 25.45], [1439, 57.9, 24.7]] },
  { id: "SIM-X05", name: "Silver Horizon", type: "container", behaviour: "route_deviation", waypoints: [[0, 55.4, 26.3], [300, 56.4, 26.5], [480, 56.9, 26.0], [660, 57.9, 25.85], [840, 58.6, 24.9], [1439, 61.5, 23.6]], corridor: HORMUZ_CORRIDOR },
  { id: "SIM-X06", name: "Coral Navigator", type: "product_tanker", behaviour: "ais_spoofing", waypoints: [[0, 58.4, 24.8], [1439, 55.6, 26.3]], spoofAt: [900, 918, 936] },
];

function interp(w: Waypoint[], t: number): LngLat {
  if (t <= w[0]![0]) return [w[0]![1], w[0]![2]];
  for (let i = 1; i < w.length; i++) if (t <= w[i]![0]) {
    const a = w[i - 1]!, b = w[i]!;
    const u = (t - a[0]) / (b[0] - a[0] || 1);
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  }
  const l = w.at(-1)!;
  return [l[1], l[2]];
}

/** The AIS reports a scripted ship would send over a day: every 6 minutes, with its scripted gap or jumps. */
export function scriptedTrack(s: ScriptedShip, stepMin = 6): TrackReport[] {
  const out: TrackReport[] = [];
  for (let t = 0; t < 1440; t += stepMin) {
    if (s.dark && t > s.dark[0] && t < s.dark[1]) continue;
    let [lon, lat] = interp(s.waypoints, t);
    const [lon2, lat2] = interp(s.waypoints, Math.min(1439, t + stepMin));
    const dist = nm([lon, lat], [lon2, lat2]);
    const sog = (dist / stepMin) * 60;
    const cog = ((Math.atan2((lon2 - lon) * Math.cos(lat * Math.PI / 180), lat2 - lat) * 180) / Math.PI + 360) % 360;
    if (s.spoofAt?.includes(t)) { lon += 0.45; lat += 0.12; }
    out.push({ t, lon, lat, sogKn: Math.round(sog * 10) / 10, cogDeg: Math.round(cog) });
  }
  return out;
}

/** Where a scripted ship is at a minute of the day; null while it is dark (no AIS). */
export function scriptedPosition(s: ScriptedShip, minute: number): { lngLat: LngLat; bearing: number; dark: boolean } {
  const t = ((minute % 1440) + 1440) % 1440;
  const p = interp(s.waypoints, t);
  const q = interp(s.waypoints, Math.min(1439, t + 3));
  const bearing = ((Math.atan2((q[0] - p[0]) * Math.cos(p[1] * Math.PI / 180), q[1] - p[1]) * 180) / Math.PI + 360) % 360;
  return { lngLat: p, bearing, dark: !!s.dark && t > s.dark[0] && t < s.dark[1] };
}

/** Runs every detector over the scripted ships' day. Deterministic: the same anomalies every run. */
export function detectScripted(): Anomaly[] {
  const tracks = Object.fromEntries(SCRIPTED_SHIPS.map((s) => [s.id, scriptedTrack(s)]));
  const out: Anomaly[] = [];
  for (const s of SCRIPTED_SHIPS) {
    const tr = tracks[s.id]!;
    out.push(...detectDark(s.id, tr), ...detectLoiter(s.id, tr), ...detectSpoofing(s.id, tr));
    if (s.corridor) out.push(...detectDeviation(s.id, tr, s.corridor));
  }
  const sts = detectShipToShip(tracks);
  // A ship stopped alongside another is reported once, as a ship-to-ship meeting, not also as loitering.
  const covered = (a: Anomaly) => a.kind === "loitering" && sts.some((m) => m.vesselIds.includes(a.vesselIds[0]!) && a.startMin <= m.endMin && a.endMin >= m.startMin);
  return [...out.filter((a) => !covered(a)), ...sts].sort((a, b) => a.startMin - b.startMin);
}
