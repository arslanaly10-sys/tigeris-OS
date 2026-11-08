import type { AisSnapshot } from "@tigeris/shared";
import type { FactDraft, ParseResult } from "./types";

/**
 * AIS snapshot: one observed fact per reported field per vessel, so every position, speed and destination
 * on the map links back to the capture it came from (rule 7). Values are what the ship broadcast.
 */
export function parseAisSnapshot(bytes: Buffer): ParseResult {
  const s = JSON.parse(bytes.toString("utf8")) as AisSnapshot;
  const facts: FactDraft[] = [{
    subject: "ais:hormuz", subjectLabel: "Strait of Hormuz AIS capture", predicate: "vessels_observed", predicateLabel: "Vessels observed in the capture window",
    valueNum: s.vessels.length, unit: "vessels", period: s.capturedTo, claimClass: "observed", locator: "vessels", method: "json_path",
    excerpt: `${s.messages} AIS messages from ${s.capturedFrom} to ${s.capturedTo} inside lat ${s.bbox[0][0]}–${s.bbox[1][0]}, lon ${s.bbox[0][1]}–${s.bbox[1][1]}.`,
  }];
  s.vessels.forEach((v, i) => {
    const base = { subject: `vessel:mmsi:${v.mmsi}`, subjectLabel: v.name ?? `MMSI ${v.mmsi}`, period: v.observedAt, claimClass: "observed" as const, method: "json_path" };
    const add = (predicate: string, predicateLabel: string, field: string, value: { valueNum?: number | null; valueText?: string | null; unit?: string; qualifier?: string }) => {
      if (value.valueNum == null && value.valueText == null) return;
      facts.push({ ...base, predicate, predicateLabel, locator: `vessels[${i}].${field}`, ...value });
    };
    add("ais_mmsi", "MMSI", "mmsi", { valueText: v.mmsi });
    add("position_lat", "Latitude", "lat", { valueNum: v.lat, unit: "°" });
    add("position_lon", "Longitude", "lon", { valueNum: v.lon, unit: "°" });
    add("speed_over_ground", "Speed over ground", "sogKn", { valueNum: v.sogKn, unit: "kn" });
    add("course_over_ground", "Course over ground", "cogDeg", { valueNum: v.cogDeg, unit: "°" });
    add("heading", "Heading", "headingDeg", { valueNum: v.headingDeg, unit: "°" });
    add("ship_type", "Ship type", "shipTypeCode", { valueNum: v.shipTypeCode, valueText: v.typeLabel, qualifier: "AIS type code" });
    add("nav_status", "Navigational status", "navStatus", { valueText: v.navStatus });
    add("destination", "Reported destination", "destination", { valueText: v.destination, qualifier: "As entered by the crew; often abbreviated or out of date" });
    add("imo_number", "IMO number", "imo", { valueText: v.imo });
    add("call_sign", "Call sign", "callSign", { valueText: v.callSign });
    add("length_m", "Length", "lengthM", { valueNum: v.lengthM, unit: "m" });
    add("draught_m", "Draught", "draughtM", { valueNum: v.draughtM, unit: "m", qualifier: "Reported maximum static draught" });
  });
  return { facts };
}
