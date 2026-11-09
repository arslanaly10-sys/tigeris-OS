"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ambient } from "@/lib/motion/tokens";
import { LOOP_LINE } from "@/content/client-copy";
import { Beads, DISPLAY, FLOW, MONO, Node, Scene, curve, rng, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 01 · Sovereign Horizon (boot). docs/MOTION_SCENES.md §5. Geometry read from plate 01 (2000×1125).
 * Entry: horizon draws outward, skyline rises from the centre out, dome dots ring by ring, arcs draw, nodes appear,
 * the TIGERIS letters reveal left to right, then the step line. Ambient: node halos pulse on their own phases, beads
 * travel the arcs, the reflection shimmers, the step line highlights one word at a time.
 */
const H = 737;
// [x0, x1, top] from the zoomed plate.
const SKY: Array<[number, number, number]> = [
  [62, 99, 523], [114, 151, 523], [158, 185, 523], [200, 258, 520], [265, 287, 518], [294, 315, 512], [320, 367, 490], [383, 440, 489], [448, 494, 520], [500, 521, 516],
  [528, 576, 514], [591, 622, 480], [630, 677, 491], [687, 723, 508], [729, 766, 444], [781, 828, 399], [834, 890, 471], [898, 945, 461], [951, 997, 80], [1013, 1034, 385],
  [1048, 1071, 379], [1076, 1101, 471], [1106, 1143, 457], [1159, 1195, 216], [1203, 1260, 478], [1266, 1296, 476], [1312, 1333, 498], [1339, 1359, 506], [1374, 1400, 461],
  [1408, 1445, 479], [1452, 1489, 476], [1494, 1530, 496], [1538, 1560, 507], [1570, 1591, 513], [1606, 1652, 499], [1659, 1679, 491], [1687, 1723, 522], [1734, 1766, 522],
  [1771, 1792, 522], [1798, 1820, 522], [1831, 1877, 522], [1893, 1940, 522],
];
const BUILDINGS = SKY.map(([a, b, t]) => ({ x: 600 + a / 2.5, w: (b - a) / 2.5, h: H - (520 + t / 2.5) }));
const GOLD_NODES: Array<[number, number]> = [[925, 209], [842, 365], [880, 371], [568, 446], [797, 513], [1164, 309], [1217, 504], [1325, 444]];
const BLUE_NODES: Array<[number, number]> = [[999, 385], [1115, 537], [777, 633], [1266, 640], [1447, 499]];
const ARCS: Array<[[number, number], [number, number], number]> = [
  [[925, 209], [842, 365], 0.22], [[880, 371], [797, 513], 0.18], [[880, 371], [1217, 504], -0.16], [[797, 513], [999, 385], -0.2], [[999, 385], [1115, 537], -0.15],
  [[1115, 537], [1325, 444], -0.2], [[1217, 504], [1325, 444], -0.25], [[568, 446], [777, 633], -0.12], [[1164, 309], [1266, 640], 0.05], [[999, 385], [1217, 504], -0.2],
];
// Dome: dots on concentric half rings around the skyline's centre, inner to outer.
const DOME = (() => {
  const r = rng(1001), out: Array<{ x: number; y: number; ring: number }> = [];
  for (let ring = 0; ring < 18; ring++) {
    const R = 70 + ring * 27, n = Math.round((Math.PI * R) / 26);
    for (let k = 0; k <= n; k++) {
      const a = Math.PI + (Math.PI * k) / n + (r() - 0.5) * 0.01;
      const x = 1000 + R * 1.12 * Math.cos(a), y = H + R * Math.sin(a);
      if (y < H - 6) out.push({ x, y, ring });
    }
  }
  return out;
})();

function Body({ run, activeStep }: { run: Run; activeStep?: number }) {
  const { from, t, loop } = run;
  const [hi, setHi] = useState(activeStep ?? 0);
  useEffect(() => {
    if (activeStep !== undefined) { setHi(activeStep); return; }
    if (!loop) return;
    const id = setInterval(() => setHi((h) => (h + 1) % LOOP_LINE.length), 2200);
    return () => clearInterval(id);
  }, [loop, activeStep]);
  return (
    <>
      {/* Ground glow under the skyline */}
      <defs><radialGradient id={`${run.uid}-glow`} cx="0.5" cy="1" r="0.6"><stop offset="0" stopColor="#ac8c61" stopOpacity="0.16" /><stop offset="1" stopColor="#ac8c61" stopOpacity="0" /></radialGradient></defs>
      <rect x="560" y="300" width="880" height="560" fill={`url(#${run.uid}-glow)`} />

      {DOME.map((d, i) => (
        <motion.circle key={i} cx={d.x} cy={d.y} r="1.3" fill="#86581d" fillOpacity="0.32" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.5, 1.0 + d.ring * 0.06)} />
      ))}

      {ARCS.map(([a, b, bend], i) => <motion.path key={i} d={curve(a, b, bend)} fill="none" stroke="#86581d" strokeOpacity="0.5" strokeWidth="1"
        initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(1.0, 1.6 + i * 0.05)} />)}
      {ARCS.slice(0, 4).map(([a, b, bend], i) => <Beads key={i} d={curve(a, b, bend)} color={i % 2 ? FLOW.signal : FLOW.gold} loop={loop} pxPerSec={60} offset={i * 90} />)}

      {GOLD_NODES.map(([x, y], i) => <Node key={`g${i}`} x={x} y={y} color={FLOW.gold} r={7} core={3} halo={20} pulse loop={loop} phase={(i * 0.71) % 3.6} appear={{ initial: from({}), delay: 2.0 + i * 0.04, run }} />)}
      {BLUE_NODES.map(([x, y], i) => <Node key={`b${i}`} x={x} y={y} color={FLOW.signal} r={7} core={3} halo={20} pulse loop={loop} phase={(i * 1.13) % 3.6} appear={{ initial: from({}), delay: 2.1 + i * 0.04, run }} />)}
      <circle cx="974" cy="547" r="2.2" fill={FLOW.signal} />

      {BUILDINGS.map((b, i) => (
        <motion.g key={i} initial={from({ scaleY: 0 })} animate={{ scaleY: 1 }} style={{ originY: 1 }} transition={t(0.8, 0.5 + Math.abs(b.x + b.w / 2 - 1000) / 1600)}>
          <rect x={b.x} y={H - b.h} width={b.w} height={b.h} fill="var(--bg)" stroke="#4b4037" strokeOpacity="0.8" />
          {b.h > 70 && Array.from({ length: Math.floor(b.h / 8) - 1 }, (_, j) => <line key={j} x1={b.x + 3} x2={b.x + b.w - 3} y1={H - b.h + 8 + j * 8} y2={H - b.h + 8 + j * 8} stroke="#6c4e30" strokeOpacity="0.15" />)}
        </motion.g>
      ))}
      {[`M1000 ${H}H75`, `M1000 ${H}H1925`].map((d) => <motion.path key={d} d={d} stroke="#4b4037" strokeWidth="1.3" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={t(1.2, 0)} />)}
      {Array.from({ length: 9 }, (_, i) => (
        <motion.line key={i} x1={1000 - (440 - i * 40)} x2={1000 + (440 - i * 40)} y1={H + 6 + i * 7} y2={H + 6 + i * 7} stroke="#86581d" strokeOpacity={0.2 - i * 0.015}
          initial={from({ opacity: 0 })} animate={loop ? { opacity: 1, x: [-6, 6] } : { opacity: 1, x: 0 }}
          transition={loop ? { opacity: t(0.8, 1.2), x: ambient(7 + (i % 4), i * 0.4) } : t(0.8, 1.2)} />
      ))}

      {/* TIGERIS, letter by letter */}
      <text x="734" y="944" textLength={530} lengthAdjust="spacing" aria-hidden="true" style={{ ...DISPLAY, fontWeight: 700, fontSize: 108 }}>
        {"TIGERIS".split("").map((c, i) => (
          <motion.tspan key={i} fill="var(--ink)" initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.7, 2.4 + i * 0.08)}>{c}</motion.tspan>
        ))}
      </text>
      <text x="706" y="996" textLength={588} lengthAdjust="spacing" xmlSpace="preserve" style={{ ...MONO, fontSize: 13 }}>
        {LOOP_LINE.map((w, i) => (
          <motion.tspan key={w} initial={from({ opacity: 0 })} animate={{ opacity: 1, fill: hi === i && loop ? "#86581d" : "#9b7a4f" }} transition={{ opacity: t(0.3, 3.1 + i * 0.12), fill: { duration: 0.3 } }}>
            {w}{i < LOOP_LINE.length - 1 ? "   ·   " : ""}
          </motion.tspan>
        ))}
      </text>
    </>
  );
}

export function HorizonScene({ activeStep, ...props }: SceneProps & { activeStep?: number }) {
  return (
    <Scene n="01" section={["Sovereign Intelligence Kernel"]} pill="Boot · Prototype" fig="Fig. 01 — The sovereign horizon" entryMs={4000}
      aria="TIGERIS boot screen: a skyline on the horizon under a dome of intelligence nodes, with the loop Observe, Reason, Simulate, Govern, Execute, Learn." {...props}>
      {(run) => <Body run={run} activeStep={activeStep} />}
    </Scene>
  );
}
