/**
 * Observed aircraft from ADS-B (adsb.lol, open data, ODbL). The collector queries a few points that cover
 * the Gulf, merges the replies by aircraft (ICAO hex) and keeps only flights with an airline callsign:
 * private and general-aviation aircraft are dropped, as they can identify individuals.
 * Pure functions, so the snapshot can be tested without a network.
 */

/** Query points (lat, lon, radius in nautical miles; the API allows up to 250). */
export const GULF_ADSB_POINTS: Array<{ name: string; lat: number; lon: number; nm: number }> = [
  { name: "Dubai", lat: 25.25, lon: 55.36, nm: 250 }, { name: "Doha", lat: 25.27, lon: 51.61, nm: 250 }, { name: "Riyadh", lat: 24.96, lon: 46.7, nm: 250 },
  { name: "Kuwait", lat: 29.24, lon: 47.97, nm: 250 }, { name: "Muscat", lat: 23.59, lon: 58.28, nm: 250 }, { name: "Jeddah", lat: 21.68, lon: 39.16, nm: 250 },
];

export interface AdsbRaw { hex?: string; flight?: string; t?: string; category?: string; lat?: number; lon?: number; alt_baro?: number | "ground"; gs?: number; track?: number; seen_pos?: number; squawk?: string }
export interface AdsbReply { now?: number; ac?: AdsbRaw[] }

export interface ObservedAircraft {
  hex: string; callsign: string; operator: string; typeCode: string | null; category: string | null;
  lat: number; lon: number; altitudeFt: number | null; onGround: boolean; gsKn: number | null; trackDeg: number | null; observedAt: string;
}
export interface AdsbSnapshot {
  source: "adsb.lol"; capturedAt: string; points: string[]; replies: number; seen: number;
  excluded: { notAirline: number; noPosition: number; duplicate: number }; aircraft: ObservedAircraft[];
}

/** Airline callsign: three-letter ICAO operator code, then a flight number (e.g. QTR8150, UAE5LN). */
export const AIRLINE_CALLSIGN = /^[A-Z]{3}[0-9][0-9A-Z]{0,3}$/;

export function summariseAdsb(replies: AdsbReply[], capturedAt: string, points: string[] = []): AdsbSnapshot {
  const byHex = new Map<string, ObservedAircraft>();
  const excluded = { notAirline: 0, noPosition: 0, duplicate: 0 };
  let seen = 0;
  for (const r of replies) {
    const now = typeof r.now === "number" ? r.now : Date.parse(capturedAt);
    for (const a of r.ac ?? []) {
      seen++;
      const hex = a.hex?.trim().toLowerCase();
      const callsign = a.flight?.trim().toUpperCase() ?? "";
      if (!hex || typeof a.lat !== "number" || typeof a.lon !== "number") { excluded.noPosition++; continue; }
      if (!AIRLINE_CALLSIGN.test(callsign)) { excluded.notAirline++; continue; }
      const observedAt = new Date(now - (a.seen_pos ?? 0) * 1000).toISOString();
      const prev = byHex.get(hex);
      if (prev) { excluded.duplicate++; if (prev.observedAt >= observedAt) continue; }
      byHex.set(hex, {
        hex, callsign, operator: callsign.slice(0, 3), typeCode: a.t ?? null, category: a.category ?? null,
        lat: Math.round(a.lat * 1e4) / 1e4, lon: Math.round(a.lon * 1e4) / 1e4,
        altitudeFt: typeof a.alt_baro === "number" ? a.alt_baro : null, onGround: a.alt_baro === "ground",
        gsKn: typeof a.gs === "number" ? Math.round(a.gs) : null, trackDeg: typeof a.track === "number" ? Math.round(a.track) : null, observedAt,
      });
    }
  }
  const aircraft = [...byHex.values()].sort((x, y) => x.callsign.localeCompare(y.callsign));
  return { source: "adsb.lol", capturedAt, points, replies: replies.length, seen, excluded, aircraft };
}

/** Wide-body, narrow-body or freighter from the ICAO type code (rough, for the map icon only). */
export function aircraftKind(typeCode: string | null | undefined, callsign = ""): "airliner_wide" | "airliner_narrow" | "freighter" {
  if (/^(FDX|UPS|GTI|CLX|BCS|QAC|ABW|CKS|MPH|BOX|DHK|DHX)/.test(callsign)) return "freighter";
  if (typeCode && /^(B74|B77|B78|A33|A34|A35|A38|B76|IL9|MD1)/.test(typeCode)) return "airliner_wide";
  return "airliner_narrow";
}
