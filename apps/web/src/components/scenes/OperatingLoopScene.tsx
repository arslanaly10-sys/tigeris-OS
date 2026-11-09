"use client";
import { motion } from "motion/react";
import { DATA_SPRING } from "@/lib/motion/tokens";
import { DISPLAY, FLOW, MONO, SANS, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 02 · Operating Loop. The client's twelve-step loop (tigercapital.ai/environment), plate 02.
 * Entry: dial ticks fade in clockwise, step nodes appear 01→12, the gold progress arc draws to `activeStep`.
 * Ambient: dotted spokes of completed steps flow toward the centre; the active node pulses.
 * Data: changing `activeStep` moves the arc with a high-damping spring; passed nodes fill gold in sequence.
 */
export const LOOP_STEPS = ["Detect", "Understand", "Anticipate", "Simulate", "Reason", "Decide", "Govern", "Coordinate", "Act", "Measure", "Learn", "Compound"] as const;
const C = { x: 1000, y: 609 }, R = 302;
const at = (k: number, r: number) => { const a = (-90 + k * 30) * (Math.PI / 180); return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a), a }; };

function Body({ run, active }: { run: Run; active: number }) {
  const { from, t, loop } = run;
  const ring = `M${C.x} ${C.y - R}A${R} ${R} 0 1 1 ${C.x - 0.01} ${C.y - R}`;
  return (
    <>
      {[52, 117, 177, 237, 385, 430].map((r, i) => <circle key={r} cx={C.x} cy={C.y} r={r} fill="none" stroke="#86581d" strokeOpacity={i === 0 ? 0.35 : 0.08} />)}
      <circle cx={C.x} cy={C.y} r="3" fill="#86581d" />
      <circle cx={C.x} cy={C.y} r={R} fill="none" stroke="#6c4e30" strokeOpacity="0.35" />
      {/* Dial ticks, clockwise */}
      {Array.from({ length: 120 }, (_, i) => {
        const a = (-90 + i * 3) * (Math.PI / 180), long = i % 10 === 0, r1 = R + 4, r2 = R + (long ? 16 : 9);
        return <motion.line key={i} x1={C.x + r1 * Math.cos(a)} y1={C.y + r1 * Math.sin(a)} x2={C.x + r2 * Math.cos(a)} y2={C.y + r2 * Math.sin(a)} stroke="#6c4e30" strokeOpacity={long ? 0.6 : 0.3}
          initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.25, i * 0.006)} />;
      })}
      {/* Spokes: dotted, flowing inward for completed steps */}
      {LOOP_STEPS.map((_, k) => {
        const a = at(k, R - 14), b = at(k, 120), done = k + 1 < active;
        return <motion.line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#86581d" strokeOpacity={done ? 0.45 : 0.2} strokeDasharray="2 7"
          initial={{ strokeDashoffset: 0 }} animate={loop && done ? { strokeDashoffset: [0, -36] } : { strokeDashoffset: 0 }}
          transition={loop && done ? { duration: 2.4, repeat: Infinity, ease: "linear" } : { duration: 0 }} />;
      })}
      {/* Progress arc to the active step (spring on data change) */}
      <motion.path d={ring} fill="none" stroke={FLOW.gold} strokeWidth="2.6" initial={from({ pathLength: 0 })} animate={{ pathLength: (active - 1) / 12 }}
        transition={run.entry ? t(1.4, 0.9) : DATA_SPRING} />
      {LOOP_STEPS.map((name, k) => {
        const p = at(k, R), l = at(k, 360), n = k + 1, isActive = n === active, done = n < active;
        const side = Math.abs(Math.cos(l.a)) < 0.2 ? "middle" : Math.cos(l.a) > 0 ? "start" : "end";
        const dy = Math.sin(l.a) > 0.9 ? 17 : Math.sin(l.a) < -0.9 ? 9 : 12;
        return (
          <motion.g key={name} initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.4, 0.45 + k * 0.06)}>
            {isActive && loop && <motion.circle cx={p.x} cy={p.y} r="11" fill="none" stroke={FLOW.signal} initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }} />}
            <circle cx={p.x} cy={p.y} r={isActive ? 11 : 8} fill="var(--bg)" stroke={isActive ? FLOW.signal : done ? FLOW.gold : "#6c4e30"} strokeOpacity={done || isActive ? 1 : 0.55} strokeWidth="1.3" />
            {(done || isActive) && <motion.circle cx={p.x} cy={p.y} r={isActive ? 4 : 3} initial={false} animate={{ fill: isActive ? FLOW.signal : FLOW.gold }} transition={{ duration: 0.3, delay: 0.05 * k }} />}
            <text x={l.x} y={l.y + dy - 22} textAnchor={side} fill={isActive ? FLOW.signal : "#86581d"} style={{ ...MONO, fontSize: 11, letterSpacing: "0.12em" }}>{String(n).padStart(2, "0")}</text>
            <text x={l.x} y={l.y + dy} textAnchor={side} fill={done || isActive ? "var(--ink)" : "#6f6358"} style={{ ...SANS, fontSize: 21, fontWeight: 500 }}>{name}</text>
          </motion.g>
        );
      })}
      <motion.g initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={t(0.8, 1.6)}>
        <text x={C.x} y={C.y - 82} textAnchor="middle" fill="#86581d" xmlSpace="preserve" style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.18em" }}>12 steps   ·   governed by construction</text>
        <text x={C.x} y={C.y + 97} textAnchor="middle" fill="var(--ink-muted)" style={{ ...DISPLAY, fontSize: 21, fontWeight: 500 }}>One sovereign operating loop</text>
      </motion.g>
    </>
  );
}

export function OperatingLoopScene({ activeStep = 7, ...props }: SceneProps & { activeStep?: number }) {
  const a = Math.min(12, Math.max(1, Math.round(activeStep)));
  return (
    <Scene n="02" section={["Operating loop"]} pill={`State · ${LOOP_STEPS[a - 1]}`} fig="Fig. 02 — From detection to compounding" entryMs={2600}
      aria={`The twelve-step sovereign operating loop, from Detect to Compound. The current step is ${a}, ${LOOP_STEPS[a - 1]}.`} {...props}>
      {(run) => <Body run={run} active={a} />}
    </Scene>
  );
}
