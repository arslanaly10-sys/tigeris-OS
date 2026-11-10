"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { playbookByKey } from "@tigeris/shared";
import { DATA_SPRING } from "@/lib/motion/tokens";
import { DISPLAY, FLOW, MONO, SANS, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 13 · Strategic use cases. DRAFT: no plate was supplied; drawn from the written brief in the scenes' style.
 * Five cards rise in, staggered left to right. Each emblem has its own micro-motion, played on hover or focus only:
 * 01 sleeve arcs rebalance, 02 lines converge into the strait and release, 03 chips light in a travelling pattern,
 * 04 two circles slide to overlap and the bridge lines draw, 05 bars grow then the trend line draws. Card 02 is the
 * live golden path: its signal-blue top bar carries a slow sheen. Copy is the playbooks' own (packages/shared).
 */
export const USE_CASES = [
  { id: "01", name: "Allocation", playbook: "mandate-drift" },
  { id: "02", name: "Corridor", playbook: "energy-export", live: true },
  { id: "03", name: "Compute", playbook: "sovereign-intelligence" },
  { id: "04", name: "Diplomacy", playbook: "national-programme" },
  { id: "05", name: "Development", playbook: "industrial-capability" },
] as const;

const W = 330, GAP = 26, X0 = (2000 - (5 * W + 4 * GAP)) / 2, Y0 = 262, H = 660;
const wrap = (s: string, n: number) => s.split(" ").reduce<string[]>((lines, w) => {
  const last = lines[lines.length - 1];
  if (last !== undefined && (last + " " + w).length <= n) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w);
  return lines;
}, []);

function Emblem({ id, on, cx, cy }: { id: string; on: boolean; cx: number; cy: number }) {
  const g = FLOW.gold;
  if (id === "01") {
    const r = 62, C = 2 * Math.PI * r;
    const fr = on ? [0.18, 0.34, 0.3, 0.18] : [0.4, 0.25, 0.2, 0.15];
    const cols = [g, FLOW.transfer, FLOW.energy, FLOW.policy];
    let acc = 0;
    return <g>{fr.map((f, i) => { const off = acc; acc += f; return (
      <motion.circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={cols[i]} strokeWidth="12" transform={`rotate(-90 ${cx} ${cy})`}
        animate={{ strokeDasharray: `${f * C - 6} ${C}`, strokeDashoffset: -off * C }} transition={DATA_SPRING} />); })}</g>;
  }
  if (id === "02") {
    const ys = [-54, -18, 18, 54];
    return <g>{ys.map((y, i) => (
      <motion.path key={i} fill="none" stroke={i === 1 ? FLOW.signal : g} strokeWidth="1.6" strokeOpacity="0.8"
        animate={{ d: on ? `M${cx - 110} ${cy + y}Q${cx - 30} ${cy + y * 0.1} ${cx} ${cy}Q${cx + 30} ${cy + y * 0.1} ${cx + 110} ${cy + y}` : `M${cx - 110} ${cy + y}Q${cx - 30} ${cy + y * 0.8} ${cx} ${cy + y * 0.6}Q${cx + 30} ${cy + y * 0.8} ${cx + 110} ${cy + y}` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />))}
      <circle cx={cx} cy={cy} r="5" fill={on ? FLOW.signal : g} /></g>;
  }
  if (id === "03") {
    return <g>{Array.from({ length: 9 }, (_, i) => { const x = cx - 66 + (i % 3) * 46, y = cy - 66 + Math.floor(i / 3) * 46; return (
      <g key={i}><rect x={x} y={y} width="40" height="40" fill="none" stroke={g} strokeOpacity="0.6" />
        <motion.rect x={x + 8} y={y + 8} width="24" height="24" fill={FLOW.compute}
          animate={on ? { opacity: [0.15, 0.9, 0.15] } : { opacity: 0.2 }} transition={on ? { duration: 1.6, delay: ((i % 3) + Math.floor(i / 3)) * 0.12, repeat: Infinity } : { duration: 0.3 }} /></g>); })}</g>;
  }
  if (id === "04") {
    return <g>
      <motion.circle cy={cy} r="48" fill="none" stroke={g} strokeWidth="1.6" animate={{ cx: on ? cx - 26 : cx - 58 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      <motion.circle cy={cy} r="48" fill="none" stroke={FLOW.transfer} strokeWidth="1.6" animate={{ cx: on ? cx + 26 : cx + 58 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      {[-22, 0, 22].map((dy, i) => <motion.line key={dy} x1={cx - 26} x2={cx + 26} y1={cy + dy} y2={cy + dy} stroke={g} strokeWidth="1.2"
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.5, delay: on ? 0.5 + i * 0.08 : 0 }} />)}</g>;
  }
  const hs = [34, 52, 46, 74, 96];
  return <g>
    <line x1={cx - 96} x2={cx + 96} y1={cy + 64} y2={cy + 64} stroke="var(--line-strong)" />
    {hs.map((h, i) => <motion.rect key={i} x={cx - 90 + i * 38} width="26" fill={FLOW.energy} fillOpacity="0.7" animate={{ y: cy + 64 - (on ? h : h * 0.45), height: on ? h : h * 0.45 }} transition={{ duration: 0.6, delay: on ? i * 0.06 : 0, ease: [0.22, 1, 0.36, 1] }} />)}
    <motion.path d={`M${cx - 77} ${cy + 20}L${cx - 39} ${cy + 4}L${cx - 1} ${cy + 10}L${cx + 37} ${cy - 18}L${cx + 75} ${cy - 40}`} fill="none" stroke={g} strokeWidth="1.8"
      animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 0.7, delay: on ? 0.4 : 0 }} />
  </g>;
}

function Card({ i, run, active, onPick }: { i: number; run: Run; active: boolean; onPick: (key: string) => void }) {
  const u = USE_CASES[i]!;
  const pb = playbookByKey(u.playbook);
  const [hover, setHover] = useState(false);
  const x = X0 + i * (W + GAP);
  const live = "live" in u && u.live;
  const lines = wrap(pb?.intent ?? "", 34).slice(0, 6);
  const title = wrap(pb?.title ?? "", 22);
  const bodyY = Y0 + 352 + (title.length - 1) * 30 + 52;
  return (
    <motion.g initial={run.from({ opacity: 0, y: 30 })} animate={{ opacity: 1, y: 0 }} transition={run.t(0.8, 0.3 + i * 0.12)}
      tabIndex={0} role="button" aria-label={`${u.id} ${u.name}: ${pb?.title}`} style={{ cursor: "pointer", outline: "none" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      onClick={() => onPick(u.playbook)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(u.playbook)}>
      <rect x={x} y={Y0} width={W} height={H} fill="var(--surface)" stroke={hover || active ? "var(--primary)" : "var(--line)"} strokeWidth={hover || active ? 1.6 : 1} />
      <rect x={x} y={Y0} width={W} height="4" fill={live ? FLOW.signal : FLOW.goldSoft} />
      {live && run.loop && <motion.rect y={Y0} width="70" height="4" fill="#fff" fillOpacity="0.55" animate={{ x: [x, x + W - 70] }} transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }} />}
      <text x={x + 26} y={Y0 + 48} fill="var(--primary)" style={{ ...MONO, fontSize: 12, letterSpacing: "0.26em" }}>{u.id} · {u.name}</text>
      {live && <text x={x + W - 26} y={Y0 + 48} textAnchor="end" fill={FLOW.signal} style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.16em" }}>Golden path</text>}
      <Emblem id={u.id} on={hover || active} cx={x + W / 2} cy={Y0 + 200} />
      <text x={x + 26} y={Y0 + 352} fill="var(--ink)" style={{ ...DISPLAY, fontSize: 25 }}>{title.map((l, k) => <tspan key={k} x={x + 26} dy={k ? 30 : 0}>{l}</tspan>)}</text>
      <text x={x + 26} y={bodyY} fill="var(--ink-muted)" style={{ ...SANS, fontSize: 16 }}>{lines.map((l, k) => <tspan key={k} x={x + 26} dy={k ? 23 : 0}>{l}</tspan>)}</text>
      <text x={x + 26} y={Y0 + H - 30} fill="var(--ink-faint)" style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.16em" }}>Playbook · start a case →</text>
    </motion.g>
  );
}

export function UseCasesScene({ activeId, onPick, ...props }: SceneProps & { activeId?: string; onPick?: (playbookKey: string) => void }) {
  return (
    <Scene n="13" section={["Mandates", "Strategic Use Cases"]} pill="Five use cases" fig="Fig. 13 — Strategic use cases (draft, no plate)" entryMs={1800}
      aria={`Five strategic use cases: ${USE_CASES.map((u) => `${u.id} ${u.name}`).join(", ")}. Corridor is the live golden path.`} {...props}>
      {(run) => <>{USE_CASES.map((u, i) => <Card key={u.id} i={i} run={run} active={activeId === u.id} onPick={(k) => { onPick?.(k); props.onEvent?.({ type: "node-click", id: k }); }} />)}</>}
    </Scene>
  );
}
