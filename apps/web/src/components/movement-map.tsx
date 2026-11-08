"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import Link from "next/link";
import { Globe2, Layers, Map as MapIcon, Pause, Play, Radio, Rows3, SkipBack } from "lucide-react";
import {
  CAPE_LANE, LANES, PIPELINE_PATHS, ROADS, VESSEL_LABEL, hormuzTransits, makeFleet, makeTrucks, positionsAt,
  type MovingPoint, type Scenario,
} from "@tigeris/shared";
import { api } from "@/lib/api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Drawer, Field } from "./drawer";
import { ClaimBadge } from "./labels";
import { FactValue } from "./lineage";
import { cn } from "@/lib/cn";

interface MapEntity { key: string; name: string; type: string; country: string | null; lat: number; lon: number; claim_class: string; location_quality: string | null; attributes: Record<string, unknown> }
interface MapSignal { id: string; title: string; urgency: string; data_mode: string; entity_key: string; lat: number; lon: number }

const LAYERS = [
  { key: "vessels", label: "Ships", group: "Movement" },
  { key: "trucks", label: "Trucks", group: "Movement" },
  { key: "lanes", label: "Shipping corridors", group: "Movement" },
  { key: "roads", label: "Road corridors", group: "Movement" },
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
const ASSET_COLOR: Record<string, string> = { ports: "#79a8de", refineries: "#dc9a45", desal: "#5cc8d6", power: "#c792ea", airports: "#9aa6b8", chokepoints: "#d8645a" };
const MOVER_COLOR: Record<string, string> = { crude_tanker: "#dc9a45", product_tanker: "#e8b86a", lng_carrier: "#79a8de", container: "#45b88c", bulk_grain: "#c9a45c", truck: "#e8e6df" };
const SCENARIOS: { key: Scenario; label: string; note: string }[] = [
  { key: "baseline", label: "Baseline", note: "Normal simulated traffic" },
  { key: "hormuz_disruption", label: "Hormuz disruption", note: "About 40% of vessels on Hormuz lanes hold at anchorages either side of the strait" },
  { key: "red_sea_reroute", label: "Red Sea rerouting", note: "Red Sea traffic moves to the Cape of Good Hope route" },
];
const SPEEDS = [{ label: "1×", minPerSec: 2 }, { label: "10×", minPerSec: 20 }, { label: "60×", minPerSec: 120 }];
const LABELS: Array<[string, number, number, boolean?]> = [
  ["SAUDI ARABIA", 45.5, 23.6, true], ["UAE", 54.3, 23.4, true], ["QATAR", 51.2, 25.1, true], ["KUWAIT", 47.6, 29.4, true], ["OMAN", 57.0, 21.0, true], ["BAHRAIN", 50.55, 26.3, true],
  ["IRAN", 54.5, 30.5], ["IRAQ", 44.5, 32.5], ["YEMEN", 47.5, 15.6], ["Strait of Hormuz", 56.55, 26.85], ["Bab el-Mandeb", 43.4, 12.2], ["Red Sea", 38.6, 20.0], ["Arabian Gulf", 51.4, 27.3], ["Gulf of Oman", 58.3, 24.5], ["Arabian Sea", 62.5, 17.5],
];

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const line = (points: [number, number][], props: Record<string, unknown>): GeoJSON.Feature => ({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: points } });

function arrowImage(color: string, holding: boolean, rerouted: boolean, truck: boolean): ImageData {
  const s = 22;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.translate(s / 2, s / 2);
  if (truck) {
    g.fillStyle = color; g.strokeStyle = "#0a1220"; g.lineWidth = 1.5;
    g.beginPath(); g.rect(-4, -6, 8, 12); g.fill(); g.stroke();
  } else {
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3.5); g.lineTo(-6, 7); g.closePath();
    g.fillStyle = holding ? "rgba(0,0,0,0)" : color; g.strokeStyle = holding ? color : "#0a1220"; g.lineWidth = holding ? 2 : 1.2;
    g.fill(); g.stroke();
    if (rerouted) { g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.setLineDash([2, 2]); g.strokeStyle = color; g.lineWidth = 1; g.stroke(); }
  }
  return g.getImageData(0, 0, s, s);
}

export function MovementMap({ compact = false, height }: { compact?: boolean; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const ripples = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<{ entities: MapEntity[]; signals: MapSignal[] } | null>(null);
  const [mode, setMode] = useState<"replay" | "live">(compact ? "live" : "replay");
  const [minutes, setMinutes] = useState(8 * 60);
  const [playing, setPlaying] = useState(!compact);
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState<Scenario>("baseline");
  const [on, setOn] = useState<Set<LayerKey>>(new Set(LAYERS.map((l) => l.key)));
  const [globe, setGlobe] = useState(false);
  const [view, setView] = useState<"map" | "table">("map");
  const [layersOpen, setLayersOpen] = useState(!compact);
  const [selected, setSelected] = useState<{ kind: "entity"; key: string } | { kind: "mover"; id: string } | null>(null);

  const fleet = useMemo(() => makeFleet(), []);
  const trucks = useMemo(() => makeTrucks(), []);
  const movers = useMemo(() => positionsAt(fleet, trucks, minutes, scenario), [fleet, trucks, minutes, scenario]);
  const transits = useMemo(() => ({ base: hormuzTransits(fleet, 0, 1440), now: hormuzTransits(fleet, 0, 1440, scenario) }), [fleet, scenario]);

  useEffect(() => { api<{ entities: MapEntity[]; signals: MapSignal[] }>("/map/layers").then((r) => r.ok && setData(r.data)); }, []);

  // Clock: replay advances by the chosen speed; simulated live follows the wall clock (Riyadh time).
  useEffect(() => {
    if (mode === "live") {
      const tick = () => { const d = new Date(); setMinutes(((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60); };
      tick();
      const iv = setInterval(tick, 1000);
      return () => clearInterval(iv);
    }
    if (!playing) return;
    const iv = setInterval(() => setMinutes((m) => (m + SPEEDS[speed]!.minPerSec / 4) % 1440), 250);
    return () => clearInterval(iv);
  }, [mode, playing, speed]);

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
          { id: "ocean", type: "background", paint: { "background-color": "#07101c" } },
          { id: "land", type: "fill", source: "land", paint: { "fill-color": "#111d2e" } },
          { id: "region", type: "fill", source: "countries", paint: { "fill-color": ["case", ["get", "gcc"], "#17273d", "#131f31"] } },
          { id: "borders", type: "line", source: "borders", paint: { "line-color": "#2c4060", "line-width": 0.8 } },
        ],
      },
      center: compact ? [52.5, 24.8] : [51.5, 24.5],
      zoom: compact ? 4.3 : 4.6,
      attributionControl: false,
      renderWorldCopies: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    m.addControl(new maplibregl.AttributionControl({ customAttribution: "Natural Earth · TIGERIS curated reference (approximate) · simulated movement" }), "bottom-right");
    m.on("load", () => {
      for (const [type, color] of Object.entries(MOVER_COLOR)) {
        for (const status of ["underway", "holding", "rerouted"]) m.addImage(`${type}-${status}`, arrowImage(color, status === "holding", status === "rerouted", type === "truck"), { pixelRatio: 2 });
      }
      m.addSource("lanes", { type: "geojson", data: fc([]) });
      m.addSource("pipelines", { type: "geojson", data: fc(Object.entries(PIPELINE_PATHS).map(([k, p]) => line(p, { key: k }))) });
      m.addSource("assets", { type: "geojson", data: fc([]) });
      m.addSource("movers", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "lanes", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "sea"], paint: { "line-color": "#2f5f8f", "line-width": 1.2, "line-opacity": 0.55 } });
      m.addLayer({ id: "cape", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "scenario"], paint: { "line-color": "#d9bd84", "line-width": 1.6, "line-dasharray": [3, 2] } });
      m.addLayer({ id: "roads", type: "line", source: "lanes", filter: ["==", ["get", "kind"], "road"], paint: { "line-color": "#6d6247", "line-width": 1.4, "line-dasharray": [2, 1.5] } });
      m.addLayer({ id: "pipelines", type: "line", source: "pipelines", paint: { "line-color": "#c9a45c", "line-width": 2, "line-dasharray": [4, 2] } });
      m.addLayer({ id: "assets", type: "circle", source: "assets", paint: {
        "circle-radius": ["case", ["==", ["get", "layer"], "chokepoints"], 9, ["==", ["get", "layer"], "ports"], 4.5, 3.5],
        "circle-color": ["case", ["==", ["get", "layer"], "chokepoints"], "rgba(216,100,90,0.18)", ["get", "color"]],
        "circle-stroke-color": ["case", ["==", ["get", "layer"], "chokepoints"], "#d8645a", "#07101c"], "circle-stroke-width": ["case", ["==", ["get", "layer"], "chokepoints"], 2, 1],
      } });
      m.addLayer({ id: "movers", type: "symbol", source: "movers", layout: {
        "icon-image": ["concat", ["get", "type"], "-", ["get", "status"]], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map",
        "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.75, 7, 1.15],
      } });
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "tigeris-popup", offset: 10 });
      for (const id of ["assets", "movers"]) {
        m.on("mousemove", id, (e) => {
          m.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (f) popup.setLngLat(e.lngLat).setHTML(`<strong>${String(f.properties.name).replace(/</g, "&lt;")}</strong><br/><span>${String(f.properties.sub).replace(/</g, "&lt;")}</span>`).addTo(m);
        });
        m.on("mouseleave", id, () => { m.getCanvas().style.cursor = ""; popup.remove(); });
        m.on("click", id, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          setSelected(id === "assets" ? { kind: "entity", key: String(f.properties.key) } : { kind: "mover", id: String(f.properties.id) });
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
    const lanes = [...LANES.map((l) => line(l.points, { kind: "sea", name: l.name })), ...ROADS.map((l) => line(l.points, { kind: "road", name: l.name })), ...(scenario === "red_sea_reroute" ? [line(CAPE_LANE.points, { kind: "scenario", name: CAPE_LANE.name })] : [])];
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
    vis("lanes", on.has("lanes")); vis("cape", on.has("lanes")); vis("roads", on.has("roads")); vis("pipelines", on.has("pipelines")); vis("borders", on.has("borders"));
    const assetLayers = (["ports", "refineries", "desal", "power", "airports", "chokepoints"] as LayerKey[]).filter((k) => on.has(k));
    m.setFilter("assets", ["in", ["get", "layer"], ["literal", assetLayers]]);
    const kinds = [on.has("vessels") ? "vessel" : "", on.has("trucks") ? "truck" : ""].filter(Boolean);
    m.setFilter("movers", ["in", ["get", "kind"], ["literal", kinds]]);
    markers.current.forEach((x) => x.remove());
    markers.current = on.has("labels") ? LABELS.map(([t, lon, lat, gcc]) => {
      const el = document.createElement("div");
      el.className = gcc ? "map-label map-label-gcc" : "map-label";
      el.textContent = t;
      return new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m);
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
      el.className = `map-ripple map-ripple-${s.urgency}`;
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
    (m.getSource("movers") as GeoJSONSource).setData(fc(movers.map((p) => ({ type: "Feature", properties: { id: p.id, name: p.name, kind: p.kind, type: p.type, status: p.status, bearing: p.bearing, sub: `${p.kind === "vessel" ? VESSEL_LABEL[p.type as keyof typeof VESSEL_LABEL] : "Truck"} · ${p.speedLabel} · SYNTHETIC` }, geometry: { type: "Point", coordinates: p.lngLat } }))));
  }, [ready, movers]);

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

  return (
    <div className="grid gap-3">
      {/* Status strip: mode, time, data labels and key counts are always visible (MAP §2, §6). */}
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <Badge tone={mode === "live" ? "ok" : "info"} className="text-[10.5px] font-semibold uppercase tracking-[0.06em]">{mode === "live" ? "SIMULATED LIVE" : "REPLAY"}</Badge>
        <Badge tone="gold" className="text-[10.5px] font-semibold uppercase tracking-[0.06em]">Synthetic movement</Badge>
        {scenario !== "baseline" && <Badge tone="warn" className="text-[10.5px] font-semibold uppercase tracking-[0.06em]">SCENARIO · {SCENARIOS.find((s) => s.key === scenario)!.label}</Badge>}
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
          <div className="absolute start-3 top-3 z-10 w-[220px] rounded-md border border-line bg-surface/95 text-[12.5px] shadow-lg backdrop-blur">
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 font-medium" onClick={() => setLayersOpen((v) => !v)} aria-expanded={layersOpen}><Layers className="size-4 text-accent" />Layers</button>
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
              </div>
            )}
          </div>
        )}
        <div className="absolute bottom-3 start-3 z-10 flex gap-1">
          <Button size="sm" variant={globe ? "primary" : "secondary"} onClick={() => setGlobe((g) => !g)} aria-pressed={globe}><Globe2 />{globe ? "Flat map" : "Globe"}</Button>
          {compact && <Button size="sm" variant="secondary" asChild><Link href="/map">Open full map</Link></Button>}
        </div>
      </div>

      {view === "table" && <MoversTable movers={movers} entities={data?.entities ?? []} onSelect={setSelected} />}

      {!compact && (
        <div className="grid gap-3 rounded-lg border border-line bg-surface p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1" role="group" aria-label="Mode">
              <Button size="sm" variant={mode === "replay" ? "primary" : "ghost"} onClick={() => { setMode("replay"); setPlaying(true); }}>Replay</Button>
              <Button size="sm" variant={mode === "live" ? "primary" : "ghost"} onClick={() => setMode("live")}><Radio />Simulated live</Button>
            </div>
            {mode === "replay" && (
              <>
                <Button size="icon" variant="ghost" onClick={() => setMinutes(0)} aria-label="Back to start"><SkipBack /></Button>
                <Button size="icon" variant="secondary" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</Button>
                <input type="range" id="replay-time" aria-label="Replay time" min={0} max={1439} value={Math.floor(minutes)} onChange={(e) => { setMinutes(Number(e.target.value)); setPlaying(false); }} className="min-w-[200px] flex-1 accent-[var(--primary)]" />
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
      {!compact && <p className="text-[12px] text-ink-faint">Ships and trucks are fictional and their movement is simulated; no real vessel is tracked. Coordinates are approximate. Live AIS and fleet telemetry connect only after rights and deployment approval (pilot stage).</p>}

      <SelectionDrawer selected={selected} movers={movers} onClose={() => setSelected(null)} />
    </div>
  );
}

function MoversTable({ movers, entities, onSelect }: { movers: MovingPoint[]; entities: MapEntity[]; onSelect: (s: { kind: "entity"; key: string } | { kind: "mover"; id: string }) => void }) {
  const [tab, setTab] = useState<"movers" | "assets">("movers");
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div role="tablist" className="flex border-b border-line">
        {(["movers", "assets"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-4 py-2 text-[13px]", tab === t ? "border-primary font-medium" : "border-transparent text-ink-muted")}>{t === "movers" ? `Ships and trucks (${movers.length})` : `Infrastructure (${entities.filter((e) => ENTITY_LAYER[e.type]).length})`}</button>)}
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[720px] text-[12.5px]">
          <thead className="sticky top-0 bg-surface"><tr className="border-b border-line text-ink-faint">{(tab === "movers" ? ["Name", "Type", "Status", "Route", "Speed", "Position"] : ["Name", "Type", "Country", "Position", "Class"]).map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {tab === "movers" ? movers.map((p) => (
              <tr key={p.id} className="cursor-pointer border-b border-line/50 hover:bg-surface-2" onClick={() => onSelect({ kind: "mover", id: p.id })}>
                <td className="px-3 py-1.5">{p.name} <span className="font-mono text-[10.5px] text-ink-faint">{p.id}</span></td><td className="px-3 py-1.5">{p.kind === "vessel" ? VESSEL_LABEL[p.type as keyof typeof VESSEL_LABEL] : "Truck"}</td>
                <td className="px-3 py-1.5"><Badge tone={p.status === "holding" ? "warn" : p.status === "rerouted" ? "gold" : "neutral"}>{p.status}</Badge></td><td className="px-3 py-1.5 text-ink-muted">{p.laneName}</td>
                <td className="px-3 py-1.5 tabular">{p.speedLabel}</td><td className="px-3 py-1.5 font-mono text-[11px] tabular text-ink-faint">{p.lngLat[1].toFixed(2)}, {p.lngLat[0].toFixed(2)}</td>
              </tr>
            )) : entities.filter((e) => ENTITY_LAYER[e.type]).map((e) => (
              <tr key={e.key} className="cursor-pointer border-b border-line/50 hover:bg-surface-2" onClick={() => onSelect({ kind: "entity", key: e.key })}>
                <td className="px-3 py-1.5">{e.name}</td><td className="px-3 py-1.5">{e.type.replace("_", " ")}</td><td className="px-3 py-1.5">{e.country ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-[11px] tabular text-ink-faint">{e.lat.toFixed(2)}, {e.lon.toFixed(2)}</td><td className="px-3 py-1.5"><ClaimBadge claim={e.claim_class} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectionDrawer({ selected, movers, onClose }: { selected: { kind: "entity"; key: string } | { kind: "mover"; id: string } | null; movers: MovingPoint[]; onClose: () => void }) {
  const [entity, setEntity] = useState<{ entity: { key: string; name: string; type: string; claim_class: string; location_quality: string | null; attributes: Record<string, unknown>; source_name: string | null }; edges: { id: string; predicate_label: string; other_name: string; other_key: string; relationship_class: string; direction: string }[] } | null>(null);
  useEffect(() => {
    if (selected?.kind !== "entity") return;
    setEntity(null);
    api<NonNullable<typeof entity>>(`/graph/entity?key=${encodeURIComponent(selected.key)}`).then((r) => r.ok && setEntity(r.data));
  }, [selected]);
  const mover = selected?.kind === "mover" ? movers.find((m) => m.id === selected.id) : undefined;
  return (
    <Drawer open={!!selected} onClose={onClose} eyebrow={selected?.kind === "mover" ? (mover?.kind === "truck" ? "Truck · synthetic" : "Vessel · synthetic") : "Infrastructure"} title={mover?.name ?? entity?.entity.name ?? "Loading"}>
      {mover && (
        <div className="grid gap-4 text-[13px]">
          <div className="flex flex-wrap gap-1.5"><Badge tone="gold" className="font-mono">SYNTHETIC</Badge><Badge tone={mover.status === "holding" ? "warn" : mover.status === "rerouted" ? "gold" : "neutral"}>{mover.status}</Badge></div>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Simulation id">{mover.id}</Field><Field label="Type">{mover.kind === "vessel" ? VESSEL_LABEL[mover.type as keyof typeof VESSEL_LABEL] : "Truck"}</Field>
            <Field label="Route">{mover.laneName}</Field><Field label="Speed">{mover.speedLabel}</Field>
            <Field label="Position (approximate)">{mover.lngLat[1].toFixed(3)}, {mover.lngLat[0].toFixed(3)}</Field><Field label="Details">{mover.detail}</Field>
          </dl>
          <p className="rounded-md border border-warn/40 bg-warn-soft p-3 text-warn">Fictional vessel from the movement simulation. It does not represent any real ship, cargo, destination or intent.</p>
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
          <div><div className="mb-1 font-semibold">Links</div><ul className="grid gap-1">{entity.edges.slice(0, 15).map((e) => <li key={e.id} className="flex flex-wrap items-center gap-1.5"><span className="text-ink-muted">{e.predicate_label}</span>{e.other_name}<ClaimBadge claim={e.relationship_class} /></li>)}</ul></div>
          <Button asChild variant="secondary" size="sm"><Link href={`/graph?focus=${encodeURIComponent(entity.entity.key)}`}>Open in the intelligence graph</Link></Button>
        </div>
      )}
    </Drawer>
  );
}
