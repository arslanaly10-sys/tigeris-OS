"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import Link from "next/link";
import { Crosshair, Globe2, Layers, Map as MapIcon, Pause, Play, Radio, Rows3, SkipBack } from "lucide-react";
import {
  ANOMALY_LABEL, SCRIPTED_SHIPS, scriptedPosition, type AnomalyKind, AIRCRAFT_LABEL, AIR_ROUTES, AIS_CATEGORY_LABEL, ESTIMATE_LIMIT_MIN, estimatePosition, flightsAt, industryOf, makeFlights, CAPE_LANE, LANES, PIPELINE_PATHS, ROADS, VESSEL_LABEL, hormuzTransits, makeFleet, makeTrucks, positionsAt,
  type AisCategory, type MovingPoint, type Scenario,
} from "@tigeris/shared";
import { api } from "@/lib/api";
import { useSession } from "./session-context";
import { formatDate, num } from "@/lib/format";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Drawer, Field } from "./drawer";
import { ClaimBadge } from "./labels";
import { FactValue, useLineage } from "./lineage";
import { cn } from "@/lib/cn";
import { AIS_SHAPE, anomalyImage, infraImage, planeImage, shipImage, truckImage, type InfraShape, type PlaneShape, type ShipShape } from "./map-icons";

interface MapEntity { key: string; name: string; type: string; country: string | null; lat: number; lon: number; claim_class: string; location_quality: string | null; attributes: Record<string, unknown> }
interface ObservedFact { id: string; num: number | null; text: string | null; unit: string | null }
interface ObservedVessel { key: string; mmsi: string; name: string; observedAt: string | null; category: AisCategory; typeLabel: string; lat: number; lon: number; facts: Record<string, ObservedFact | undefined>; track?: Array<{ at: string; lat: number; lon: number }> }
interface ObservedAircraft { key: string; hex: string; callsign: string; observedAt: string | null; kind: PlaneShape; lat: number; lon: number; facts: Record<string, ObservedFact | undefined> }
interface ObservedAirData { capture: { evidenceId: string; retrievedAt: string; window: string; summary: string | null } | null; aircraft: ObservedAircraft[] }
interface ObservedData { capture: { evidenceId: string; validation: string; retrievedAt: string; window: string; summary: string | null; countFactId: string | null } | null; vessels: ObservedVessel[] }
interface MapAnomaly { id: string; kind: AnomalyKind; label: string; vesselIds: string[]; lngLat: [number, number]; at: string; until: string; confidence: string; summary: string; metrics: Record<string, number>; signalId: string | null; dataMode?: string; names?: string[] }
interface AnomalyData { anomalies: MapAnomaly[]; thresholds: Record<string, number>; real: { vessels: number; assessed: number; note: string; anomalies: MapAnomaly[] } }
const allAnomalies = (d: AnomalyData | null) => (d ? [...d.anomalies, ...(d.real.anomalies ?? [])] : []);
const ANOMALY_LETTER: Record<AnomalyKind, string> = { going_dark: "D", loitering: "L", ship_to_ship: "S", route_deviation: "R", ais_spoofing: "J" };
type Selection = { kind: "entity"; key: string } | { kind: "mover"; id: string } | { kind: "observed"; key: string } | { kind: "observed_air"; key: string } | { kind: "anomaly"; id: string };
interface MapSignal { id: string; title: string; urgency: string; data_mode: string; entity_key: string; lat: number; lon: number }

const LAYERS = [
  { key: "observed", label: "Observed ships (AIS)", group: "Movement" },
  { key: "vessels", label: "Simulated ships", group: "Movement" },
  { key: "observed_air", label: "Observed aircraft (ADS-B)", group: "Movement" },
  { key: "aircraft", label: "Simulated aircraft", group: "Movement" },
  { key: "anomalies", label: "Voyage anomalies", group: "Movement" },
  { key: "trucks", label: "Trucks", group: "Movement" },
  { key: "lanes", label: "Shipping corridors", group: "Movement" },
  { key: "roads", label: "Road corridors", group: "Movement" },
  { key: "air_routes", label: "Air corridors", group: "Movement" },
  { key: "ports", label: "Ports and terminals", group: "Infrastructure" },
  { key: "pipelines", label: "Pipelines", group: "Infrastructure" },
  { key: "refineries", label: "Refineries and fields", group: "Infrastructure" },
  { key: "desal", label: "Desalination plants", group: "Infrastructure" },
  { key: "power", label: "Power plants", group: "Infrastructure" },
  { key: "airports", label: "Airports", group: "Infrastructure" },
  { key: "chokepoints", label: "Chokepoints", group: "Context" },
  { key: "borders", label: "Borders", group: "Context" },
  { key: "labels", label: "Labels", group: "Context" },
  { key: "signals", label: "Active signals", group: "Context" },
] as const;
type LayerKey = (typeof LAYERS)[number]["key"];

const ENTITY_LAYER: Record<string, LayerKey> = { port: "ports", terminal: "ports", refinery: "refineries", field: "refineries", facility: "refineries", desalination: "desal", power_plant: "power", airport: "airports", chokepoint: "chokepoints" };
const ASSET_COLOR: Record<string, string> = { ports: "#007785", refineries: "#86581d", desal: "#2a8fa0", power: "#6e519d", airports: "#4b4037", chokepoints: "#c13d34" };
export const MOVER_COLOR: Record<string, string> = { crude_tanker: "#9a5b14", product_tanker: "#c07a1e", lng_carrier: "#007785", container: "#317a45", bulk_grain: "#657b3d", truck: "#4b4037", airliner_wide: "#1447e6", airliner_narrow: "#5b78d6", freighter: "#6e519d" };
const AIR_COLOR: Record<PlaneShape, string> = { airliner_wide: "#1447e6", airliner_narrow: "#5b78d6", freighter: "#6e519d" };
const AIR_ESTIMATE_LIMIT_MIN = 20;
const OBSERVED_COLOR: Record<AisCategory, string> = { tanker: "#9a5b14", cargo: "#317a45", passenger: "#6e519d", service: "#4b4037", fishing: "#007785", other: "#5e5144" };
const HORMUZ_VIEW = { center: [56.45, 26.35] as [number, number], zoom: 7.4 };
const SCENARIOS: { key: Scenario; label: string; note: string }[] = [
  { key: "baseline", label: "Baseline", note: "Normal simulated traffic" },
  { key: "hormuz_disruption", label: "Hormuz disruption", note: "About 40% of vessels on Hormuz lanes hold at anchorages either side of the strait" },
  { key: "red_sea_reroute", label: "Red Sea rerouting", note: "Red Sea traffic moves to the Cape of Good Hope route" },
];
const SPEEDS = [{ label: "1×", minPerSec: 2 }, { label: "10×", minPerSec: 20 }, { label: "60×", minPerSec: 120 }];
const LABELS: Array<[string, number, number, boolean?]> = [
  ["Saudi Arabia", 45.5, 23.6, true], ["UAE", 54.3, 23.4, true], ["Qatar", 51.2, 25.1, true], ["Kuwait", 47.6, 29.4, true], ["Oman", 57.0, 21.0, true], ["Bahrain", 50.55, 26.3, true],
  ["Iran", 54.5, 30.5], ["Iraq", 44.5, 32.5], ["Yemen", 47.5, 15.6], ["Strait of Hormuz", 56.55, 26.85], ["Bab el-Mandeb", 43.4, 12.2], ["Red Sea", 38.6, 20.0], ["Arabian Gulf", 51.4, 27.3], ["Gulf of Oman", 58.3, 24.5], ["Arabian Sea", 62.5, 17.5],
];

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const line = (points: [number, number][], props: Record<string, unknown>): GeoJSON.Feature => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: points } });

/** Registers every map icon once: ship, truck and aircraft silhouettes by type and status, and infrastructure symbols. */
export function registerIcons(m: MLMap) {
  const add = (id: string, img: ImageData) => { if (!m.hasImage(id)) m.addImage(id, img, { pixelRatio: 2 }); };
  for (const t of ["crude_tanker", "product_tanker", "lng_carrier", "container", "bulk_grain"] as ShipShape[]) {
    add(`${t}-underway`, shipImage(t, MOVER_COLOR[t]!)); add(`${t}-holding`, shipImage(t, MOVER_COLOR[t]!, { holding: true })); add(`${t}-rerouted`, shipImage(t, MOVER_COLOR[t]!, { rerouted: true }));
  }
  add("truck-underway", truckImage(MOVER_COLOR.truck!));
  for (const k of Object.keys(AIR_COLOR) as PlaneShape[]) { add(`${k}-underway`, planeImage(k, AIR_COLOR[k])); add(`obsair-${k}`, planeImage(k, AIR_COLOR[k], { observed: true })); }
  for (const [cat, color] of Object.entries(OBSERVED_COLOR)) { const img = shipImage(AIS_SHAPE[cat] ?? "generic", color, { observed: true }); add(`obs-${cat}-moving`, img); add(`obs-${cat}-still`, img); }
  for (const [k, color] of Object.entries(ASSET_COLOR)) add(`infra-${k}`, infraImage(k as InfraShape, color));
  for (const t of ["crude_tanker", "product_tanker", "bulk_grain", "container"] as ShipShape[]) { add(`${t}-flagged`, shipImage(t, MOVER_COLOR[t]!, { flagged: true })); add(`${t}-dark`, shipImage(t, MOVER_COLOR[t]!, { holding: true, flagged: true })); }
  for (const [k, l] of Object.entries(ANOMALY_LETTER)) add(`anomaly-${k}`, anomalyImage(l));
}

export const moverLabel = (p: MovingPoint) => (p.kind === "vessel" ? VESSEL_LABEL[p.type as keyof typeof VESSEL_LABEL] : p.kind === "aircraft" ? AIRCRAFT_LABEL[p.type as keyof typeof AIRCRAFT_LABEL] : "Truck");
/** Map key entries: drawn with the same functions as the map, so the key always matches. */
const MAP_KEY: Array<[string, () => ImageData]> = [
  ["Crude or product tanker", () => shipImage("crude_tanker", MOVER_COLOR.crude_tanker!)],
  ["LNG carrier", () => shipImage("lng_carrier", MOVER_COLOR.lng_carrier!)],
  ["Container ship", () => shipImage("container", MOVER_COLOR.container!)],
  ["Bulk carrier", () => shipImage("bulk_grain", MOVER_COLOR.bulk_grain!)],
  ["Real ship (AIS)", () => shipImage("crude_tanker", OBSERVED_COLOR.tanker, { observed: true })],
  ["Holding at anchor", () => shipImage("crude_tanker", MOVER_COLOR.crude_tanker!, { holding: true })],
  ["Rerouted", () => shipImage("container", MOVER_COLOR.container!, { rerouted: true })],
  ["Aircraft", () => planeImage("airliner_wide", AIR_COLOR.airliner_wide)],
  ["Real aircraft (ADS-B)", () => planeImage("airliner_narrow", AIR_COLOR.airliner_narrow, { observed: true })],
  ["Truck", () => truckImage(MOVER_COLOR.truck!)],
  ["Ship with a voyage anomaly", () => shipImage("crude_tanker", MOVER_COLOR.crude_tanker!, { flagged: true })],
  ["Anomaly (D dark, L loiter, S ship-to-ship, R route, J jumps)", () => anomalyImage("S")],
];

function LegendIcon({ draw }: { draw: () => ImageData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const img = draw(); const c = ref.current; if (!c) return; c.width = img.width; c.height = img.height; c.getContext("2d")!.putImageData(img, 0, 0); }, [draw]);
  return <canvas ref={ref} aria-hidden className="size-5 shrink-0" />;
}

const riyadhMinutes = (ms: number) => { const d = new Date(ms); return ((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000; };
const estimateOf = (v: ObservedVessel, nowMs: number) => estimatePosition({ lat: v.lat, lon: v.lon, sogKn: v.facts.speed_over_ground?.num ?? null, cogDeg: v.facts.course_over_ground?.num ?? v.facts.heading?.num ?? null, observedAt: v.observedAt ?? new Date(nowMs).toISOString() }, nowMs);
const ago = (min: number) => (min < 1 ? "just now" : min < 90 ? `${Math.round(min)} min ago` : min < 48 * 60 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} days ago`);
const vesselBearing = (v: ObservedVessel) => v.facts.heading?.num ?? v.facts.course_over_ground?.num ?? 0;
const airEstimate = (a: ObservedAircraft, nowMs: number) => estimatePosition({ lat: a.lat, lon: a.lon, sogKn: a.facts.on_ground ? 0 : a.facts.ground_speed?.num ?? null, cogDeg: a.facts.track?.num ?? null, observedAt: a.observedAt ?? new Date(nowMs).toISOString() }, nowMs, AIR_ESTIMATE_LIMIT_MIN);
const isMoving = (v: ObservedVessel) => (v.facts.speed_over_ground?.num ?? 0) >= 0.5 && (v.facts.heading?.num != null || v.facts.course_over_ground?.num != null);

export function MovementMap({ compact = false, height }: { compact?: boolean; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const ripples = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<{ entities: MapEntity[]; signals: MapSignal[] } | null>(null);
  const [mode, setMode] = useState<"replay" | "live">("live");
  const [minutes, setMinutes] = useState(() => riyadhMinutes(Date.now()));
  const [playing, setPlaying] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const reduced = useReducedMotion();
  const lastFrame = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState<Scenario>("baseline");
  // Industry lens: the industry's own layers start switched on, plus the context layers; the rest are one click away.
  const session = useSession();
  const [on, setOn] = useState<Set<LayerKey>>(() => {
    const lens = industryOf(session.principal.industry)?.mapLayers ?? LAYERS.map((l) => l.key);
    return new Set(LAYERS.map((l) => l.key).filter((k) => lens.includes(k) || ["borders", "labels", "signals", "chokepoints"].includes(k)));
  });
  const [globe, setGlobe] = useState(false);
  const [view, setView] = useState<"map" | "table">("map");
  const [layersOpen, setLayersOpen] = useState(!compact);
  // On a phone the open layer list would cover the map: start it collapsed there.
  useEffect(() => { if (window.matchMedia("(max-width: 639px)").matches) setLayersOpen(false); }, []);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [observed, setObserved] = useState<ObservedData | null>(null);
  const [observedAir, setObservedAir] = useState<ObservedAirData | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyData | null>(null);

  const fleet = useMemo(() => makeFleet(), []);
  const trucks = useMemo(() => makeTrucks(), []);
  const flights = useMemo(() => makeFlights(), []);
  const movers = useMemo(() => [...positionsAt(fleet, trucks, minutes, scenario), ...flightsAt(flights, minutes)], [fleet, trucks, flights, minutes, scenario]);
  const transits = useMemo(() => ({ base: hormuzTransits(fleet, 0, 1440), now: hormuzTransits(fleet, 0, 1440, scenario) }), [fleet, scenario]);

  useEffect(() => { api<{ entities: MapEntity[]; signals: MapSignal[] }>("/map/layers").then((r) => r.ok && setData(r.data)); }, []);
  useEffect(() => { api<ObservedData>("/map/observed-vessels").then((r) => r.ok && setObserved(r.data)); }, []);
  useEffect(() => { api<ObservedAirData>("/map/observed-aircraft").then((r) => r.ok && setObservedAir(r.data)); }, []);
  useEffect(() => { api<AnomalyData>("/anomalies").then((r) => r.ok && setAnomalies(r.data)); }, []);

  // Clock on Motion's frame loop (about 12 frames a second): live follows the wall clock in Riyadh time and
  // moves ships smoothly between seconds; replay advances by the chosen speed. Reduced motion: one step a second.
  useAnimationFrame((t, delta) => {
    const step = reduced ? 1000 : 80;
    if (t - lastFrame.current < step) return;
    const dt = t - lastFrame.current;
    lastFrame.current = t;
    const now = Date.now();
    setNowMs(now);
    if (mode === "live") setMinutes(riyadhMinutes(now));
    else if (playing) setMinutes((m) => (m + (SPEEDS[speed]!.minPerSec * Math.min(dt, 1000)) / 1000) % 1440);
    void delta;
  });

  // Build the map once.
  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: {
          land: { type: "geojson", data: "/geo/land.geojson" },
          countries: { type: "geojson", data: "/geo/countries.geojson" },
          borders: { type: "geojson", data: "/geo/borders.geojson" },
        },
        layers: [
          { id: "ocean", type: "background", paint: { "background-color": "#e9dfcd" } },
          { id: "land", type: "fill", source: "land", paint: { "fill-color": "#f7f1e6" } },
          { id: "region", type: "fill", source: "countries", paint: { "fill-color": ["case", ["get", "gcc"], "#f3eadb", "#f7f1e6"] } },
          { id: "borders", type: "line", source: "borders", paint: { "line-color": "#b9a281", "line-width": 0.8 } },
        ],
      },
      center: compact ? [52.5, 24.8] : [51.5, 24.5],
      zoom: compact ? 4.3 : 4.6,
      attributionControl: false,
      renderWorldCopies: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    m.on("load", () => {
      registerIcons(m);
      m.addSource("lanes", { type: "geojson", data: fc([]) });
      m.addSource("pipelines", { type: "geojson", data: fc(Object.entries(PIPELINE_PATHS).map(([k, p]) => line(p, { key: k }))) });
      m.addSource("assets", { type: "geojson", data: fc([]) });
      m.addSource("movers", { type: "geojson", data: fc([]) });
      m.addSource("observed", { type: "geojson", data: fc([]) });
      m.addSource("observedAir", { type: "geojson", data: fc([]) });
      m.addSource("anomalyShips", { type: "geojson", data: fc([]) });
      m.addSource("observedTracks", { type: "geojson", data: fc([]) });
      m.addSource("anomalyMarks", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "lanes", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "sea"], paint: { "line-color": "#8a6a45", "line-width": 1.1, "line-opacity": 0.45 } });
      m.addLayer({ id: "cape", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "scenario"], paint: { "line-color": "#d9bd84", "line-width": 1.6, "line-dasharray": [3, 2] } });
      m.addLayer({ id: "roads", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "road"], paint: { "line-color": "#a08a6a", "line-width": 1.3, "line-dasharray": [2, 1.5] } });
      m.addLayer({ id: "air-routes", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "air"], paint: { "line-color": "#6e519d", "line-width": 1, "line-opacity": 0.3, "line-dasharray": [1, 3] } });
      m.addLayer({ id: "pipelines", type: "line", source: "pipelines", paint: { "line-color": "#c9a45c", "line-width": 2, "line-dasharray": [4, 2] } });
      m.addLayer({ id: "assets", type: "symbol", source: "assets", layout: {
        "icon-image": ["concat", "infra-", ["get", "layer"]], "icon-allow-overlap": true, "icon-ignore-placement": true,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 3, ["case", ["==", ["get", "layer"], "chokepoints"], 0.9, 0.6], 8, ["case", ["==", ["get", "layer"], "chokepoints"], 1.3, 1.05]],
      } });
      m.addLayer({ id: "movers", type: "symbol", source: "movers", layout: {
        "icon-image": ["concat", ["get", "type"], "-", ["get", "status"]], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 6, 0.7, 8, 1.25, 10, 1.8],
      } });
      m.addLayer({ id: "observed", type: "symbol", source: "observed", layout: {
        "icon-image": ["concat", "obs-", ["get", "category"], "-", ["get", "motion"]], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 6, 0.7, 8, 1.25, 10, 1.8],
      } });
      m.addLayer({ id: "observedAir", type: "symbol", source: "observedAir", layout: {
        "icon-image": ["concat", "obsair-", ["get", "kind"]], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.45, 6, 0.65, 9, 1],
      } });
      m.addLayer({ id: "observedTracks", type: "line", source: "observedTracks", paint: { "line-color": "#1447e6", "line-width": 1.4, "line-opacity": 0.6, "line-dasharray": [2, 1.5] } });
      m.addLayer({ id: "anomalyMarks", type: "symbol", source: "anomalyMarks", layout: { "icon-image": ["concat", "anomaly-", ["get", "kind"]], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 1.1] } });
      m.addLayer({ id: "anomalyShips", type: "symbol", source: "anomalyShips", layout: {
        "icon-image": ["concat", ["get", "type"], "-", ["get", "state"]], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 6, 0.75, 8, 1.25, 10, 1.8],
      } });
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "tigeris-popup", offset: 10 });
      for (const id of ["assets", "movers", "observed", "observedAir", "anomalyMarks", "anomalyShips"]) {
        m.on("mousemove", id, (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f) popup.setLngLat(e.lngLat).setHTML(`<strong>${String(f.properties.name).replace(/</g, "&lt;")}</strong><br/><span>${String(f.properties.sub).replace(/</g, "&lt;")}</span>`).addTo(m);
        });
        m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; popup.remove(); });
        m.on("click", id, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          setSelected(id === "assets" ? { kind: "entity", key: String(f.properties.key) } : id === "observed" ? { kind: "observed", key: String(f.properties.key) } : id === "observedAir" ? { kind: "observed_air", key: String(f.properties.key) } : id === "anomalyMarks" || id === "anomalyShips" ? { kind: "anomaly", id: String(f.properties.anomaly) } : { kind: "mover", id: String(f.properties.id) });
        });
      }
      setReady(true);
    });
    map.current = m;
    return () => { markers.current.forEach((x) => x.remove()); ripples.current.forEach((x) => x.remove()); m.remove(); map.current = null; };
  }, [compact]);

  // Static layers: lanes by scenario, assets, labels.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const lanes = [...LANES.map((l) => line(l.points, { kind: "sea", name: l.name })), ...ROADS.map((l) => line(l.points, { kind: "road", name: l.name })), ...(scenario === "red_sea_reroute" ? [line(CAPE_LANE.points, { kind: "scenario", name: CAPE_LANE.name })] : []), ...AIR_ROUTES.map((l) => line(l.points, { kind: "air", name: l.name }))];
    (m.getSource("lanes") as GeoJSONSource).setData(fc(lanes));
    if (data) {
      const assets = data.entities.filter((e) => ENTITY_LAYER[e.type]).map((e) => ({ type: "Feature" as const, properties: { key: e.key, name: e.name, layer: ENTITY_LAYER[e.type], color: ASSET_COLOR[ENTITY_LAYER[e.type]!], sub: `${e.type.replace("_", " ")} · approximate location` }, geometry: { type: "Point" as const, coordinates: [e.lon, e.lat] } }));
      (m.getSource("assets") as GeoJSONSource).setData(fc(assets));
    }
  }, [ready, data, scenario]);

  // Layer visibility.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const vis = (id: string, show: boolean) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    vis("lanes", on.has("lanes")); vis("cape", on.has("lanes")); vis("roads", on.has("roads")); vis("pipelines", on.has("pipelines")); vis("borders", on.has("borders")); vis("air-routes", on.has("air_routes"));
    const assetLayers = (["ports", "refineries", "desal", "power", "airports", "chokepoints"] as LayerKey[]).filter((k) => on.has(k));
    m.setFilter("assets", ["in", ["get", "layer"], ["literal", assetLayers]]);
    const kinds = [on.has("vessels") ? "vessel" : "", on.has("trucks") ? "truck" : "", on.has("aircraft") ? "aircraft" : ""].filter(Boolean);
    m.setFilter("movers", ["in", ["get", "kind"], ["literal", kinds]]);
    vis("observed", on.has("observed")); vis("observedTracks", on.has("observed")); vis("observedAir", on.has("observed_air")); vis("anomalyMarks", on.has("anomalies")); vis("anomalyShips", on.has("anomalies"));
    markers.current.forEach((x) => x.remove());
    markers.current = on.has("labels") ? LABELS.map(([t, lon, lat, gcc]) => {
      const el = document.createElement("div");
      el.className = gcc ? "map-label map-label-gcc" : "map-label";
      el.textContent = t;
      const mk = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m);
      // Place names are decoration on the canvas (the table view lists places); keep them out of the tab order.
      el.removeAttribute("role"); el.removeAttribute("tabindex"); el.removeAttribute("aria-label"); el.setAttribute("aria-hidden", "true");
      return mk;
    }) : [];
  }, [ready, on]);

  // Signal ripples (one bounded wave, then a held ring; reduced motion shows the ring only).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !data) return;
    ripples.current.forEach((x) => x.remove());
    if (!on.has("signals")) { ripples.current = []; return; }
    const seen = new Set<string>();
    ripples.current = data.signals.filter((s) => !seen.has(s.entity_key) && seen.add(s.entity_key)).slice(0, 12).map((s) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `map-ripple map-ripple-${s.urgency} tap`;
      el.title = `${s.title} (${s.data_mode})`;
      el.setAttribute("aria-label", `Signal: ${s.title}`);
      el.onclick = () => (window.location.href = `/signals?focus=${s.id}`);
      return new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(m);
    });
  }, [ready, data, on]);

  // Movers every tick.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("movers") as GeoJSONSource).setData(fc(movers.map((p) => ({ type: "Feature", properties: { id: p.id, name: p.name, kind: p.kind, type: p.type, status: p.status, bearing: p.bearing, sub: `${moverLabel(p)} · ${p.speedLabel} · synthetic` }, geometry: { type: "Point", coordinates: p.lngLat } }))));
  }, [ready, movers]);

  // Real AIS tracks captured in the snapshot window, drawn as a faint trail behind each ship.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !observed) return;
    (m.getSource("observedTracks") as GeoJSONSource).setData(fc(observed.vessels.filter((v) => (v.track?.length ?? 0) > 1).map((v) => line(v.track!.map((p) => [p.lon, p.lat] as [number, number]), { key: v.key }))));
  }, [ready, observed]);

  // Observed ships: estimated from each ship's last report (course and speed), moving with the wall clock.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !observed) return;
    (m.getSource("observed") as GeoJSONSource).setData(fc(observed.vessels.map((v) => {
      const e = estimateOf(v, nowMs);
      return { type: "Feature", properties: {
        key: v.key, name: v.name, category: v.category, motion: isMoving(v) ? "moving" : "still", bearing: vesselBearing(v),
        sub: `${v.typeLabel} · ${v.facts.speed_over_ground?.num != null ? `${num(v.facts.speed_over_ground.num, 1)} kn` : "speed not reported"} · ${e.moving ? `estimated, last seen ${ago(e.minutes)}` : `seen ${ago(e.minutes)}`} (AIS)`,
      }, geometry: { type: "Point", coordinates: [e.lon, e.lat] } };
    })));
  }, [ready, observed, nowMs]);

  // Voyage anomalies: the scripted ships at the current minute (hollow while AIS is off) and a marker per anomaly.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !anomalies) return;
    const byShip = (id: string) => anomalies.anomalies.find((a) => a.vesselIds.includes(id));
    (m.getSource("anomalyShips") as GeoJSONSource).setData(fc(SCRIPTED_SHIPS.map((s) => {
      const p = scriptedPosition(s, minutes);
      const a = byShip(s.id);
      return { type: "Feature", properties: { id: s.id, name: s.name, type: s.type, state: p.dark ? "dark" : "flagged", bearing: p.bearing, anomaly: a?.id ?? "", sub: `${ANOMALY_LABEL[s.behaviour]} · ${p.dark ? "AIS off: position estimated" : "simulated"} · synthetic` }, geometry: { type: "Point", coordinates: p.lngLat } };
    })));
  }, [ready, anomalies, minutes]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !anomalies) return;
    (m.getSource("anomalyMarks") as GeoJSONSource).setData(fc(allAnomalies(anomalies).map((a) => ({ type: "Feature", properties: { anomaly: a.id, kind: a.kind, name: a.label, sub: `${a.confidence} confidence · ${a.dataMode === "observed" ? "real AIS (observed)" : "simulated"}` }, geometry: { type: "Point", coordinates: a.lngLat } }))));
  }, [ready, anomalies]);

  // Observed aircraft: estimated from the last ADS-B report for at most 20 minutes, then held.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !observedAir) return;
    (m.getSource("observedAir") as GeoJSONSource).setData(fc(observedAir.aircraft.map((a) => {
      const e = airEstimate(a, nowMs);
      return { type: "Feature", properties: {
        key: a.key, name: a.callsign, kind: a.kind, bearing: a.facts.track?.num ?? 0,
        sub: `${a.facts.aircraft_type?.text ?? "Type not reported"} · ${a.facts.on_ground ? "on the ground" : `${a.facts.altitude_ft?.num != null ? `${num(a.facts.altitude_ft.num, 0)} ft` : "altitude n/a"}`} · ${e.moving ? `estimated, last seen ${ago(e.minutes)}` : `seen ${ago(e.minutes)}`} (ADS-B)`,
      }, geometry: { type: "Point", coordinates: [e.lon, e.lat] } };
    })));
  }, [ready, observedAir, nowMs]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setProjection({ type: globe ? "globe" : "mercator" });
    if (globe) m.easeTo({ zoom: 2.2, center: [52, 22], duration: 600 });
    else m.easeTo({ zoom: compact ? 4.3 : 4.6, center: compact ? [52.5, 24.8] : [51.5, 24.5], duration: 600 });
  }, [ready, globe, compact]);

  const toggle = useCallback((k: LayerKey) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }), []);
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.floor(minutes % 60)).padStart(2, "0")}`;
  const holding = movers.filter((p) => p.status === "holding").length;
  const rerouted = movers.filter((p) => p.status === "rerouted").length;
  const h = height ?? (compact ? 360 : 620);
  // Source credits sit under the map, not on it, so map buttons never cover them (MAP §6 attribution).
  const credits = "Natural Earth · TIGERIS curated reference (approximate) · simulated movement · AIS snapshot via aisstream.io · ADS-B snapshot from adsb.lol (ODbL)";

  return (
    <div className="grid gap-3">
      {/* Status strip: mode, time, data labels and key counts are always visible (MAP §2, §6). */}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge tone={mode === "live" ? "ok" : "info"} className="text-[13px] font-medium">{mode === "live" ? "Simulated live" : "Replay"}</Badge>
        <Badge tone="gold" className="text-[13px] font-medium">Synthetic movement</Badge>
        {observed?.capture && <Badge tone="info" className="text-[13px] font-medium" title={observed.capture.summary ?? undefined}>Observed AIS · {observed.vessels.length} ships · {formatDate(observed.capture.retrievedAt, true)}</Badge>}
        {scenario !== "baseline" && <Badge tone="warn" className="text-[13px] font-medium">Scenario · {SCENARIOS.find((s) => s.key === scenario)!.label}</Badge>}
        <span className="tabular text-ink-muted">{clock} Riyadh time</span>
        <span className="text-ink-muted">Hormuz transits (24 h): <b className={cn("tabular", transits.now < transits.base * 0.85 ? "text-crit" : "text-ink")}>{transits.now}</b> / {transits.base} baseline</span>
        {holding > 0 && <span className="text-warn">{holding} holding</span>}
        {rerouted > 0 && <span className="text-accent">{rerouted} rerouted</span>}
        {!compact && (
          <span className="ms-auto flex gap-1">
            <Button size="sm" variant={view === "map" ? "primary" : "ghost"} onClick={() => setView("map")} aria-pressed={view === "map"}><MapIcon />Map</Button>
            <Button size="sm" variant={view === "table" ? "primary" : "ghost"} onClick={() => setView("table")} aria-pressed={view === "table"}><Rows3 />Table</Button>
          </span>
        )}
      </div>

      <div className={cn("relative overflow-hidden rounded-lg border border-line", view === "table" && "hidden")} style={{ height: h }}>
        <div ref={box} className="h-full w-full" role="region" aria-label="Movement map of the GCC. A table view with the same data is available." />
        {!compact && (
          <div className="absolute start-3 top-3 z-10 w-[220px] rounded-md border border-line bg-surface/95 text-[13px] shadow-lg backdrop-blur">
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 font-medium hover:bg-surface-2" onClick={() => setLayersOpen((v) => !v)} aria-expanded={layersOpen}><Layers className="size-4 text-accent" />Layers</button>
            {layersOpen && (
              <div className="grid max-h-[420px] gap-2 overflow-y-auto border-t border-line px-3 py-2">
                {["Movement", "Infrastructure", "Context"].map((g) => (
                  <fieldset key={g} className="grid gap-1">
                    <legend className="eyebrow mb-0.5 text-ink-faint">{g}</legend>
                    {LAYERS.filter((l) => l.group === g).map((l) => (
                      <label key={l.key} className="flex items-center gap-2"><input type="checkbox" checked={on.has(l.key)} onChange={() => toggle(l.key)} />{l.label}</label>
                    ))}
                  </fieldset>
                ))}
                <div className="grid gap-1 border-t border-line pt-2">
                  <div className="eyebrow text-ink-faint">Map key</div>
                  {MAP_KEY.map(([label, draw]) => <div key={label} className="flex items-center gap-2 text-ink-muted"><LegendIcon draw={draw} />{label}</div>)}
                  <div className="text-[13px] text-ink-faint">Icons turn with each heading. A light ring marks a real ship or aircraft; no ring is simulated.</div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="absolute bottom-3 start-3 z-10 flex gap-1">
          {!compact && <Button size="sm" variant="secondary" onClick={() => { setGlobe(false); map.current?.easeTo({ ...HORMUZ_VIEW, duration: 800 }); }}><Crosshair />Hormuz</Button>}
          <Button size="sm" variant={globe ? "primary" : "secondary"} onClick={() => setGlobe((g) => !g)} aria-pressed={globe}><Globe2 />{globe ? "Flat map" : "Globe"}</Button>
          {compact && <Button size="sm" variant="secondary" asChild><Link href="/map">Open full map</Link></Button>}
        </div>
      </div>
      <p className="max-w-[58ch] text-[13px] text-ink-faint">Sources: {credits}</p>

      {view === "table" && <MoversTable movers={movers} observed={observed?.vessels ?? []} observedAir={observedAir?.aircraft ?? []} entities={data?.entities ?? []} onSelect={setSelected} />}

      {!compact && (
        <div className="grid gap-3 rounded-lg border border-line bg-surface p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" role="group" aria-label="Mode">
              <Button size="sm" variant={mode === "replay" ? "primary" : "ghost"} onClick={() => { setMode("replay"); setPlaying(true); }}>Replay</Button>
              <Button size="sm" variant={mode === "live" ? "primary" : "ghost"} onClick={() => setMode("live")}><Radio />Live clock</Button>
            </div>
            {mode === "replay" && (
              <>
                <Button size="icon" variant="ghost" onClick={() => setMinutes(0)} aria-label="Back to start"><SkipBack /></Button>
                <Button size="icon" variant="secondary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</Button>
                <input autoComplete="off" type="range" id="replay-time" aria-label="Replay time" min={0} max={1439} value={Math.floor(minutes)} onChange={(e) => { setMinutes(Number(e.target.value)); setPlaying(false); }} className="min-w-[200px] flex-1 accent-[var(--primary)]" />
                <div className="flex gap-1" role="group" aria-label="Playback speed">
                  {SPEEDS.map((s, i) => <Button key={s.label} size="sm" variant={speed === i ? "primary" : "ghost"} onClick={() => setSpeed(i)} aria-pressed={speed === i}>{s.label}</Button>)}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Scenario overlay">
            {SCENARIOS.map((s) => <Button key={s.key} size="sm" variant={scenario === s.key ? "primary" : "secondary"} title={s.note} onClick={() => setScenario(s.key)} aria-pressed={scenario === s.key}>{s.label}</Button>)}
          </div>
        </div>
      )}
      {!compact && (
        <p className="max-w-[58ch] text-[13px] text-ink-faint">
          {observed?.capture
            ? <>Ringed ships are real ships observed by AIS in the Strait of Hormuz and its approaches (including Dubai and Fujairah anchorages), captured {formatDate(observed.capture.retrievedAt, true)} by the collector and imported as a signed snapshot. Between reports each one moves on an estimate from its last course and speed (for at most 6 hours), shown as "estimated" in its details; it is not a live track. Coverage depends on shore stations, and AIS is self-reported, so ships can be missing or misreported. </>
            : <>No AIS snapshot has been imported, so only simulated ships are shown. Run the AIS collector and import its package from Data &amp; Sources to add observed ships near Hormuz. </>}
          Icons without a ring are fictional ships, aircraft and trucks from the movement simulation.{observedAir?.capture ? ` ${observedAir.aircraft.length} real airline flights come from an ADS-B snapshot (adsb.lol, ODbL) captured ${formatDate(observedAir.capture.retrievedAt, true)}; each moves on its last track for at most ${AIR_ESTIMATE_LIMIT_MIN} minutes.` : ""}
        </p>
      )}

      <SelectionDrawer selected={selected} movers={movers} observed={observed} observedAir={observedAir} anomalies={anomalies} nowMs={nowMs} onClose={() => setSelected(null)} />
    </div>
  );
}

function MoversTable({ movers, observed, observedAir, entities, onSelect }: { movers: MovingPoint[]; observed: ObservedVessel[]; observedAir: ObservedAircraft[]; entities: MapEntity[]; onSelect: (s: Selection) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState<"observed" | "air" | "movers" | "assets">(observed.length ? "observed" : "movers");
  const rowKeys = (ev: React.KeyboardEvent<HTMLTableRowElement>) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } };
  const total = tab === "observed" ? observed.length : tab === "air" ? observedAir.length : tab === "movers" ? movers.length : entities.filter((e) => ENTITY_LAYER[e.type]).length;
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div role="tablist" aria-label="Table view" className="flex border-b border-line">
        {(["observed", "air", "movers", "assets"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setShowAll(false); }} className={cn("-mb-px border-b-2 px-4 py-2 text-[13px]", tab === t ? "border-primary font-medium" : "border-transparent text-ink-muted hover:text-ink")}>{t === "observed" ? `Observed ships (${observed.length})` : t === "air" ? `Observed aircraft (${observedAir.length})` : t === "movers" ? `Simulated ships, aircraft and trucks (${movers.length})` : `Infrastructure (${entities.filter((e) => ENTITY_LAYER[e.type]).length})`}</button>)}
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="sticky top-0 bg-surface"><tr className="border-b border-line text-ink-faint">{(tab === "observed" ? ["Name", "Type", "Status", "Destination", "Speed", "Position", "Seen"] : tab === "air" ? ["Callsign", "Aircraft type", "Altitude", "Speed", "Position", "Seen"] : tab === "movers" ? ["Name", "Type", "Status", "Route", "Speed", "Position"] : ["Name", "Type", "Country", "Position", "Class"]).map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {tab === "air" && !observedAir.length && <tr><td colSpan={6} className="px-3 py-4 text-ink-muted">No ADS-B snapshot imported yet.</td></tr>}
            {tab === "air" && observedAir.slice(0, showAll ? undefined : 50).map((a) => (
              <tr key={a.key} role="button" tabIndex={0} aria-label={`Show details for ${a.callsign}`} className="cursor-pointer border-b border-line/50 hover:bg-surface-2" onClick={() => onSelect({ kind: "observed_air", key: a.key })} onKeyDown={rowKeys}>
                <td className="px-3 py-1.5">{a.callsign} <span translate="no" className="font-mono text-[13px] text-ink-faint">{a.hex}</span></td>
                <td className="px-3 py-1.5">{a.facts.aircraft_type?.text ?? "—"} <span className="text-ink-faint">· {AIRCRAFT_LABEL[a.kind]}</span></td>
                <td className="px-3 py-1.5 tabular">{a.facts.on_ground ? "On the ground" : a.facts.altitude_ft?.num != null ? `${num(a.facts.altitude_ft.num, 0)}\u00a0ft` : "—"}</td>
                <td className="px-3 py-1.5 tabular">{a.facts.ground_speed?.num != null ? `${num(a.facts.ground_speed.num, 0)}\u00a0kn` : "—"}</td>
                <td className="px-3 py-1.5 font-mono text-[13px] tabular text-ink-faint">{num(a.lat, 3)}, {num(a.lon, 3)}</td>
                <td className="px-3 py-1.5 tabular text-ink-faint">{a.observedAt ? formatDate(a.observedAt, true) : "—"}</td>
              </tr>
            ))}
            {tab === "observed" && !observed.length && <tr><td colSpan={7} className="px-3 py-4 text-ink-muted">No AIS snapshot imported yet.</td></tr>}
            {tab === "observed" ? observed.slice(0, showAll ? undefined : 50).map((v) => (
              <tr key={v.key} role="button" tabIndex={0} aria-label={`Show details for ${v.name}`} className="cursor-pointer border-b border-line/50 hover:bg-surface-2" onClick={() => onSelect({ kind: "observed", key: v.key })} onKeyDown={rowKeys}>
                <td className="px-3 py-1.5">{v.name} <span translate="no" className="font-mono text-[13px] text-ink-faint">{v.mmsi}</span></td><td className="px-3 py-1.5">{v.typeLabel}</td>
                <td className="px-3 py-1.5 text-ink-muted">{v.facts.nav_status?.text ?? "—"}</td><td className="px-3 py-1.5 text-ink-muted">{v.facts.destination?.text ?? "—"}</td>
                <td className="px-3 py-1.5 tabular">{v.facts.speed_over_ground?.num != null ? `${num(v.facts.speed_over_ground.num, 1)}\u00a0kn` : "—"}</td>
                <td className="px-3 py-1.5 font-mono text-[13px] tabular text-ink-faint">{num(v.lat, 3)}, {num(v.lon, 3)}</td>
                <td className="px-3 py-1.5 tabular text-ink-faint">{v.observedAt ? formatDate(v.observedAt, true) : "—"}</td>
              </tr>
            )) : tab === "movers" ? movers.slice(0, showAll ? undefined : 50).map((p) => (
              <tr key={p.id} role="button" tabIndex={0} aria-label={`Show ${p.name} on the map`} className="cursor-pointer border-b border-line/50 hover:bg-surface-2" onClick={() => onSelect({ kind: "mover", id: p.id })} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } }}>
                <td className="px-3 py-1.5">{p.name} <span translate="no" className="font-mono text-[13px] text-ink-faint">{p.id}</span></td><td className="px-3 py-1.5">{p.kind === "vessel" ? VESSEL_LABEL[p.type as keyof typeof VESSEL_LABEL] : "Truck"}</td>
                <td className="px-3 py-1.5"><Badge tone={p.status === "holding" ? "warn" : p.status === "rerouted" ? "gold" : "neutral"}>{p.status}</Badge></td><td className="px-3 py-1.5 text-ink-muted">{p.laneName}</td>
                <td className="px-3 py-1.5 tabular">{p.speedLabel}</td><td className="px-3 py-1.5 font-mono text-[13px] tabular text-ink-faint">{num(p.lngLat[1], 2)}, {num(p.lngLat[0], 2)}</td>
              </tr>
            )) : entities.filter((e) => ENTITY_LAYER[e.type]).slice(0, showAll ? undefined : 50).map((e) => (
              <tr key={e.key} role="button" tabIndex={0} aria-label={`Show ${e.name} on the map`} className="cursor-pointer border-b border-line/50 hover:bg-surface-2" onClick={() => onSelect({ kind: "entity", key: e.key })} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } }}>
                <td className="px-3 py-1.5">{e.name}</td><td className="px-3 py-1.5">{e.type.replace("_", " ")}</td><td className="px-3 py-1.5">{e.country ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-[13px] tabular text-ink-faint">{num(e.lat, 2)}, {num(e.lon, 2)}</td><td className="px-3 py-1.5"><ClaimBadge claim={e.claim_class} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!showAll && total > 50 && (
          <button type="button" onClick={() => setShowAll(true)} className="w-full border-t border-line px-3 py-2 text-[13px] text-accent hover:bg-surface-2">
            Show all {total} rows
          </button>
        )}
      </div>
    </div>
  );
}

function ObservedDetails({ v, capture, nowMs }: { v: ObservedVessel; capture: NonNullable<ObservedData["capture"]>; nowMs: number }) {
  const e = estimateOf(v, nowMs);
  const open = useLineage();
  const n = (k: string, digits = 1) => { const f = v.facts[k]; return f && f.num != null ? <FactValue id={f.id} value={Math.round(f.num * 10 ** digits) / 10 ** digits} unit={f.unit} /> : <span className="text-ink-faint">Not reported</span>; };
  const t = (k: string) => { const f = v.facts[k]; return f?.text ? <button type="button" onClick={() => open(f.id)} title="Show where this value comes from" className="rounded px-1 py-0.5 text-start underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-surface-2 hover:decoration-accent">{f.text}</button> : <span className="text-ink-faint">Not reported</span>; };
  return (
    <div className="grid gap-4 text-[13px]">
      <div className="flex flex-wrap gap-1.5"><ClaimBadge claim="observed" /><Badge tone="info">AIS</Badge><Badge>{v.typeLabel}</Badge></div>
      <dl className="grid grid-cols-2 gap-3">
        <Field label="MMSI"><span translate="no" className="font-mono">{v.mmsi}</span></Field><Field label="IMO number">{t("imo_number")}</Field>
        <Field label="Position at capture">{n("position_lat", 4)}, {n("position_lon", 4)}</Field><Field label="Seen">{v.observedAt ? formatDate(v.observedAt, true) : "—"}</Field>
        <Field label="Speed over ground">{n("speed_over_ground")}</Field><Field label="Course / heading">{n("course_over_ground", 0)} / {n("heading", 0)}</Field>
        <Field label="Navigational status">{t("nav_status")}</Field><Field label="Reported destination">{t("destination")}</Field>
        <Field label="Length">{n("length_m", 0)}</Field><Field label="Draught">{n("draught_m")}</Field>
        <Field label="Call sign">{t("call_sign")}</Field><Field label="Capture">{capture.window}</Field>
        <Field label="Estimated position now">{e.moving || e.capped ? <span className="tabular">{num(e.lat, 3)}, {num(e.lon, 3)}</span> : <span className="text-ink-faint">Same as seen (stopped or course not reported)</span>}</Field>
        <Field label="Since last report">{ago(e.minutes)}{e.capped ? `; estimate held at ${ESTIMATE_LIMIT_MIN / 60} h` : ""}</Field>
      </dl>
      <p className="rounded-md border border-warn/40 bg-warn-soft p-3 text-warn">The moving position is an estimate: the last reported course and speed carried forward from the capture, for at most {ESTIMATE_LIMIT_MIN / 60} hours. It is not a live track. The ship may have turned, slowed or stopped.</p>
      <p className="rounded-md border border-line bg-surface-2 p-3 text-ink-muted">Real ship, observed by AIS and imported as a signed snapshot. Values are what the ship broadcast at capture time; destination is typed by the crew and can be out of date. TIGERIS draws no conclusion about cargo, owner or intent from this record.</p>
    </div>
  );
}

function ObservedAircraftDetails({ a, capture, nowMs }: { a: ObservedAircraft; capture: NonNullable<ObservedAirData["capture"]>; nowMs: number }) {
  const open = useLineage();
  const e = airEstimate(a, nowMs);
  const n = (k: string, digits = 0) => { const f = a.facts[k]; return f && f.num != null ? <FactValue id={f.id} value={Math.round(f.num * 10 ** digits) / 10 ** digits} unit={f.unit} /> : <span className="text-ink-faint">Not reported</span>; };
  const t = (k: string) => { const f = a.facts[k]; return f?.text ? <button type="button" onClick={() => open(f.id)} title="Show where this value comes from" className="rounded px-1 py-0.5 text-start underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-surface-2 hover:decoration-accent">{f.text}</button> : <span className="text-ink-faint">Not reported</span>; };
  return (
    <div className="grid gap-4 text-[13px]">
      <div className="flex flex-wrap gap-1.5"><ClaimBadge claim="observed" /><Badge tone="info">ADS-B</Badge><Badge>{AIRCRAFT_LABEL[a.kind]}</Badge></div>
      <dl className="grid grid-cols-2 gap-3">
        <Field label="Callsign">{t("callsign")}</Field><Field label="Operator code">{t("operator_code")}</Field>
        <Field label="Aircraft type">{t("aircraft_type")}</Field><Field label="ICAO address"><span translate="no" className="font-mono">{a.hex}</span></Field>
        <Field label="Position at capture">{n("position_lat", 3)}, {n("position_lon", 3)}</Field><Field label="Seen">{a.observedAt ? formatDate(a.observedAt, true) : "—"}</Field>
        <Field label="Altitude">{a.facts.on_ground ? "On the ground" : n("altitude_ft")}</Field><Field label="Ground speed / track">{n("ground_speed")} / {n("track")}</Field>
        <Field label="Estimated position now">{e.moving || e.capped ? <span className="tabular">{num(e.lat, 3)}, {num(e.lon, 3)}</span> : <span className="text-ink-faint">Same as seen</span>}</Field>
        <Field label="Capture">{capture.window}</Field>
      </dl>
      <p className="rounded-md border border-warn/40 bg-warn-soft p-3 text-warn">A real airline flight from a signed ADS-B snapshot. The moving position is its last track and speed carried forward for at most {AIR_ESTIMATE_LIMIT_MIN} minutes; it is not a live track. Private and general-aviation aircraft are not collected.</p>
    </div>
  );
}

function SelectionDrawer({ selected, movers, observed, observedAir, anomalies, nowMs, onClose }: { selected: Selection | null; movers: MovingPoint[]; observed: ObservedData | null; observedAir: ObservedAirData | null; anomalies: AnomalyData | null; nowMs: number; onClose: () => void }) {
  const [entity, setEntity] = useState<{ entity: { key: string; name: string; type: string; claim_class: string; location_quality: string | null; attributes: Record<string, unknown>; source_name: string | null }; edges: { id: string; predicate_label: string; other_name: string; other_key: string; relationship_class: string; direction: string }[] } | null>(null);
  useEffect(() => {
    if (selected?.kind !== "entity") return;
    setEntity(null);
    api<NonNullable<typeof entity>>(`/graph/entity?key=${encodeURIComponent(selected.key)}`).then((r) => r.ok && setEntity(r.data));
  }, [selected]);
  const mover = selected?.kind === "mover" ? movers.find((m) => m.id === selected.id) : undefined;
  const ship = selected?.kind === "observed" ? observed?.vessels.find((v) => v.key === selected.key) : undefined;
  const plane = selected?.kind === "observed_air" ? observedAir?.aircraft.find((a) => a.key === selected.key) : undefined;
  const anomaly = selected?.kind === "anomaly" ? allAnomalies(anomalies).find((a) => a.id === selected.id) : undefined;
  const realAnomaly = anomaly?.dataMode === "observed";
  return (
    <Drawer open={!!selected} onClose={onClose} eyebrow={selected?.kind === "anomaly" ? (realAnomaly ? "Voyage anomaly · observed (AIS)" : "Voyage anomaly · simulated") : selected?.kind === "observed" ? "Vessel · observed (AIS)" : selected?.kind === "observed_air" ? "Aircraft · observed (ADS-B)" : selected?.kind === "mover" ? (mover?.kind === "truck" ? "Truck · synthetic" : mover?.kind === "aircraft" ? "Aircraft · synthetic" : "Vessel · synthetic") : "Infrastructure"} title={anomaly?.label ?? plane?.callsign ?? ship?.name ?? mover?.name ?? entity?.entity.name ?? "Loading"}>
      {anomaly && (
        <div className="grid gap-4 text-[13px]">
          <div className="flex flex-wrap gap-1.5">{realAnomaly ? <ClaimBadge claim="observed" /> : <Badge tone="gold">Simulated</Badge>}<Badge tone={anomaly.confidence === "high" ? "crit" : "warn"}>{anomaly.confidence} confidence</Badge></div>
          <p className="text-[14px]">{anomaly.summary}</p>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Ships">{(anomaly.names ?? anomaly.vesselIds.map((id) => SCRIPTED_SHIPS.find((s) => s.id === id)?.name ?? id)).join(" and ")}</Field>
            <Field label="Window">{formatDate(anomaly.at, true)} – {formatDate(anomaly.until, true)}</Field>
            {Object.entries(anomaly.metrics).map(([k, v]) => <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}>{num(v, 1)}</Field>)}
          </dl>
          {anomaly.signalId && <Button asChild variant="secondary" size="sm"><Link href={`/signals?focus=${anomaly.signalId}`}>Open the signal</Link></Button>}
          <p className="rounded-md border border-warn/40 bg-warn-soft p-3 text-warn">{realAnomaly ? "Found by a fixed rule on a real ship's AIS track from the imported snapshot. AIS is self-reported and coverage is uneven, so a gap can also be a receiver gap; treat it as a lead to check, not a conclusion;" : "Found by a fixed rule on a fictional ship's simulated track;"} the thresholds are listed in the source package on Sovereignty → Intelligence correlation. {anomalies?.real.note}</p>
        </div>
      )}
      {plane && observedAir?.capture && <ObservedAircraftDetails a={plane} capture={observedAir.capture} nowMs={nowMs} />}
      {ship && observed?.capture && <ObservedDetails v={ship} capture={observed.capture} nowMs={nowMs} />}
      {mover && (
        <div className="grid gap-4 text-[13px]">
          <div className="flex flex-wrap gap-1.5"><Badge tone="gold" >Synthetic</Badge><Badge tone={mover.status === "holding" ? "warn" : mover.status === "rerouted" ? "gold" : "neutral"}>{mover.status}</Badge></div>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Simulation id">{mover.id}</Field><Field label="Type">{moverLabel(mover)}</Field>
            <Field label="Route">{mover.laneName}</Field><Field label="Speed">{mover.speedLabel}</Field>
            <Field label="Position (approximate)">{num(mover.lngLat[1], 3)}, {num(mover.lngLat[0], 3)}</Field><Field label="Details">{mover.detail}</Field>
          </dl>
          <p className="rounded-md border border-warn/40 bg-warn-soft p-3 text-warn">{mover.kind === "aircraft" ? "Fictional flight from the movement simulation. It does not represent any real aircraft, airline or schedule." : mover.kind === "truck" ? "Fictional truck from the movement simulation." : "Fictional vessel from the movement simulation. It does not represent any real ship, cargo, destination or intent."}</p>
        </div>
      )}
      {selected?.kind === "entity" && !entity && <div className="h-40 animate-pulse rounded bg-surface-2" />}
      {selected?.kind === "entity" && entity && (
        <div className="grid gap-4 text-[13px]">
          <div className="flex flex-wrap gap-1.5"><Badge>{entity.entity.type.replace("_", " ")}</Badge><ClaimBadge claim={entity.entity.claim_class} /></div>
          <p className="text-ink-muted">From {entity.entity.source_name ?? "the reference geography"}. Location {entity.entity.location_quality ?? "approximate"}.</p>
          {Object.entries(entity.entity.attributes).map(([k, v]) => {
            const f = v && typeof v === "object" && "factId" in (v as object) ? (v as { value: number; unit: string; factId: string; label?: string; claim: string }) : null;
            return f ? <div key={k} className="flex items-center justify-between gap-3"><span className="text-ink-muted">{f.label ?? k.replace(/_/g, " ")}</span><span className="flex items-center gap-1.5"><FactValue id={f.factId} value={f.value} unit={f.unit} /><ClaimBadge claim={f.claim} /></span></div> : null;
          })}
          <div><div className="mb-1 font-medium">Links</div><ul className="grid gap-1">{entity.edges.slice(0, 15).map((e) => <li key={e.id} className="flex flex-wrap items-center gap-1.5"><span className="text-ink-muted">{e.predicate_label}</span>{e.other_name}<ClaimBadge claim={e.relationship_class} /></li>)}</ul></div>
          <Button asChild variant="secondary" size="sm"><Link href={`/graph?focus=${encodeURIComponent(entity.entity.key)}`}>Open in the intelligence graph</Link></Button>
        </div>
      )}
    </Drawer>
  );
}
