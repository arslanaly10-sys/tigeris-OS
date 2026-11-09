"use client";
import { useEffect, useMemo, useRef } from "react";
import { animate, motion, useAnimationFrame } from "motion/react";
import { DISPLAY, FLOW, MONO, Scene, rng, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 05 · Architecture layers (plate 05): L1 Signal → L2 Reasoning → L3 Orchestration → L4 Governance → Decision.
 * Entry: planes slide up 24 px and fade in L1→L4, grids draw, labels and leader lines draw.
 * Ambient: particles rise from L1 through each plane, thinning as they go; those that reach L4 converge on the apex,
 * and each arrival makes the apex pulse once. `pulseOnDecision` (incremented when a real decision is approved) sends
 * an extra burst. Synthetic motion: the plate is labelled as a diagram, not live data.
 */
const CX = 1000, HW = 428, HH = 108, APEX = { x: 1000, y: 214 };
const LAYERS = [
  { key: "L4", name: "Governance", word: "Governed", y: 373, dots: 26, color: FLOW.gold },
  { key: "L3", name: "Orchestration", word: "Sequenced", y: 546, dots: 220, color: "#8a7258" },
  { key: "L2", name: "Reasoning", word: "Contextualised", y: 719, dots: 520, color: "#8a7258" },
  { key: "L1", name: "Signal", word: "Observed", y: 892, dots: 1100, color: FLOW.signal },
] as const;
const diamond = (y: number) => `M${CX - HW} ${y}L${CX} ${y - HH}L${CX + HW} ${y}L${CX} ${y + HH}Z`;
const inDiamond = (r: () => number, y: number) => { let u, v; do { u = r() * 2 - 1; v = r() * 2 - 1; } while (Math.abs(u) + Math.abs(v) > 0.97); return { x: CX + u * HW, y: y + v * HH }; };

function Particles({ loop, burst, onArrive }: { loop: boolean; burst: number; onArrive: () => void }) {
  const N = 46;
  const dots = useRef<Array<SVGCircleElement | null>>([]);
  const state = useRef(Array.from({ length: N }, (_, i) => ({ t: i / N, start: { x: CX, y: 892 }, life: 1, speed: 0.06 + (i % 7) * 0.008 })));
  const r = useMemo(() => rng(505), []);
  useEffect(() => { // a burst: re-seed some particles at L4 so they converge now
    if (!burst) return;
    state.current.slice(0, 10).forEach((p) => { p.t = 0.78; });
  }, [burst]);
  useAnimationFrame((_, delta) => {
    if (!loop) return;
    state.current.forEach((p, i) => {
      p.t += (delta / 1000) * p.speed;
      if (p.t >= 1) { p.t = 0; p.start = inDiamond(r, 892); p.life = r() < 0.18 ? 1 : 0.55 + r() * 0.3; onArrive(); }
      const el = dots.current[i]; if (!el) return;
      // Rise through the planes; thin out: most particles stop before L4.
      const end = p.life >= 1 ? 1 : p.life;
      const tt = Math.min(p.t, end);
      const y = p.start.y - (892 - APEX.y) * tt;
      const k = Math.max(0, (tt - 0.7) / 0.3); // converge on the apex in the last stretch
      const x = p.start.x + (APEX.x - p.start.x) * k * k;
      el.setAttribute("cx", String(x)); el.setAttribute("cy", String(y));
      el.setAttribute("opacity", String(p.t > end ? 0 : 0.75 - tt * 0.3));
    });
  });
  if (!loop) return null;
  return <g aria-hidden="true">{Array.from({ length: N }, (_, i) => <circle key={i} ref={(el) => { dots.current[i] = el; }} r="2" fill={i % 3 ? "#8a7258" : FLOW.signal} cx="-99" cy="-99" />)}</g>;
}

function Body({ run, pulseOnDecision }: { run: Run; pulseOnDecision: number }) {
  const { from, t, loop, uid } = run;
  const ring = useRef<SVGCircleElement>(null);
  const last = useRef(0);
  // Each arrival pulses the apex once (at most every 0.7 s); imperative, so the scene does not re-render.
  const pulseApex = () => {
    const now = performance.now();
    if (!ring.current || now - last.current < 700) return;
    last.current = now;
    animate(ring.current, { scale: [1, 2], opacity: [0.6, 0] }, { duration: 1.4, ease: "easeOut" });
  };
  useEffect(() => { if (pulseOnDecision) { last.current = 0; pulseApex(); } }, [pulseOnDecision]); // eslint-disable-line react-hooks/exhaustive-deps
  const pts = useMemo(() => { const r = rng(55); return LAYERS.map((l) => Array.from({ length: l.dots }, () => inDiamond(r, l.y))); }, []);
  const links = useMemo(() => { const r = rng(56); const out: Array<[number, number, number, number]> = [];
    for (let li = 1; li < LAYERS.length; li++) for (let k = 0; k < 70; k++) { const a = pts[li]![Math.floor(r() * pts[li]!.length)]!, b = pts[li - 1]![Math.floor(r() * pts[li - 1]!.length)]!; out.push([a.x, a.y, b.x, b.y]); }
    return out; }, [pts]);
  return (
    <>
      <defs>
        <pattern id={`${uid}-dg`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="scale(1 0.5) rotate(45)"><path d="M28 0H0V28" fill="none" stroke="#6c4e30" strokeOpacity="0.07" /></pattern>
      </defs>
      {[...LAYERS].reverse().map((l, i) => (
        <motion.g key={l.key} initial={from({ opacity: 0, y: 24 })} animate={{ opacity: 1, y: 0 }} transition={t(0.8, 0.15 + i * 0.18)}>
          <path d={diamond(l.y)} fill={l.key === "L4" ? "#e3d3bb" : "#f5eee3"} fillOpacity={l.key === "L4" ? 0.85 : 0.7} stroke={l.key === "L4" ? FLOW.gold : "#8a7258"} strokeOpacity={l.key === "L4" ? 1 : 0.5} strokeWidth="1.2" />
          <path d={diamond(l.y)} fill={`url(#${uid}-dg)`} />
          {pts[3 - i]!.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r={l.key === "L1" ? 1.4 : 1.6} fill={l.color} fillOpacity={l.key === "L1" ? 0.55 : 0.6} />)}
        </motion.g>
      ))}
      {links.map(([x1, y1, x2, y2], i) => <motion.line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8a7258" strokeOpacity="0.13" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.6, 0.9 + (i % 20) * 0.02)} />)}
      {pts[0]!.map((p, i) => <motion.line key={i} x1={APEX.x} y1={APEX.y} x2={p.x} y2={p.y} stroke={FLOW.gold} strokeOpacity="0.35" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(0.8, 1.2 + i * 0.02)} />)}
      <Particles loop={loop} burst={pulseOnDecision} onArrive={pulseApex} />
      {/* Apex */}
      <circle ref={ring} cx={APEX.x} cy={APEX.y} r="13" fill="none" stroke={FLOW.gold} opacity="0" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
      <circle cx={APEX.x} cy={APEX.y} r="13" fill="none" stroke={FLOW.gold} strokeOpacity="0.5" />
      <circle cx={APEX.x} cy={APEX.y} r="5" fill={FLOW.gold} />
      <motion.text x="1025" y="221" fill={FLOW.gold} initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.6, 1.6)} style={{ ...DISPLAY, fontWeight: 700, fontSize: 21 }}>Decision</motion.text>
      {LAYERS.map((l, i) => (
        <motion.g key={l.key} initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.6, 1.0 + (3 - i) * 0.12)}>
          <text x="157" y={l.y + 5} fill={FLOW.gold} style={{ ...MONO, fontSize: 13, letterSpacing: "0.18em" }}>{l.key}</text>
          <text x="198" y={l.y + 5} fill="var(--ink)" style={{ ...MONO, fontSize: 13, letterSpacing: "0.22em" }}>{l.name}</text>
          <motion.path d={`M397 ${l.y}H557`} stroke="#8a7258" strokeOpacity="0.5" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(0.6, 1.1 + (3 - i) * 0.12)} />
          <motion.path d={`M1442 ${l.y}H1562`} stroke="#8a7258" strokeOpacity="0.5" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(0.6, 1.1 + (3 - i) * 0.12)} />
          <text x="1583" y={l.y + 8} fill={l.key === "L4" ? FLOW.gold : "var(--ink)"} style={{ ...DISPLAY, fontSize: 24, fontWeight: 500 }}>{l.word}</text>
        </motion.g>
      ))}
    </>
  );
}

export function LayersScene({ pulseOnDecision = 0, ...props }: SceneProps & { pulseOnDecision?: number }) {
  return (
    <Scene n="05" section={["Architecture"]} pill="Intelligence → Capability" fig="Fig. 05 — Four layers, one governed decision" entryMs={2600}
      aria="Four stacked layers: L1 Signal (observed), L2 Reasoning (contextualised), L3 Orchestration (sequenced) and L4 Governance (governed), converging on one decision." {...props}>
      {(run) => <Body run={run} pulseOnDecision={pulseOnDecision} />}
    </Scene>
  );
}
