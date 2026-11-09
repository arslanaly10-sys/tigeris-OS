"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ambient } from "@/lib/motion/tokens";
import { Beads, FLOW, MONO, SANS, Scene, curve, rng, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 09 · Institutional memory (plate 09): what we decided, and why.
 * Entry: clusters fade in one after another, edges draw, then the highlighted chain draws node by node with each card
 * appearing as the line reaches it. Ambient: nodes drift with small seeded noise; beads travel the chain.
 * Interaction: focusing or hovering a node highlights it and its neighbours. `highlightPath` (from a "what did we
 * decide and why" answer) animates a new chain. SYNTHETIC GRAPH: no client data.
 */
export interface MemoryGraph { clusters: Array<{ id: string; label: string; color: string; cx: number; cy: number; lx: number; ly: number; n: number }>; chain: Array<{ id: string; cluster: string; type: string; title: string; x: number; y: number; card: [number, number] }> }
export const SYNTHETIC_MEMORY: MemoryGraph = {
  clusters: [
    { id: "mandates", label: "Mandates", color: FLOW.gold, cx: 540, cy: 375, lx: 542, ly: 229, n: 30 },
    { id: "decisions", label: "Decisions", color: FLOW.signal, cx: 990, cy: 345, lx: 1000, ly: 187, n: 42 },
    { id: "documents", label: "Documents", color: FLOW.compute, cx: 1430, cy: 425, lx: 1459, ly: 240, n: 40 },
    { id: "programs", label: "Programs", color: FLOW.policy, cx: 650, cy: 790, lx: 625, ly: 967, n: 30 },
    { id: "counterparties", label: "Counterparties", color: FLOW.transfer, cx: 1050, cy: 830, lx: 1042, ly: 1008, n: 34 },
    { id: "outcomes", label: "Outcomes", color: FLOW.energy, cx: 1470, cy: 800, lx: 1459, ly: 967, n: 28 },
  ],
  chain: [
    { id: "m1", cluster: "mandates", type: "Mandate", title: "Resilience sleeve", x: 583, y: 416, card: [602, 360] },
    { id: "d1", cluster: "decisions", type: "Decision", title: "Corridor reserve", x: 1000, y: 312, card: [1019, 256] },
    { id: "doc1", cluster: "documents", type: "Document", title: "Board minutes, Q3", x: 1385, y: 343, card: [1404, 288] },
    { id: "p1", cluster: "counterparties", type: "Program", title: "Alternative logistics", x: 1020, y: 802, card: [1039, 746] },
    { id: "o1", cluster: "outcomes", type: "Outcome", title: "Measured, written back", x: 1437, y: 770, card: [1456, 715] },
  ],
};
const DEFAULT_PATH = [["m1", "d1", "doc1"], ["m1", "p1", "o1"]];

function Body({ run, graph, paths }: { run: Run; graph: MemoryGraph; paths: string[][] }) {
  const { from, t, loop } = run;
  const [focus, setFocus] = useState<string | null>(null);
  const nodes = useMemo(() => graph.clusters.map((c, ci) => {
    const r = rng(900 + ci);
    const pts = Array.from({ length: c.n }, () => ({ x: c.cx + (r() - 0.5) * 340, y: c.cy + (r() - 0.5) * 220 }));
    const edges: Array<[number, number]> = [];
    pts.forEach((p, i) => { const near = pts.map((q, j) => [j, Math.hypot(q.x - p.x, q.y - p.y)] as const).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2); near.forEach(([j]) => edges.push([i, j])); });
    return { c, pts, edges };
  }), [graph]);
  const byId = new Map(graph.chain.map((n) => [n.id, n] as const));
  const segs = paths.flatMap((p) => p.slice(1).map((id, i) => [byId.get(p[i]!)!, byId.get(id)!] as const));
  const neighbours = (id: string) => new Set(segs.flatMap(([a, b]) => (a.id === id ? [b.id] : b.id === id ? [a.id] : [])).concat(id));
  const lit = focus ? neighbours(focus) : null;
  return (
    <>
      {nodes.map(({ c, pts, edges }, ci) => (
        <motion.g key={c.id} initial={from({ opacity: 0 })} animate={{ opacity: lit ? 0.35 : 1 }} transition={t(0.7, ci * 0.18)}>
          <motion.g animate={loop ? { x: [-3, 3], y: [2, -2] } : { x: 0, y: 0 }} transition={loop ? ambient(10 + ci * 1.3, ci * 0.7) : { duration: 0 }}>
            {edges.map(([a, b], i) => <line key={i} x1={pts[a]!.x} y1={pts[a]!.y} x2={pts[b]!.x} y2={pts[b]!.y} stroke={c.color} strokeOpacity="0.22" />)}
            {pts.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="4.5" fill="var(--bg)" stroke={c.color} strokeOpacity="0.8" /><circle cx={p.x} cy={p.y} r="1.6" fill={c.color} /></g>)}
          </motion.g>
          <text x={c.lx} y={c.ly} textAnchor="middle" fill={c.color} style={{ ...MONO, fontSize: 13, letterSpacing: "0.22em" }}>{c.label}</text>
        </motion.g>
      ))}
      {segs.map(([a, b], i) => {
        const d = curve([a.x, a.y], [b.x, b.y], i % 2 ? -0.2 : 0.16);
        return (
          <g key={`${a.id}-${b.id}`}>
            <motion.path d={d} fill="none" stroke={FLOW.signal} strokeWidth="2" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(0.9, 1.4 + i * 0.5)} />
            <Beads d={d} color={FLOW.signal} loop={loop} pxPerSec={70} offset={i * 40} r={2.4} />
          </g>
        );
      })}
      {graph.chain.map((n, i) => {
        const col = graph.clusters.find((c) => c.id === n.cluster)!.color;
        const on = !lit || lit.has(n.id);
        return (
          <motion.g key={n.id} tabIndex={0} role="button" aria-label={`${n.type}: ${n.title}`} onFocus={() => setFocus(n.id)} onBlur={() => setFocus(null)} onMouseEnter={() => setFocus(n.id)} onMouseLeave={() => setFocus(null)}
            initial={from({ opacity: 0 })} animate={{ opacity: on ? 1 : 0.3 }} transition={t(0.5, 1.4 + i * 0.45)} style={{ cursor: "pointer", outline: "none" }}>
            <circle cx={n.x} cy={n.y} r="24" fill={col} opacity="0.1" />
            <circle cx={n.x} cy={n.y} r="11" fill="var(--bg)" stroke={col} strokeWidth="1.6" />
            <circle cx={n.x} cy={n.y} r="4.5" fill={col} />
            <rect x={n.card[0]} y={n.card[1]} width="218" height="49" fill="#f7f1e6" stroke={col} strokeOpacity="0.55" />
            <text x={n.card[0] + 13} y={n.card[1] + 18} fill={col} style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.2em" }}>{n.type}</text>
            <text x={n.card[0] + 13} y={n.card[1] + 39} fill="var(--ink)" style={{ ...SANS, fontSize: 16, fontWeight: 500 }}>{n.title}</text>
          </motion.g>
        );
      })}
    </>
  );
}

export function MemoryScene({ graph = SYNTHETIC_MEMORY, highlightPath, ...props }: SceneProps & { graph?: MemoryGraph; highlightPath?: string[] }) {
  const paths = highlightPath ? [highlightPath] : DEFAULT_PATH;
  return (
    <Scene n="09" section={["Institutional memory"]} pill="Synthetic graph" fig="Fig. 09 — What we decided, and why" entryMs={3600}
      aria={`Institutional memory graph (synthetic): ${paths.map((p) => p.map((id) => graph.chain.find((n) => n.id === id)?.title).join(" → ")).join("; ")}.`} {...props} playKey={`${props.playKey ?? ""}-${paths.flat().join(".")}`}>
      {(run) => <Body run={run} graph={graph} paths={paths} />}
    </Scene>
  );
}
