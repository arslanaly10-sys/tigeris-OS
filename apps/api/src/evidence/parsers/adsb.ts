import type { AdsbSnapshot } from "@tigeris/shared";
import type { FactDraft, ParseResult } from "./types";

/** ADS-B snapshot: one observed fact per reported field per aircraft, each traceable to the capture (rule 7). */
export function parseAdsbSnapshot(bytes: Buffer): ParseResult {
  const s = JSON.parse(bytes.toString("utf8")) as AdsbSnapshot;
  const facts: FactDraft[] = [{
    subject: "adsb:gulf", subjectLabel: "Gulf ADS-B capture", predicate: "aircraft_observed", predicateLabel: "Airline flights observed",
    valueNum: s.aircraft.length, unit: "aircraft", period: s.capturedAt, claimClass: "observed", locator: "aircraft", method: "json_path",
    excerpt: `${s.seen} aircraft reports from ${s.points.join(", ")} at ${s.capturedAt}; ${s.excluded.notAirline} non-airline aircraft dropped.`,
  }];
  s.aircraft.forEach((a, i) => {
    const base = { subject: `aircraft:${a.hex}`, subjectLabel: a.callsign, period: a.observedAt, claimClass: "observed" as const, method: "json_path" };
    const add = (predicate: string, predicateLabel: string, field: string, v: { valueNum?: number | null; valueText?: string | null; unit?: string; qualifier?: string }) => {
      if (v.valueNum == null && v.valueText == null) return;
      facts.push({ ...base, predicate, predicateLabel, locator: `aircraft[${i}].${field}`, ...v });
    };
    add("callsign", "Callsign", "callsign", { valueText: a.callsign });
    add("operator_code", "Operator code (ICAO)", "operator", { valueText: a.operator });
    add("aircraft_type", "Aircraft type (ICAO)", "typeCode", { valueText: a.typeCode });
    add("position_lat", "Latitude", "lat", { valueNum: a.lat, unit: "°" });
    add("position_lon", "Longitude", "lon", { valueNum: a.lon, unit: "°" });
    add("altitude_ft", "Barometric altitude", "altitudeFt", { valueNum: a.altitudeFt, unit: "ft" });
    add("on_ground", "On the ground", "onGround", { valueText: a.onGround ? "yes" : null });
    add("ground_speed", "Ground speed", "gsKn", { valueNum: a.gsKn, unit: "kn" });
    add("track", "Track", "trackDeg", { valueNum: a.trackDeg, unit: "°" });
  });
  return { facts };
}
