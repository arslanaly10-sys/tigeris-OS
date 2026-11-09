"use client";
import { motion } from "motion/react";
import { DATA_SPRING } from "@/lib/motion/tokens";
import { FLOW, MONO, SANS, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 08 · Gap diagnosis (plate 08): eight gaps, 0 = none, 100 = severe; before and after TIGERIS.
 * Entry: the octagon grid draws, the "before" polygon grows from the centre (spring, no overshoot), the right-panel
 * markers slide into place. `showAfter`: the dashed blue "after" polygon morphs out of the before shape and blue
 * segments draw between the markers. Values come only from props (the diagnosis engine); the label says whether
 * they are ILLUSTRATIVE or MODELLED and never animates away.
 */
export const GAP_LABELS = ["Coordination debt", "Institutional fragmentation", "Governance velocity", "Institutional memory", "Capital orchestration", "Decision drift", "Economic sovereignty", "Value realization"] as const;
/** The plate's illustrative profile (read from plate 08), not client data. */
export const ILLUSTRATIVE_GAPS = { before: [78, 72, 81, 69, 64, 74, 58, 83], after: [38, 34, 30, 28, 36, 32, 40, 35] };
const C = { x: 625, y: 625 }, R = 300;
const pt = (k: number, v: number) => { const a = (-90 + k * 45) * (Math.PI / 180); return [C.x + R * (v / 100) * Math.cos(a), C.y + R * (v / 100) * Math.sin(a)] as const; };
const poly = (vals: number[]) => vals.map((v, k) => { const [x, y] = pt(k, v); return `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join("") + "Z";
const TRACK = { x0: 1417, x1: 1883 };
const tx = (v: number) => TRACK.x0 + ((TRACK.x1 - TRACK.x0) * v) / 100;
const LABEL_AT: Array<[number, number, "start" | "middle" | "end"]> = [[625, 312, "middle"], [850, 405, "start"], [943, 631, "start"], [850, 856, "start"], [625, 949, "middle"], [400, 856, "end"], [306, 631, "end"], [400, 405, "end"]];

function Body({ run, before, after, showAfter }: { run: Run; before: number[]; after?: number[]; showAfter: boolean }) {
  const { from, t, entry } = run;
  const zero = poly(before.map(() => 0));
  const morph = entry ? t(1.3, 0.8) : DATA_SPRING;
  return (
    <>
      {[20, 40, 60, 80, 100].map((p, i) => <motion.path key={p} d={poly(before.map(() => p))} fill="none" stroke="#8a7258" strokeOpacity={p === 100 ? 0.4 : 0.18}
        initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(0.8, i * 0.08)} />)}
      {GAP_LABELS.map((_, k) => { const [x, y] = pt(k, 100); return <line key={k} x1={C.x} y1={C.y} x2={x} y2={y} stroke="#8a7258" strokeOpacity="0.15" />; })}
      {/* Before: grows from the centre */}
      <motion.path initial={from({ d: zero })} animate={{ d: poly(before) }} transition={morph} fill="#d9c3a2" fillOpacity="0.45" stroke={FLOW.gold} strokeWidth="2" />
      {before.map((v, k) => { const [x, y] = pt(k, v); return <motion.circle key={k} initial={from({ cx: C.x, cy: C.y })} animate={{ cx: x, cy: y }} transition={morph} r="4.5" fill={FLOW.gold} />; })}
      {/* After: morphs out of the before shape */}
      {after && (
        <>
          <motion.path initial={{ d: poly(before), opacity: 0 }} animate={{ d: showAfter ? poly(after) : poly(before), opacity: showAfter ? 1 : 0 }} transition={DATA_SPRING}
            fill="#c9d3f3" fillOpacity="0.35" stroke={FLOW.signal} strokeWidth="1.6" strokeDasharray="5 5" />
          {after.map((v, k) => { const [x, y] = pt(k, showAfter ? v : before[k]!); return <motion.circle key={k} initial={false} animate={{ cx: x, cy: y, opacity: showAfter ? 1 : 0 }} transition={DATA_SPRING} r="3.5" fill={FLOW.signal} />; })}
        </>
      )}
      {GAP_LABELS.map((g, k) => { const [x, y, a] = LABEL_AT[k]!; return <motion.text key={g} x={x} y={y} textAnchor={a} fill="var(--ink)" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.5, 0.4 + k * 0.05)} style={{ ...SANS, fontSize: 17.5, fontWeight: 500 }}>{g}</motion.text>; })}

      {/* Right panel */}
      <rect x="1105" y="204" width="820" height="823" fill="#f3ebde" fillOpacity="0.7" stroke="#8a7258" strokeOpacity="0.4" />
      <text x="1129" y="238" fill={FLOW.gold} xmlSpace="preserve" style={{ ...MONO, fontSize: 12, letterSpacing: "0.16em" }}>Gap score   ·   0 = none   ·   100 = severe</text>
      {GAP_LABELS.map((g, k) => {
        const y = 281 + k * 91.6, b = tx(before[k]!), a = after ? tx(after[k]!) : b;
        return (
          <g key={g}>
            <text x="1129" y={y + 5} fill="#8a7258" style={{ ...MONO, fontSize: 13 }}>{String(k + 1).padStart(2, "0")}</text>
            <text x="1164" y={y + 6} fill="var(--ink)" style={{ ...SANS, fontSize: 19, fontWeight: 500 }}>{g}</text>
            <line x1={TRACK.x0} x2={TRACK.x1} y1={y} y2={y} stroke="#8a7258" strokeOpacity="0.45" strokeWidth="1.4" />
            {k < 7 && <line x1="1129" x2="1900" y1={y + 46} y2={y + 46} stroke="#8a7258" strokeOpacity="0.15" />}
            {after && <motion.line y1={y} y2={y} stroke={FLOW.signal} strokeWidth="2" initial={false} animate={{ x1: showAfter ? a : b, x2: b, opacity: showAfter ? 1 : 0 }} transition={DATA_SPRING} />}
            {after && <motion.circle cy={y} r="6" fill="var(--bg)" stroke={FLOW.signal} strokeWidth="1.6" initial={false} animate={{ cx: showAfter ? a : b, opacity: showAfter ? 1 : 0 }} transition={DATA_SPRING} />}
            <motion.circle cy={y} r="6" fill={FLOW.gold} initial={from({ cx: TRACK.x0 })} animate={{ cx: b }} transition={entry ? t(1.0, 1.0 + k * 0.05) : DATA_SPRING} />
          </g>
        );
      })}
      {/* Legend */}
      <circle cx="405" cy="1018" r="6" fill={FLOW.gold} /><text x="421" y="1024" fill="var(--ink)" style={{ ...SANS, fontSize: 16 }}>Before</text>
      {after && <><circle cx="520" cy="1018" r="6" fill="none" stroke={FLOW.signal} strokeWidth="1.6" /><text x="536" y="1024" fill="var(--ink)" style={{ ...SANS, fontSize: 16 }}>After TIGERIS</text></>}
      <text x="687" y="1024" fill="var(--ink-faint)" style={{ ...SANS, fontSize: 16 }}>Not client data</text>
    </>
  );
}

export function DiagnosisScene({ before = ILLUSTRATIVE_GAPS.before, after = ILLUSTRATIVE_GAPS.after, showAfter = true, label = "Illustrative", ...props }: SceneProps & {
  before?: number[]; after?: number[]; showAfter?: boolean; label?: "Illustrative" | "Modelled";
}) {
  return (
    <Scene n="08" section={["Diagnose", "Eight gaps"]} pill={`${label} profile`} fig="Fig. 08 — Before and after TIGERIS" entryMs={2600}
      aria={`Eight-gap profile (${label.toLowerCase()}): ${GAP_LABELS.map((g, i) => `${g} ${before[i]}${showAfter && after ? ` to ${after[i]}` : ""}`).join("; ")}.`} {...props}>
      {(run) => <Body run={run} before={before} after={after} showAfter={showAfter} />}
    </Scene>
  );
}
