"use client";
import { motion } from "motion/react";
import { ambient } from "@/lib/motion/tokens";
import { Beads, DISPLAY, FLOW, MONO, Node, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 04 · Coordination debt, resolved (plate 04). L3 orchestration.
 * fragmented: dashed chords between institutions drift and flicker, no spokes, the hub is dim.
 * → resolved (1.6 s): chords dissolve, spokes draw from the hub clockwise, the hub ring brightens, labels settle.
 * Ambient (resolved): beads flow both ways along the spokes in each institution's colour; the hub breathes.
 */
export const INSTITUTIONS = [
  { id: "fund", label: "Sovereign Fund", color: FLOW.gold },
  { id: "mof", label: "Ministry of Finance", color: FLOW.signal },
  { id: "cb", label: "Central Bank", color: FLOW.compute },
  { id: "trade", label: "Trade", color: FLOW.transfer },
  { id: "energy", label: "Energy", color: FLOW.energy },
  { id: "industry", label: "Industrial Policy", color: FLOW.policy },
  { id: "investment", label: "Investment", color: FLOW.goldSoft },
  { id: "strategy", label: "National Strategy", color: FLOW.ink },
] as const;
const C = { x: 1000, y: 614 }, R = 313;
const pos = (k: number, r = R) => { const a = (-90 + k * 45) * (Math.PI / 180); return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a), a }; };

function Body({ run, resolved, highlight }: { run: Run; resolved: boolean; highlight?: string }) {
  const { from, t, loop } = run;
  const chords: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) { chords.push([i, (i + 1) % 8]); chords.push([i, (i + 3) % 8]); }
  return (
    <>
      {[75, 150, 225, 390].map((r) => <circle key={r} cx={C.x} cy={C.y} r={r} fill="none" stroke="#86581d" strokeOpacity="0.07" />)}
      {/* Chords: the fragmented state's broken coordination */}
      {chords.map(([a, b], i) => {
        const p = pos(a, R - 4), q = pos(b, R - 4);
        return <motion.line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#86581d" strokeDasharray="6 9"
          animate={{ strokeOpacity: resolved ? 0.12 : 0.45, strokeDashoffset: loop && !resolved ? [0, 30] : 0 }}
          transition={{ strokeOpacity: run.t(0.7, resolved ? 0 : 0.2), strokeDashoffset: loop && !resolved ? { duration: 6 + (i % 5), repeat: Infinity, ease: "linear" } : { duration: 0 } }} />;
      })}
      {/* Spokes, drawn clockwise from the hub */}
      {INSTITUTIONS.map((inst, k) => {
        const a = pos(k, 66), b = pos(k, R - 10), d = `M${a.x} ${a.y}L${b.x} ${b.y}`;
        const dim = highlight && highlight !== inst.id;
        return (
          <g key={inst.id} opacity={dim ? 0.3 : 1}>
            <motion.path d={d} fill="none" stroke={inst.color} strokeOpacity="0.55" strokeWidth="1.2" initial={from({ pathLength: 0 })}
              animate={{ pathLength: resolved ? 1 : 0 }} transition={t(0.8, resolved ? 0.4 + k * 0.08 : 0)} />
            {resolved && Array.from({ length: 9 }, (_, j) => { const p = pos(k, 95 + j * 24); return <motion.circle key={j} cx={p.x} cy={p.y} r="1.6" fill={inst.color} initial={from({ opacity: 0 })} animate={{ opacity: 0.8 }} transition={t(0.3, 0.9 + k * 0.08 + j * 0.02)} />; })}
            {resolved && <Beads d={d} color={inst.color} loop={loop} pxPerSec={55} offset={k * 31} />}
            {resolved && <Beads d={d} color={inst.color} loop={loop} pxPerSec={40} offset={k * 47 + 120} reverse />}
          </g>
        );
      })}
      {/* Hub */}
      <motion.g style={{ originX: 0.5, originY: 0.5 }} animate={loop && resolved ? { scale: [1, 1.02] } : { scale: 1 }} transition={loop && resolved ? ambient(3) : { duration: 0.3 }}>
        <circle cx={C.x} cy={C.y} r="78" fill="none" stroke="#86581d" strokeOpacity="0.18" />
        <circle cx={C.x} cy={C.y} r="70" fill="none" stroke="#86581d" strokeOpacity="0.28" />
        <motion.circle cx={C.x} cy={C.y} r="62" fill="#f3ebde" stroke="#86581d" animate={{ strokeOpacity: resolved ? 1 : 0.35, fillOpacity: resolved ? 1 : 0.6 }} transition={t(0.7, resolved ? 1.0 : 0)} strokeWidth="1.6" />
        <motion.text x={C.x} y={C.y + 9} textAnchor="middle" animate={{ opacity: resolved ? 1 : 0.45 }} style={{ ...DISPLAY, fontWeight: 700, fontSize: 25, letterSpacing: "0.12em" }} fill="var(--ink)">TIGERIS</motion.text>
      </motion.g>
      {INSTITUTIONS.map((inst, k) => {
        const p = pos(k), l = pos(k, R + 46);
        const c = Math.cos(p.a), s = Math.sin(p.a);
        const anchor = Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
        const lx = Math.abs(c) < 0.2 ? p.x : Math.abs(s) < 0.2 ? l.x - (c > 0 ? 10 : -10) : p.x + (c > 0 ? 26 : -26);
        const ly = Math.abs(c) < 0.2 ? (s < 0 ? p.y - 42 : p.y + 55) : Math.abs(s) < 0.2 ? p.y + 6 : p.y + (s < 0 ? -18 : 32);
        return (
          <g key={inst.id} opacity={highlight && highlight !== inst.id ? 0.35 : 1}>
            <Node x={p.x} y={p.y} color={inst.color} r={11} core={4} appear={{ initial: from({}), delay: 0.2 + k * 0.05, run }} />
            <motion.text x={lx} y={ly} textAnchor={anchor} fill="var(--ink)" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.5, 0.5 + k * 0.05)}
              style={{ ...MONO, fontSize: 13, letterSpacing: "0.2em" }}>{inst.label}</motion.text>
          </g>
        );
      })}
    </>
  );
}

export function CoordinationScene({ state = "resolved", highlight, ...props }: SceneProps & { state?: "fragmented" | "resolved"; highlight?: string }) {
  const resolved = state === "resolved";
  return (
    <Scene n="04" section={["L3 Orchestration"]} pill={resolved ? "Synchronised layer" : "Coordination debt"} fig={resolved ? "Fig. 04 — Coordination debt, resolved" : "Fig. 04 — Coordination debt, rising"} entryMs={2400}
      aria={resolved ? "Eight institutions connected through TIGERIS at the centre: coordination debt resolved." : "Eight institutions linked only by broken, dashed lines, with no owner at the centre: coordination debt rising."} {...props}>
      {(run) => <Body run={run} resolved={resolved} highlight={highlight} />}
    </Scene>
  );
}
