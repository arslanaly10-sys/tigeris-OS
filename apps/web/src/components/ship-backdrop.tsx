"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import { LANES, flightsAt, makeFleet, makeFlights, positionsAt } from "@tigeris/shared";
import { registerIcons } from "./movement-map";

const riyadhMinutes = (ms: number) => { const d = new Date(ms); return ((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000; };

/**
 * Sign-in hero: the Gulf at night with the simulated fleet and flights moving on their lanes on the wall clock (Riyadh time).
 * The page's one moving centrepiece. Not interactive; a still frame under reduced motion. Ships are fictional.
 */
export function ShipBackdrop({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [minutes, setMinutes] = useState(() => riyadhMinutes(Date.now()));
  const reduced = useReducedMotion();
  const last = useRef(0);
  const fleet = useMemo(() => makeFleet(), []);
  const flights = useMemo(() => makeFlights(), []);

  useAnimationFrame((t) => {
    if (reduced || t - last.current < 80) return;
    last.current = t;
    setMinutes(riyadhMinutes(Date.now()));
  });

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: {
        version: 8,
        sources: { land: { type: "geojson", data: "/geo/land.geojson" }, countries: { type: "geojson", data: "/geo/countries.geojson" } },
        layers: [
          { id: "ocean", type: "background", paint: { "background-color": "#060c17" } },
          { id: "land", type: "fill", source: "land", paint: { "fill-color": "#0e1a2b" } },
          { id: "region", type: "fill", source: "countries", paint: { "fill-color": ["case", ["get", "gcc"], "#13223a", "#0f1b2d"], "fill-outline-color": "#1d2d47" } },
        ],
      },
      center: [53.6, 26.2], zoom: 6.1, interactive: false, attributionControl: false, renderWorldCopies: false,
    });
    m.on("load", () => {
      registerIcons(m);
      m.addSource("lanes", { type: "geojson", data: { type: "FeatureCollection", features: LANES.map((l) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l.points } })) } });
      m.addLayer({ id: "lanes", type: "line", source: "lanes", paint: { "line-color": "#2f5f8f", "line-width": 1, "line-opacity": 0.6 } });
      m.addSource("ships", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "ships", type: "symbol", source: "ships", layout: { "icon-image": ["concat", ["get", "type"], "-underway"], "icon-rotate": ["get", "bearing"], "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 7, 0.8] } });
      setReady(true);
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const ships = [...positionsAt(fleet, [], minutes, "baseline").filter((p) => p.kind === "vessel"), ...flightsAt(flights, minutes)];
    (m.getSource("ships") as GeoJSONSource).setData({ type: "FeatureCollection", features: ships.map((p) => ({ type: "Feature", properties: { type: p.type, bearing: p.bearing }, geometry: { type: "Point", coordinates: p.lngLat } })) });
  }, [ready, minutes, fleet, flights]);

  return <div ref={box} aria-hidden className={className} style={{ position: "absolute", inset: 0 }} />;
}
