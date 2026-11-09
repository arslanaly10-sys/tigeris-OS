"use client";
import { motion } from "motion/react";
import { ambient } from "@/lib/motion/tokens";
import { Beads, FLOW, MONO, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 11 · Global sovereign intelligence graph (plate 11): the operating footprint.
 * An equirectangular projection fitted to the plate (latitude lines at 60/45/30/15°N and the equator; Riyadh, Miami,
 * London and Tokyo land on their plate positions). Capital-pool halos are proportional to the client site's own
 * estimates and are labelled as such. Entry: graticule, halos, city nodes, then arcs out from the hub staggered by
 * distance. Ambient: a comet travels a random arc every 2 s, the Miami–Riyadh arc carries a steady bead stream, the
 * halos breathe in proportion to pool size.
 */
export interface City { id: string; label: string; lon: number; lat: number; anchor?: "start" | "end"; dx?: number; dy?: number }
export interface Pool { label: string; usdTn: number; at: string }
const X = (lon: number) => 823 + lon * 7.06, Y = (lat: number) => 882 - lat * 9.47;
export const CITIES: City[] = [
  { id: "riyadh", label: "Riyadh", lon: 46.7, lat: 24.7, anchor: "end", dx: -16, dy: 26 }, { id: "miami", label: "Miami", lon: -80.2, lat: 25.8, dx: 14, dy: -10 },
  { id: "dc", label: "Washington DC", lon: -77, lat: 38.9, anchor: "end", dx: -12, dy: 20 }, { id: "ny", label: "New York", lon: -74, lat: 40.7, dx: 12, dy: -10 },
  { id: "london", label: "London", lon: -0.13, lat: 51.5, anchor: "end", dx: -12, dy: -6 }, { id: "brussels", label: "Brussels", lon: 4.35, lat: 50.85, dx: 12, dy: 16 },
  { id: "oslo", label: "Oslo", lon: 10.75, lat: 59.9, dx: 12, dy: -10 }, { id: "kuwait", label: "Kuwait City", lon: 47.98, lat: 29.37, anchor: "end", dx: -12, dy: -12 },
  { id: "doha", label: "Doha", lon: 51.5, lat: 25.3, dx: -14, dy: 40 }, { id: "abudhabi", label: "Abu Dhabi", lon: 54.4, lat: 24.45, dx: 12, dy: 30 },
  { id: "dubai", label: "Dubai (DIFC)", lon: 55.3, lat: 25.2, dx: 16, dy: -10 }, { id: "hk", label: "Hong Kong", lon: 114.2, lat: 22.3, dx: 12, dy: -10 },
  { id: "tokyo", label: "Tokyo", lon: 139.7, lat: 35.7, dx: 12, dy: -10 }, { id: "singapore", label: "Singapore", lon: 103.8, lat: 1.35, dx: 12, dy: -10 },
];
/** Strategic capital pools: the client site's estimates, shown as estimates. */
export const POOLS: Pool[] = [
  { label: "Saudi Arabia", usdTn: 1.5, at: "riyadh" }, { label: "UAE", usdTn: 2, at: "abudhabi" }, { label: "Qatar", usdTn: 0.5, at: "doha" },
  { label: "Kuwait", usdTn: 1, at: "kuwait" }, { label: "Norway", usdTn: 1.8, at: "oslo" }, { label: "Singapore", usdTn: 1, at: "singapore" },
];
const arc = (a: City, b: City) => {
  const x1 = X(a.lon), y1 = Y(a.lat), x2 = X(b.lon), y2 = Y(b.lat), dist = Math.hypot(x2 - x1, y2 - y1);
  return { d: `M${x1} ${y1}Q${(x1 + x2) / 2} ${Math.min(y1, y2) - dist * 0.28} ${x2} ${y2}`, dist };
};

function Body({ run, cities, pools, hub, activeLinks }: { run: Run; cities: City[]; pools: Pool[]; hub: string; activeLinks?: string[] }) {
  const { from, t, loop } = run;
  const H = cities.find((c) => c.id === hub)!;
  const links = cities.filter((c) => c.id !== hub).map((c) => ({ c, ...arc(H, c) })).sort((a, b) => a.dist - b.dist);
  const at = (id: string) => cities.find((c) => c.id === id)!;
  return (
    <>
      <rect x="75" y="187" width="1850" height="860" fill="#f3ebde" fillOpacity="0.55" stroke="#8a7258" strokeOpacity="0.35" />
      <motion.g initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.8, 0)}>
        {[60, 45, 30, 15].map((lat) => <g key={lat}><line x1="75" x2="1925" y1={Y(lat)} y2={Y(lat)} stroke="#8a7258" strokeOpacity="0.15" /><text x="1910" y={Y(lat) + 4} textAnchor="end" fill="#8a7258" style={{ ...MONO, fontSize: 10 }}>{lat}°N</text></g>)}
        <line x1="75" x2="1925" y1={Y(0)} y2={Y(0)} stroke="#8a7258" strokeOpacity="0.35" strokeDasharray="3 4" /><text x="1910" y={Y(0) + 4} textAnchor="end" fill="#8a7258" style={{ ...MONO, fontSize: 10 }}>EQ</text>
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={187 + i * 212} x2={187 + i * 212} y1="187" y2="1047" stroke="#8a7258" strokeOpacity="0.1" />)}
      </motion.g>
      {pools.map((p, i) => { const c = at(p.at); return (
        <motion.circle key={p.label} cx={X(c.lon)} cy={Y(c.lat)} r={22 + p.usdTn * 26} fill="#ac8c61" initial={from({ scale: 0, opacity: 0 })}
          animate={loop ? { scale: [1, 1 + 0.03 * p.usdTn], opacity: 0.16 } : { scale: 1, opacity: 0.16 }} transition={loop ? { scale: ambient(5 + p.usdTn * 2, i * 0.6), opacity: t(0.9, 0.3) } : t(0.9, 0.3 + i * 0.05)} style={{ originX: 0.5, originY: 0.5 }} />
      ); })}
      {links.map(({ c, d }, i) => {
        const blue = c.id === "miami", on = !activeLinks || activeLinks.includes(c.id);
        return (
          <g key={c.id} opacity={on ? 1 : 0.25}>
            <motion.path d={d} fill="none" stroke={blue ? FLOW.signal : FLOW.gold} strokeOpacity={blue ? 0.8 : 0.45} strokeWidth={blue ? 1.6 : 1.1} initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(1.0, 1.0 + i * 0.12)} />
            {blue && <Beads d={d} color={FLOW.signal} loop={loop} count={4} pxPerSec={110} r={2.4} />}
            {!blue && i % 3 === 0 && <Beads d={d} color={FLOW.gold} loop={loop} pxPerSec={150 + i * 10} offset={i * 300} r={2} />}
          </g>
        );
      })}
      {cities.map((c, i) => {
        const hubOrMiami = c.id === hub || c.id === "miami", col = hubOrMiami ? FLOW.signal : FLOW.gold;
        return (
          <motion.g key={c.id} initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.5, 0.7 + i * 0.03)}>
            <circle cx={X(c.lon)} cy={Y(c.lat)} r={hubOrMiami ? 9 : 7} fill="var(--bg)" stroke={col} strokeWidth="1.4" /><circle cx={X(c.lon)} cy={Y(c.lat)} r="3" fill={col} />
            <text x={X(c.lon) + (c.dx ?? 12)} y={Y(c.lat) + (c.dy ?? -10)} textAnchor={c.anchor ?? "start"} fill={hubOrMiami ? FLOW.signal : "var(--ink)"} style={{ ...MONO, fontSize: 12, letterSpacing: "0.16em" }}>{c.label}</text>
          </motion.g>
        );
      })}
      <text x="100" y="223" fill={FLOW.gold} xmlSpace="preserve" style={{ ...MONO, fontSize: 11.5, letterSpacing: "0.16em" }}>Strategic capital pool   ·   halo ∝ client-site estimate</text>
      <text x="100" y="249" fill="var(--ink)" xmlSpace="preserve" style={{ ...MONO, fontSize: 11.5, letterSpacing: "0.14em" }}>{pools.map((p) => `${p.label} ~$${p.usdTn}T+`).join("     ")}</text>
    </>
  );
}

export function GlobalGraphScene({ cities = CITIES, pools = POOLS, hub = "riyadh", activeLinks, ...props }: SceneProps & { cities?: City[]; pools?: Pool[]; hub?: string; activeLinks?: string[] }) {
  return (
    <Scene n="11" section={["Operating footprint"]} pill="Illustrative" fig="Fig. 11 — Global sovereign intelligence graph" entryMs={3200}
      aria={`Operating footprint: ${cities.find((c) => c.id === hub)?.label} at the centre, linked to ${cities.filter((c) => c.id !== hub).map((c) => c.label).join(", ")}. Capital pools are client-site estimates.`} {...props}>
      {(run) => <Body run={run} cities={cities} pools={pools} hub={hub} activeLinks={activeLinks} />}
    </Scene>
  );
}
