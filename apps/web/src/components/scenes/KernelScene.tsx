"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { DISPLAY, FLOW, MONO, SANS, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 12 · One kernel (plate 12): fragmented versus unified. One OS, not many.
 * fragmented: the left-hand systems drift apart slightly and their broken links flicker; the kernel is not yet drawn.
 * → unified: each system card travels into its domain node on the kernel and fades into it, the kernel rings draw,
 * and "Shared memory · Shared governance · Ledger" fades up. `autoplay` loops fragmented → unified every 12 s
 * (investor screen). Generic labels only: no competitor is named.
 */
const SYSTEMS = [
  { id: "A", x: 189, y: 300, color: FLOW.gold, to: "capital" }, { id: "B", x: 554, y: 258, color: FLOW.transfer, to: "trade" },
  { id: "C", x: 325, y: 571, color: FLOW.compute, to: "compute" }, { id: "D", x: 679, y: 612, color: FLOW.signal, to: "diplomacy" },
  { id: "E", x: 220, y: 810, color: FLOW.policy, to: "development" }, { id: "F", x: 595, y: 852, color: "#9b6d32", to: "capital" },
] as const;
const K = { x: 1500, y: 625 };
const DOMAINS = [
  { id: "capital", label: "Capital", x: 1500, y: 365, color: FLOW.gold, lx: 1500, ly: 338, anchor: "middle" },
  { id: "trade", label: "Trade & Supply", x: 1747, y: 544, color: FLOW.transfer, lx: 1779, ly: 541, anchor: "start" },
  { id: "compute", label: "Compute", x: 1653, y: 835, color: FLOW.compute, lx: 1672, ly: 869, anchor: "start" },
  { id: "diplomacy", label: "Diplomacy & Co-Investment", x: 1347, y: 835, color: FLOW.signal, lx: 1327, ly: 869, anchor: "end" },
  { id: "development", label: "Development & Regulation", x: 1252, y: 544, color: FLOW.policy, lx: 1221, ly: 541, anchor: "end" },
] as const;
const W = 188, Hc = 108;

function Body({ run, unified }: { run: Run; unified: boolean }) {
  const { from, t, loop } = run;
  const dom = (id: string) => DOMAINS.find((d) => d.id === id)!;
  return (
    <>
      <line x1="1000" x2="1000" y1="205" y2="1030" stroke="#8a7258" strokeOpacity="0.5" />
      <text x="125" y="241" fill={FLOW.risk} style={{ ...MONO, fontSize: 12, letterSpacing: "0.2em" }}>Fragmented</text>
      <text x="125" y="273" fill="var(--ink)" style={{ ...DISPLAY, fontSize: 26, fontWeight: 500 }}>One system per domain</text>
      <text x="1050" y="241" fill={FLOW.gold} style={{ ...MONO, fontSize: 12, letterSpacing: "0.2em" }}>Unified</text>
      <text x="1050" y="273" fill="var(--ink)" style={{ ...DISPLAY, fontSize: 26, fontWeight: 500 }}>One sovereign operating architecture</text>

      {/* Broken links between the separate systems */}
      {[[0, 2], [1, 3], [2, 4], [3, 5], [0, 1], [2, 3]].map(([a, b], i) => {
        const p = SYSTEMS[a!]!, q = SYSTEMS[b!]!;
        return <motion.line key={i} x1={p.x + W / 2} y1={p.y + Hc} x2={q.x + W / 2} y2={q.y} stroke={FLOW.risk} strokeOpacity="0.35" strokeDasharray="4 10"
          animate={loop && !unified ? { strokeDashoffset: [0, 28], opacity: [0.5, 1] } : { strokeDashoffset: 0, opacity: 0.8 }}
          transition={loop && !unified ? { duration: 5 + i, repeat: Infinity, repeatType: "mirror", ease: "linear" } : { duration: 0.3 }} />;
      })}
      {SYSTEMS.map((s, i) => (
        <motion.g key={s.id} initial={from({ opacity: 0, y: 12 })} animate={loop && !unified ? { opacity: 1, x: [0, (i % 2 ? 6 : -6)], y: [0, (i % 3 ? 4 : -4)] } : { opacity: 1, x: 0, y: 0 }}
          transition={loop && !unified ? { duration: 6 + i, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } : t(0.6, 0.1 + i * 0.06)}>
          {[12, 6].map((o) => <rect key={o} x={s.x - o} y={s.y + o} width={W} height={Hc} fill="var(--bg)" stroke="#8a7258" strokeOpacity="0.3" />)}
          <rect x={s.x} y={s.y} width={W} height={Hc} fill="#f7f1e6" stroke={s.color} strokeWidth="1.4" />
          <text x={s.x + 13} y={s.y + 28} fill="#4b4037" style={{ ...MONO, fontSize: 11, letterSpacing: "0.22em" }}>System {s.id}</text>
          {[50, 66, 82].map((y, j) => <line key={y} x1={s.x + 16} x2={s.x + W - 30 - j * 25} y1={s.y + y} y2={s.y + y} stroke="#8a7258" strokeOpacity="0.35" />)}
        </motion.g>
      ))}
      {/* Travelling copies: each system moves into its domain node when unifying */}
      {unified && SYSTEMS.map((s, i) => {
        const d = dom(s.to);
        return <motion.rect key={`f-${s.id}`} x={s.x} y={s.y} width={W} height={Hc} fill="none" stroke={s.color} strokeWidth="1.2"
          initial={from({ x: 0, y: 0, scale: 1, opacity: 0.8 })} animate={{ x: d.x - s.x - W / 2, y: d.y - s.y - Hc / 2, scale: 0.08, opacity: 0 }}
          transition={t(1.4, 0.2 + i * 0.08)} style={{ originX: 0.5, originY: 0.5 }} />;
      })}

      {/* Kernel */}
      {[333, 260].map((r) => <motion.circle key={r} cx={K.x} cy={K.y} r={r} fill="none" stroke="#8a7258" strokeOpacity="0.28" initial={from({ pathLength: 0 })} animate={{ pathLength: unified ? 1 : 0 }} transition={t(1.0, unified ? 0.9 : 0)} />)}
      {DOMAINS.map((d, i) => {
        const a = Math.atan2(d.y - K.y, d.x - K.x), sx = K.x + 158 * Math.cos(a), sy = K.y + 158 * Math.sin(a);
        return (
          <motion.g key={d.id} animate={{ opacity: unified ? 1 : 0.25 }} transition={t(0.6, unified ? 1.1 + i * 0.06 : 0)}>
            <motion.line x1={sx} y1={sy} x2={d.x} y2={d.y} stroke={d.color} strokeOpacity="0.55" initial={from({ pathLength: 0 })} animate={{ pathLength: unified ? 1 : 0 }} transition={t(0.6, 1.2 + i * 0.06)} />
            <circle cx={d.x} cy={d.y} r="18" fill="var(--bg)" stroke={d.color} strokeWidth="1.4" />
            <circle cx={d.x} cy={d.y} r="6" fill={d.color} />
            <text x={d.lx} y={d.ly} textAnchor={d.anchor} fill="var(--ink)" style={{ ...SANS, fontSize: 18, fontWeight: 500 }}>{d.label}</text>
          </motion.g>
        );
      })}
      <motion.circle cx={K.x} cy={K.y} r="156" fill="#e8dcca" stroke={FLOW.gold} strokeWidth="1.6" animate={{ fillOpacity: unified ? 0.85 : 0.25, strokeOpacity: unified ? 1 : 0.3 }} transition={t(0.7, unified ? 1.0 : 0)} />
      {[117, 77].map((r) => <circle key={r} cx={K.x} cy={K.y} r={r} fill="none" stroke={FLOW.gold} strokeOpacity="0.3" />)}
      <motion.g animate={{ opacity: unified ? 1 : 0 }} transition={t(0.6, unified ? 1.6 : 0)}>
        <text x={K.x} y={K.y - 40} textAnchor="middle" fill={FLOW.gold} style={{ ...MONO, fontSize: 11, letterSpacing: "0.25em" }}>Kernel</text>
        {["Shared memory", "Shared governance", "Ledger"].map((l, i) => <text key={l} x={K.x} y={K.y - 4 + i * 26} textAnchor="middle" fill="var(--ink)" style={{ ...SANS, fontSize: 17, fontWeight: 500 }}>{l}</text>)}
      </motion.g>
    </>
  );
}

export function KernelScene({ state = "unified", autoplay, ...props }: SceneProps & { state?: "fragmented" | "unified"; autoplay?: boolean }) {
  const [auto, setAuto] = useState<"fragmented" | "unified">("fragmented");
  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => setAuto((s) => (s === "unified" ? "fragmented" : "unified")), 6000);
    return () => clearInterval(id);
  }, [autoplay]);
  const s = autoplay ? auto : state;
  return (
    <Scene n="12" section={["One OS, not many"]} pill="TIGERIS Kernel" fig="Fig. 12 — Fragmented versus unified" entryMs={3000}
      aria="Fragmented: six separate systems, one per domain, with broken links. Unified: one kernel with shared memory, shared governance and a ledger, serving capital, trade and supply, compute, diplomacy and co-investment, and development and regulation." {...props}>
      {(run) => <Body run={run} unified={s === "unified"} />}
    </Scene>
  );
}
