"use client";
import { useEffect, useMemo, useRef } from "react";
import { motion, useAnimationFrame } from "motion/react";
import { ambient } from "@/lib/motion/tokens";
import { NORTH_COAST, NORTH_LAND, SOUTH_COAST, SOUTH_LAND, STRAIT, TRACKS, project } from "@/lib/scene-data/chokepoint";
import { Draw, FLOW, MONO, SANS, Scene, fadeUp, rng, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 03 · Trade corridor chokepoint (signal layer). DRAFT: no plate was supplied; drawn from the written brief in the
 * scenes' style and labelled "Draft, no plate" in the gallery. Entry: coastlines draw, land hatching fades in, tracks
 * draw west to east, the strait rings expand, the callout slides in. Ambient: vessels travel the tracks through the
 * strait at varied speeds, one in four in signal blue, respawning at the start. `disruption` turns the strait tracks to
 * risk, pulses the ring and makes vessels queue and slow before the gap. With `vessels`, those positions are shown
 * instead (labelled REPLAY by default) and nothing synthetic moves.
 */
export interface SceneVessel { id: string; lat: number; lon: number; type?: string }

function Vessels({ throughputPct, disruption, loop }: { throughputPct: number; disruption: boolean; loop: boolean }) {
  const paths = useRef<Array<SVGPathElement | null>>([]);
  const dots = useRef<Array<SVGCircleElement | null>>([]);
  const lens = useRef<number[]>([]);
  const n = Math.max(2, Math.round((throughputPct / 100) * 28));
  const fleet = useMemo(() => {
    const r = rng(303);
    return Array.from({ length: 28 }, (_, i) => ({ track: i % TRACKS.length, s0: r(), v: 34 + r() * 30, inbound: i % 3 === 1, blue: i % 4 === 0 }));
  }, []);
  const state = useRef(fleet.map((f) => f.s0));
  useEffect(() => { lens.current = paths.current.map((p) => p?.getTotalLength() ?? 0); }, []);
  useAnimationFrame((_, delta) => {
    if (!loop) return;
    const dt = Math.min(delta, 64) / 1000;
    for (let i = 0; i < fleet.length; i++) {
      const c = dots.current[i], f = fleet[i]!, len = lens.current[f.track], p = paths.current[f.track];
      if (!c || !len || !p) continue;
      if (i >= n) { c.setAttribute("opacity", "0"); continue; }
      let frac = state.current[i]!;
      const pos = f.inbound ? 1 - frac : frac;
      // Before the gap (just west of the strait) a disrupted corridor makes vessels queue and crawl.
      const slow = disruption && pos > 0.33 && pos < 0.5 ? 0.18 : 1;
      frac += ((f.v * (0.6 + throughputPct / 250) * slow) / len) * dt;
      if (frac >= 1) frac -= 1;
      state.current[i] = frac;
      const pt = p.getPointAtLength((f.inbound ? 1 - frac : frac) * len);
      c.setAttribute("cx", String(pt.x)); c.setAttribute("cy", String(pt.y)); c.setAttribute("opacity", "1");
    }
  });
  return (
    <g aria-hidden="true">
      {TRACKS.map((d, i) => <path key={i} ref={(el) => { paths.current[i] = el; }} d={d} fill="none" stroke="none" />)}
      {loop && fleet.map((f, i) => <circle key={i} ref={(el) => { dots.current[i] = el; }} r={f.blue ? 4.2 : 3.4} cx="-99" cy="-99" fill={f.blue ? FLOW.signal : FLOW.ink} fillOpacity={f.blue ? 1 : 0.72} />)}
    </g>
  );
}

function Body({ run, throughputPct, disruption, vessels, label }: { run: Run; throughputPct: number; disruption: boolean; vessels?: SceneVessel[]; label: string }) {
  const { from, t, loop, uid } = run;
  const hatch = `${uid}-hatch`;
  const trackColor = disruption ? FLOW.risk : FLOW.gold;
  return (
    <>
      <defs>
        <pattern id={hatch} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9" stroke="#86581d" strokeOpacity="0.16" /></pattern>
      </defs>
      <motion.rect x="140" y="230" width="1720" height="730" fill="none" stroke="var(--line)" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.5)} />
      <motion.g initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.8, 1.0)}>
        <path d={NORTH_LAND} fill={`url(#${hatch})`} /><path d={SOUTH_LAND} fill={`url(#${hatch})`} />
      </motion.g>
      <Draw d={NORTH_COAST} run={run} delay={0.2} duration={1.2} stroke="var(--ink)" strokeOpacity="0.65" strokeWidth="1.4" />
      <Draw d={SOUTH_COAST} run={run} delay={0.35} duration={1.2} stroke="var(--ink)" strokeOpacity="0.65" strokeWidth="1.4" />
      {TRACKS.map((d, i) => (
        <motion.path key={i} d={d} fill="none" strokeWidth="1.2" strokeDasharray="2 7" initial={from({ pathLength: 0 })}
          animate={{ pathLength: 1, stroke: trackColor, strokeOpacity: disruption ? 0.75 : 0.5 }} transition={{ pathLength: t(1.1, 1.3 + i * 0.08), stroke: t(0.3), strokeOpacity: t(0.3) }} />
      ))}
      {/* Strait marker: rings expand in, pulse when disrupted */}
      {[STRAIT.r, STRAIT.r * 1.6, STRAIT.r * 2.3].map((r, i) => (
        <motion.circle key={r} cx={STRAIT.x} cy={STRAIT.y} r={r} fill="none" stroke={disruption ? FLOW.risk : FLOW.gold} strokeOpacity={0.55 - i * 0.15}
          initial={from({ scale: 0.3, opacity: 0 })} animate={{ scale: 1, opacity: 1 }} transition={t(0.8, 2.0 + i * 0.12)} style={{ originX: 0.5, originY: 0.5 }} />
      ))}
      {disruption && loop && (
        <motion.circle cx={STRAIT.x} cy={STRAIT.y} r={STRAIT.r} fill="none" stroke={FLOW.risk} initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut" }} style={{ originX: 0.5, originY: 0.5 }} />
      )}
      <circle cx={STRAIT.x} cy={STRAIT.y} r="5" fill={disruption ? FLOW.risk : FLOW.gold} />
      {vessels ? vessels.map((v) => { const [x, y] = project(v.lat, v.lon); return <circle key={v.id} cx={x} cy={y} r="4" fill={FLOW.signal} />; })
        : <Vessels throughputPct={throughputPct} disruption={disruption} loop={loop} />}
      {/* Place labels */}
      <motion.g {...fadeUp(run, 1.6)} style={{ ...MONO, fontSize: 13, letterSpacing: "0.24em" }} fill="var(--ink-muted)">
        <text x="300" y="470">Gulf</text>
        <text x="1500" y="900">Ocean approach</text>
        <text x={STRAIT.x - 40} y={STRAIT.y - 88}>Strait</text>
      </motion.g>
      {/* Callout card */}
      <motion.g initial={from({ opacity: 0, x: 40 })} animate={{ opacity: 1, x: 0 }} transition={t(0.7, 2.4)}>
        <rect x="1420" y="270" width="400" height="168" fill="var(--surface)" stroke="var(--line)" />
        <rect x="1420" y="270" width="400" height="3" fill={disruption ? FLOW.risk : FLOW.signal} />
        <text x="1446" y="312" fill="var(--primary)" style={{ ...MONO, fontSize: 11, letterSpacing: "0.22em" }}>Chokepoint · signal layer</text>
        <text x="1446" y="350" fill="var(--ink)" style={{ ...SANS, fontSize: 22 }}>{disruption ? "Transit disruption" : "Transits normal"}</text>
        <text x="1446" y="384" fill="var(--ink-muted)" style={{ ...SANS, fontSize: 15 }}>{vessels ? `${vessels.length} vessels shown` : `Throughput ${Math.round(throughputPct)}% of baseline`}</text>
        <rect x="1446" y="402" width={label.length * 9 + 20} height="22" fill="var(--surface-2)" stroke="var(--line)" />
        <text x="1456" y="418" fill="var(--ink-muted)" style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.16em" }}>{label}</text>
      </motion.g>
      {loop && disruption && <motion.text x={STRAIT.x + 40} y={STRAIT.y + 150} fill={FLOW.risk} style={{ ...MONO, fontSize: 12, letterSpacing: "0.18em" }} animate={{ opacity: [0.5, 1] }} transition={ambient(2.4)}>Queue forming</motion.text>}
    </>
  );
}

export function ChokepointScene({ throughputPct = 82, disruption = false, vessels, vesselsLabel = "Replay", ...props }: SceneProps & {
  throughputPct?: number; disruption?: boolean; vessels?: SceneVessel[]; vesselsLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, throughputPct));
  const label = vessels ? vesselsLabel : "Synthetic";
  return (
    <Scene n="03" section={["Signal Layer", "Trade Corridor"]} pill={disruption ? "Chokepoint disrupted" : "Chokepoint watch"} fig="Fig. 03 — Trade corridor chokepoint (draft, no plate)" entryMs={3200}
      aria={`Illustrative strait between two coastlines with shipping tracks passing through it. ${disruption ? "The corridor is disrupted and vessels queue before the gap." : "Vessels transit normally."} ${vessels ? `${vessels.length} vessels from a stored snapshot.` : `Synthetic vessels at ${Math.round(pct)}% of baseline throughput.`}`} {...props}>
      {(run) => <Body run={run} throughputPct={pct} disruption={disruption} vessels={vessels} label={label} />}
    </Scene>
  );
}
