/**
 * Observed vessel positions from AIS (Automatic Identification System) broadcasts.
 *
 * The collector listens to aisstream.io for a fixed window outside the sovereign boundary and keeps the
 * latest report per vessel (MMSI) inside the bounding box. Everything here is pure, so the same messages
 * always give the same snapshot and the summary can be tested without a network.
 */

/** Strait of Hormuz and its approaches: south-west and north-east corners as [lat, lon]. */
export const HORMUZ_BBOX: [[number, number], [number, number]] = [[24.6, 54.9], [27.3, 58.2]];

export type AisCategory = "tanker" | "cargo" | "passenger" | "service" | "fishing" | "other";

export interface ObservedVessel {
  mmsi: string;
  name: string | null;
  imo: string | null;
  callSign: string | null;
  shipTypeCode: number | null;
  category: AisCategory;
  typeLabel: string;
  destination: string | null;
  lengthM: number | null;
  draughtM: number | null;
  lat: number;
  lon: number;
  sogKn: number | null;
  cogDeg: number | null;
  headingDeg: number | null;
  navStatus: string | null;
  observedAt: string;
  reports: number;
}

export interface AisSnapshot {
  source: "aisstream.io";
  bbox: [[number, number], [number, number]];
  capturedFrom: string;
  capturedTo: string;
  messages: number;
  positionReports: number;
  excluded: { pleasureOrSailing: number; outsideBox: number; invalidPosition: number };
  vessels: ObservedVessel[];
}

/** Minimal shape of an aisstream.io message; only the fields TIGERIS reads. */
export interface AisMessage {
  MessageType: string;
  MetaData?: { MMSI?: number; ShipName?: string; latitude?: number; longitude?: number; time_utc?: string };
  Message?: Record<string, Record<string, unknown> | undefined>;
}

const NAV_STATUS: Record<number, string> = {
  0: "Under way using engine", 1: "At anchor", 2: "Not under command", 3: "Restricted manoeuvrability",
  4: "Constrained by draught", 5: "Moored", 6: "Aground", 7: "Engaged in fishing", 8: "Under way sailing",
};

/** ITU-R M.1371 ship type code → TIGERIS category and a plain label. */
export function shipType(code: number | null | undefined): { category: AisCategory; label: string } {
  if (code == null || code === 0) return { category: "other", label: "Type not reported" };
  if (code >= 80 && code <= 89) return { category: "tanker", label: "Tanker" };
  if (code >= 70 && code <= 79) return { category: "cargo", label: "Cargo ship" };
  if (code >= 60 && code <= 69) return { category: "passenger", label: "Passenger ship" };
  if (code === 30) return { category: "fishing", label: "Fishing vessel" };
  if (code === 52) return { category: "service", label: "Tug" };
  if (code === 50) return { category: "service", label: "Pilot vessel" };
  if (code === 31 || code === 32) return { category: "service", label: "Towing" };
  if (code === 33) return { category: "service", label: "Dredger" };
  if (code === 35) return { category: "service", label: "Military operations" };
  if (code === 51) return { category: "service", label: "Search and rescue" };
  if (code === 55) return { category: "service", label: "Law enforcement" };
  if (code >= 53 && code <= 59) return { category: "service", label: "Port or harbour service" };
  if (code >= 40 && code <= 49) return { category: "passenger", label: "High-speed craft" };
  if (code === 36 || code === 37) return { category: "other", label: code === 36 ? "Sailing vessel" : "Pleasure craft" };
  return { category: "other", label: "Other vessel" };
}

export const AIS_CATEGORY_LABEL: Record<AisCategory, string> = {
  tanker: "Tankers", cargo: "Cargo ships", passenger: "Passenger ships", service: "Tugs and service vessels", fishing: "Fishing vessels", other: "Other or not reported",
};

const num = (v: unknown, unavailable?: (n: number) => boolean): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return unavailable?.(v) ? null : v;
};
const text = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/@+$/g, "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
};

/** "2026-11-08 17:22:31.123456 +0000 UTC" → ISO 8601. */
export function aisTime(raw: string | undefined, fallback: string): string {
  const m = raw?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}Z` : fallback;
}

const inBox = (lat: number, lon: number, [[s, w], [n, e]]: AisSnapshot["bbox"]) => lat >= s && lat <= n && lon >= w && lon <= e;

/**
 * Keeps the latest position per vessel inside the box and merges static data (name, type, destination).
 * Pleasure craft and sailing yachts are dropped: they are usually private individuals and not relevant here.
 */
export function summariseAis(messages: AisMessage[], window: { from: string; to: string }, bbox = HORMUZ_BBOX): AisSnapshot {
  type Pos = { lat: number; lon: number; sog: number | null; cog: number | null; heading: number | null; nav: number | null; at: string; reports: number };
  const pos = new Map<string, Pos>();
  const stat = new Map<string, { name?: string | null; imo?: string | null; callSign?: string | null; type?: number | null; destination?: string | null; length?: number | null; draught?: number | null }>();
  const excluded = { pleasureOrSailing: 0, outsideBox: 0, invalidPosition: 0 };
  let positionReports = 0;

  for (const m of messages) {
    const mmsi = m.MetaData?.MMSI != null ? String(m.MetaData.MMSI) : null;
    if (!mmsi) continue;
    const at = aisTime(m.MetaData?.time_utc, window.to);
    const body = m.Message?.[m.MessageType] ?? {};
    const s = stat.get(mmsi) ?? {};
    if (m.MetaData?.ShipName && !s.name) s.name = text(m.MetaData.ShipName);

    if (m.MessageType === "PositionReport" || m.MessageType === "StandardClassBPositionReport" || m.MessageType === "ExtendedClassBPositionReport") {
      positionReports++;
      const lat = num(body.Latitude) ?? num(m.MetaData?.latitude);
      const lon = num(body.Longitude) ?? num(m.MetaData?.longitude);
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { excluded.invalidPosition++; continue; }
      if (!inBox(lat, lon, bbox)) { excluded.outsideBox++; continue; }
      const prev = pos.get(mmsi);
      if (!prev || at >= prev.at) {
        pos.set(mmsi, {
          lat, lon, at, reports: (prev?.reports ?? 0) + 1,
          sog: num(body.Sog, (v) => v >= 102.3),
          cog: num(body.Cog, (v) => v >= 360),
          heading: num(body.TrueHeading, (v) => v >= 360),
          nav: m.MessageType === "PositionReport" ? num(body.NavigationalStatus, (v) => v >= 15) : null,
        });
      } else prev.reports++;
    } else if (m.MessageType === "ShipStaticData") {
      s.name = text(body.Name) ?? s.name;
      s.imo = num(body.ImoNumber, (v) => v <= 0) != null ? String(body.ImoNumber) : s.imo;
      s.callSign = text(body.CallSign) ?? s.callSign;
      s.type = num(body.Type, (v) => v <= 0) ?? s.type;
      s.destination = text(body.Destination) ?? s.destination;
      const d = body.Dimension as { A?: number; B?: number } | undefined;
      if (d && (d.A ?? 0) + (d.B ?? 0) > 0) s.length = (d.A ?? 0) + (d.B ?? 0);
      s.draught = num(body.MaximumStaticDraught, (v) => v <= 0) ?? s.draught;
    } else if (m.MessageType === "StaticDataReport") {
      const a = body.ReportA as { Valid?: boolean; Name?: string } | undefined;
      const b = body.ReportB as { Valid?: boolean; ShipType?: number; CallSign?: string; Dimension?: { A?: number; B?: number } } | undefined;
      if (a?.Valid) s.name = text(a.Name) ?? s.name;
      if (b?.Valid) {
        s.type = num(b.ShipType, (v) => v <= 0) ?? s.type;
        s.callSign = text(b.CallSign) ?? s.callSign;
        if (b.Dimension && (b.Dimension.A ?? 0) + (b.Dimension.B ?? 0) > 0) s.length = (b.Dimension.A ?? 0) + (b.Dimension.B ?? 0);
      }
    }
    stat.set(mmsi, s);
  }

  const vessels: ObservedVessel[] = [];
  for (const [mmsi, p] of pos) {
    const s = stat.get(mmsi) ?? {};
    if (s.type === 36 || s.type === 37) { excluded.pleasureOrSailing++; continue; }
    const t = shipType(s.type);
    vessels.push({
      mmsi, name: s.name ?? null, imo: s.imo ?? null, callSign: s.callSign ?? null, shipTypeCode: s.type ?? null,
      category: t.category, typeLabel: t.label, destination: s.destination ?? null, lengthM: s.length ?? null, draughtM: s.draught ?? null,
      lat: Math.round(p.lat * 1e5) / 1e5, lon: Math.round(p.lon * 1e5) / 1e5, sogKn: p.sog, cogDeg: p.cog, headingDeg: p.heading,
      navStatus: p.nav != null ? NAV_STATUS[p.nav] ?? null : null, observedAt: p.at, reports: p.reports,
    });
  }
  vessels.sort((a, b) => a.mmsi.localeCompare(b.mmsi));
  return { source: "aisstream.io", bbox, capturedFrom: window.from, capturedTo: window.to, messages: messages.length, positionReports, excluded, vessels };
}

/** How long an estimate keeps moving a ship past its last report. After that it stays at the estimate and says so. */
export const ESTIMATE_LIMIT_MIN = 6 * 60;

/**
 * Dead reckoning: where a ship would be now if it kept its last reported course and speed.
 * Flat-earth step, accurate to well under a kilometre over the few hours it is used for.
 * Ships that reported no speed or course, or under 0.5 kn, stay where they were seen.
 */
export function estimatePosition(
  v: { lat: number; lon: number; sogKn: number | null; cogDeg: number | null; observedAt: string },
  nowMs: number,
  limitMin = ESTIMATE_LIMIT_MIN,
): { lat: number; lon: number; minutes: number; moving: boolean; capped: boolean } {
  const ageMin = Math.max(0, (nowMs - Date.parse(v.observedAt)) / 60_000);
  if (v.sogKn == null || v.cogDeg == null || v.sogKn < 0.5 || !Number.isFinite(ageMin)) return { lat: v.lat, lon: v.lon, minutes: ageMin, moving: false, capped: false };
  const minutes = Math.min(ageMin, limitMin);
  const nm = v.sogKn * (minutes / 60);
  const rad = (v.cogDeg * Math.PI) / 180;
  const dLat = (nm * Math.cos(rad)) / 60;
  const dLon = (nm * Math.sin(rad)) / (60 * Math.cos((v.lat * Math.PI) / 180));
  return { lat: v.lat + dLat, lon: v.lon + dLon, minutes: ageMin, moving: ageMin < limitMin, capped: ageMin >= limitMin };
}
