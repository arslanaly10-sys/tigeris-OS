"use client";
import { motion } from "motion/react";
import { Beads, FLOW, MONO, SANS, Scene, curve, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 07 · Shock propagation (plate 07). One shock, three orders of effect.
 * Entry (on mount and whenever `shockKey` changes): a ripple from the centre, then first-order nodes and edges at 0.3 s,
 * second order at 1.1 s, third order at 1.9 s, labels after each ring. Ambient: a faint ripple every 4 s; beads travel
 * outward along the edges. `durationDays` scales ripple speed and intensity. Values on nodes come only from the
 * engine's SimulationRun (main brief §12): the scene animates them, it never computes them.
 */
export interface ShockNode { id: string; label: string; order: 1 | 2 | 3; x: number; y: number; value?: string; labelPos?: "l" | "r" | "t" | "b" }
export interface ShockEdge { from: string; to: string }
const C = { x: 1000, y: 616 };
const ORDER_COLOR = { 1: FLOW.risk, 2: FLOW.gold, 3: FLOW.energy } as const;
const RING = { 1: 147, 2: 265, 3: 383 } as const;
const AT = { 1: 0.3, 2: 1.1, 3: 1.9 } as const;

/** The plate's illustrative graph (positions from plate 07). Replaced by the engine's run when one is supplied. */
export const ILLUSTRATIVE_SHOCK: { nodes: ShockNode[]; edges: ShockEdge[] } = {
  nodes: [
    { id: "tanker", label: "Tanker throughput", order: 1, x: 927, y: 490, labelPos: "t" }, { id: "freight", label: "Freight cost", order: 1, x: 1111, y: 523, labelPos: "r" },
    { id: "warrisk", label: "War-risk insurance", order: 1, x: 1126, y: 689, labelPos: "r" }, { id: "brent", label: "Brent", order: 1, x: 927, y: 742, labelPos: "b" },
    { id: "oilrev", label: "Oil revenue", order: 2, x: 909, y: 367, labelPos: "t" }, { id: "inflation", label: "Inflation risk", order: 2, x: 1230, y: 484, labelPos: "r" },
    { id: "buffer", label: "Buffer days", order: 2, x: 1170, y: 820, labelPos: "r" }, { id: "portfolio", label: "Portfolio exposure", order: 2, x: 829, y: 820, labelPos: "b" },
    { id: "imports", label: "Import costs", order: 2, x: 734, y: 617, labelPos: "l" },
    { id: "sleeves", label: "Sleeve reallocation", order: 3, x: 797, y: 292, labelPos: "t" }, { id: "corridors", label: "Alternative corridors", order: 3, x: 1246, y: 323, labelPos: "r" },
    { id: "storage", label: "Strategic storage", order: 3, x: 1379, y: 563, labelPos: "r" }, { id: "industry", label: "Industrial acceleration", order: 3, x: 1293, y: 863, labelPos: "r" },
    { id: "partners", label: "Energy partnerships", order: 3, x: 640, y: 748, labelPos: "l" }, { id: "fiscal", label: "Fiscal balance", order: 3, x: 645, y: 473, labelPos: "l" },
  ],
  edges: [
    ...["tanker", "freight", "warrisk", "brent"].map((to) => ({ from: "shock", to })),
    { from: "tanker", to: "oilrev" }, { from: "tanker", to: "imports" }, { from: "freight", to: "inflation" }, { from: "freight", to: "oilrev" }, { from: "warrisk", to: "buffer" },
    { from: "warrisk", to: "inflation" }, { from: "brent", to: "portfolio" }, { from: "brent", to: "imports" },
    { from: "oilrev", to: "sleeves" }, { from: "oilrev", to: "fiscal" }, { from: "inflation", to: "corridors" }, { from: "inflation", to: "storage" }, { from: "buffer", to: "industry" },
    { from: "buffer", to: "storage" }, { from: "portfolio", to: "fiscal" }, { from: "portfolio", to: "partners" }, { from: "imports", to: "partners" }, { from: "imports", to: "fiscal" },
  ],
};

function Body({ run, nodes, edges, durationDays, highlightOrder }: { run: Run; nodes: ShockNode[]; edges: ShockEdge[]; durationDays: number; highlightOrder?: 1 | 2 | 3 }) {
  const { from, t, loop, speed } = run;
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const P = (id: string) => (id === "shock" ? { ...C, order: 0 as const } : byId.get(id)!);
  const intensity = Math.min(1.6, Math.max(0.6, durationDays / 30)); // longer disruptions ripple stronger and slower
  const dim = (o: number) => (highlightOrder && highlightOrder !== o ? 0.25 : 1);
  return (
    <>
      {Object.values(RING).map((r) => <circle key={r} cx={C.x} cy={C.y} r={r} fill="none" stroke="#86581d" strokeOpacity="0.28" strokeDasharray="3 5" />)}
      {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={C.x} cy={C.y} r={20 + i * 14} fill="none" stroke="#86581d" strokeOpacity={0.05} />)}
      {/* Entry ripple */}
      <motion.circle cx={C.x} cy={C.y} r={RING[3]} fill="none" stroke={FLOW.signal} initial={from({ scale: 0.05, opacity: 0.5 })} animate={{ scale: 1, opacity: 0 }} transition={t(2.2, 0)} />
      {/* Ambient ripples every 4 s */}
      {loop && [0, 1].map((i) => (
        <motion.circle key={i} cx={C.x} cy={C.y} r={RING[3]} fill="none" stroke={FLOW.signal} strokeOpacity={0.25 * intensity} initial={{ scale: 0.05, opacity: 1 }} animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: (4 * intensity) / speed, delay: i * 2, repeat: Infinity, repeatDelay: 0, ease: "easeOut" }} />
      ))}
      {edges.map((e, i) => {
        const a = P(e.from), b = P(e.to), order = "order" in b ? b.order : 1;
        const d = curve([a.x, a.y], [b.x, b.y], i % 2 ? 0.14 : -0.14);
        const color = ORDER_COLOR[order as 1 | 2 | 3];
        return (
          <g key={i} opacity={dim(order)}>
            <motion.path d={d} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.1" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(0.6, AT[order as 1 | 2 | 3] - 0.1)} />
            <Beads d={d} color={color} loop={loop} pxPerSec={45 / intensity} offset={i * 23} r={2.2} />
          </g>
        );
      })}
      {nodes.map((n) => {
        const color = ORDER_COLOR[n.order], pos = n.labelPos ?? "r";
        const lx = pos === "l" ? n.x - 18 : pos === "r" ? n.x + 18 : n.x, ly = pos === "t" ? n.y - 18 : pos === "b" ? n.y + 28 : n.y + 6;
        const anchor = pos === "l" ? "end" : pos === "r" ? "start" : "middle";
        return (
          <motion.g key={n.id} opacity={dim(n.order)} initial={from({ opacity: 0, scale: 0.5 })} animate={{ opacity: dim(n.order), scale: 1 }} transition={t(0.5, AT[n.order])} style={{ originX: 0.5, originY: 0.5 }}>
            <circle cx={n.x} cy={n.y} r="10" fill="var(--bg)" stroke={color} strokeWidth="1.3" />
            <circle cx={n.x} cy={n.y} r="3.6" fill={color} />
            <motion.text x={lx} y={ly} textAnchor={anchor} fill="var(--ink)" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.4, AT[n.order] + 0.35)} style={{ ...SANS, fontSize: 19, fontWeight: 500 }}>
              {n.label}{n.value && <tspan fill={color} style={MONO} fontSize="13">{`  ${n.value}`}</tspan>}
            </motion.text>
          </motion.g>
        );
      })}
      {/* Centre: the shock */}
      <circle cx={C.x} cy={C.y} r="44" fill={FLOW.signal} opacity="0.08" />
      <circle cx={C.x} cy={C.y} r="30" fill={FLOW.signal} opacity="0.1" />
      <circle cx={C.x} cy={C.y} r="22" fill="var(--bg)" stroke={FLOW.signal} strokeWidth="2" />
      <circle cx={C.x} cy={C.y} r="7" fill={FLOW.signal} />
      <text x={C.x} y={C.y + 62} textAnchor="middle" fill={FLOW.signal} style={{ ...MONO, fontSize: 13, letterSpacing: "0.22em" }}>Hormuz disruption</text>
      {/* Legend */}
      <motion.g initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.6, 2.3)}>
        <rect x="1655" y="204" width="270" height="137" fill="#f3ebde" stroke="#8a7258" strokeOpacity="0.4" />
        {([[1, "1st order · shock"], [2, "2nd order · exposure"], [3, "3rd order · opportunity"]] as const).map(([o, l], i) => (
          <g key={o}><circle cx="1681" cy={240 + i * 35} r="7" fill="none" stroke={ORDER_COLOR[o]} /><circle cx="1681" cy={240 + i * 35} r="2.6" fill={ORDER_COLOR[o]} />
            <text x="1702" y={246 + i * 35} fill="var(--ink)" style={{ ...SANS, fontSize: 16 }}>{l}</text></g>
        ))}
      </motion.g>
    </>
  );
}

export function ShockScene({ shockKey, durationDays = 30, nodes, edges, highlightOrder, label = "Illustrative", ...props }: SceneProps & {
  shockKey?: string | number; durationDays?: number; nodes?: ShockNode[]; edges?: ShockEdge[]; highlightOrder?: 1 | 2 | 3; label?: "Illustrative" | "Modelled";
}) {
  const g = nodes && edges ? { nodes, edges } : ILLUSTRATIVE_SHOCK;
  return (
    <Scene n="07" section={["Simulate", "Shock propagation"]} pill={label} fig="Fig. 07 — One shock, three orders of effect" entryMs={2600}
      aria={`Shock propagation from a Hormuz disruption: first-order ${g.nodes.filter((n) => n.order === 1).map((n) => n.label).join(", ")}; second-order ${g.nodes.filter((n) => n.order === 2).map((n) => n.label).join(", ")}; third-order ${g.nodes.filter((n) => n.order === 3).map((n) => n.label).join(", ")}.`}
      {...props} playKey={`${props.playKey ?? ""}-${shockKey ?? ""}`}>
      {(run) => <Body run={run} nodes={g.nodes} edges={g.edges} durationDays={durationDays} highlightOrder={highlightOrder} />}
    </Scene>
  );
}
