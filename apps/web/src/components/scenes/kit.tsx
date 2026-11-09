"use client";
import { useEffect, useId, useRef } from "react";
import { motion, useAnimationFrame } from "motion/react";
import { ambient, enter } from "@/lib/motion/tokens";
import { Grid, SceneChrome, useSceneRun, type SceneProps } from "./primitives";

/**
 * Scene kit (docs/MOTION_SCENES.md §3–4). Scene content is written in the reference plates' own pixel space
 * (2000×1125) and scaled into the 1920×1080 design space, so coordinates can be read straight off a plate.
 */
export const PLATE_SCALE = 0.96;

export interface Run { entry: boolean; loop: boolean; speed: number; uid: string;
  /** `initial` for an entry animation, or false to render the final frame at once. */
  from: <T>(v: T) => T | false;
  t: (duration: number, delay?: number) => ReturnType<typeof enter>;
}

export function Scene({ n, section, pill, fig, aria, entryMs = 3500, children, ...props }: SceneProps & {
  n: string; section: string[]; pill: string; fig: string; aria: string; entryMs?: number; children: (r: Run) => React.ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, "");
  const { entry, loop, speed } = useSceneRun(ref, props);
  const chrome = props.chrome ?? true;
  const onEvent = useRef(props.onEvent);
  onEvent.current = props.onEvent;
  useEffect(() => {
    if (!entry) { onEvent.current?.({ type: "entry-complete" }); return; }
    const id = setTimeout(() => onEvent.current?.({ type: "entry-complete" }), entryMs / speed);
    return () => clearTimeout(id);
  }, [entry, speed, entryMs, props.playKey]);
  const run: Run = { entry, loop, speed, uid, from: (v) => (entry ? v : false), t: (d, delay = 0) => enter(d, delay, speed) };
  // The section rule starts after the label; ~8.1 design px per character of the joined label.
  const ruleFrom = 90 + [n, ...section].join("   ·   ").length * 8.1;
  return (
    <svg ref={ref} key={props.playKey} viewBox="0 0 1920 1080" className={props.className} role="img" aria-label={aria}>
      {chrome && <Grid id={`${uid}-g`} />}
      <g transform={`scale(${PLATE_SCALE})`}>{children(run)}</g>
      {chrome && <SceneChrome n={n} section={section} pill={pill} fig={fig} entry={entry} speed={speed} sectionRuleFrom={ruleFrom} />}
    </svg>
  );
}

/** Seeded, deterministic randomness (mulberry32), so a scene matches its plate every time. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A quadratic curve between two points, bowed perpendicular to the chord by `bend` (fraction of its length). */
export function curve(a: readonly [number, number], b: readonly [number, number], bend = 0.18) {
  const [x1, y1] = a, [x2, y2] = b;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  return `M${x1} ${y1}Q${mx - dy * bend} ${my + dx * bend} ${x2} ${y2}`;
}

/** Node: ring plus core in a flow colour. `pulse` adds a halo that grows 1→1.6 and fades, on its own phase. */
export function Node({ x, y, color, r = 9, core = 3.6, pulse, loop, phase = 0, halo, appear }: {
  x: number; y: number; color: string; r?: number; core?: number; pulse?: boolean; loop?: boolean; phase?: number; halo?: number;
  appear?: { initial: object | false; delay: number; run: Run };
}) {
  const a = appear ? { initial: appear.initial === false ? false : { opacity: 0, scale: 0.4 }, animate: { opacity: 1, scale: 1 }, transition: appear.run.t(0.6, appear.delay) } : {};
  return (
    <motion.g {...a}>
      {halo && <circle cx={x} cy={y} r={halo} fill={color} opacity="0.1" />}
      {pulse && loop && (
        <motion.circle cx={x} cy={y} r={r} fill="none" stroke={color} initial={{ scale: 1, opacity: 0.45 }} animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 3.6, delay: phase, repeat: Infinity, ease: "easeOut" }} />
      )}
      <circle cx={x} cy={y} r={r} fill="var(--bg)" stroke={color} strokeWidth="1.3" />
      <circle cx={x} cy={y} r={core} fill={color} />
    </motion.g>
  );
}

/**
 * Beads travelling along a path at a set speed (px per second). Positions are written straight to the DOM from
 * Motion's frame loop, so nothing re-renders; they stop when `loop` is false.
 */
export function Beads({ d, count = 1, pxPerSec = 90, color, r = 2.6, loop, offset = 0, reverse }: {
  d: string; count?: number; pxPerSec?: number; color: string; r?: number; loop: boolean; offset?: number; reverse?: boolean;
}) {
  const path = useRef<SVGPathElement>(null);
  const dots = useRef<Array<SVGCircleElement | null>>([]);
  const len = useRef(0);
  useEffect(() => { len.current = path.current?.getTotalLength() ?? 0; }, [d]);
  useAnimationFrame((time) => {
    if (!loop || !path.current || !len.current) return;
    for (let i = 0; i < count; i++) {
      const c = dots.current[i];
      if (!c) continue;
      let s = ((time / 1000) * pxPerSec + offset + (i * len.current) / count) % len.current;
      if (reverse) s = len.current - s;
      const p = path.current.getPointAtLength(s);
      c.setAttribute("cx", String(p.x)); c.setAttribute("cy", String(p.y));
    }
  });
  if (!loop) return null;
  return (
    <g aria-hidden="true">
      <path ref={path} d={d} fill="none" stroke="none" />
      {Array.from({ length: count }, (_, i) => <circle key={i} ref={(el) => { dots.current[i] = el; }} r={r} fill={color} cx="-99" cy="-99" />)}
    </g>
  );
}

/** A line that draws on (pathLength 0→1). */
export function Draw({ d, run, delay = 0, duration = 0.9, ...rest }: { d: string; run: Run; delay?: number; duration?: number } & React.SVGProps<SVGPathElement>) {
  const { initial: _i, animate: _a, transition: _t, ...svg } = rest as Record<string, unknown>;
  return <motion.path d={d} fill="none" initial={run.from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={run.t(duration, delay)} {...(svg as object)} />;
}

/** Fade-up for labels: 6 px, after the thing they label. */
export const fadeUp = (run: Run, delay: number) => ({ initial: run.from({ opacity: 0, y: 6 }), animate: { opacity: 1, y: 0 }, transition: run.t(0.6, delay) });

/** A slow breathing loop for a group (scale 1→s), used sparingly. */
export const breathe = (loop: boolean, s = 1.02, period = 6) => (loop ? { animate: { scale: [1, s] }, transition: ambient(period / 2) } : { animate: { scale: 1 } });

export const MONO = { fontFamily: "var(--font-mono)", textTransform: "uppercase" } as const;
export const SANS = { fontFamily: "var(--font-sans)" } as const;
export const DISPLAY = { fontFamily: "var(--font-display)" } as const;
export const FLOW = { compute: "#6e519d", energy: "#317a45", transfer: "#007785", risk: "#c13d34", policy: "#657b3d", gold: "#86581d", goldSoft: "#ac8c61", signal: "#1447e6", ink: "#140e09" } as const;
