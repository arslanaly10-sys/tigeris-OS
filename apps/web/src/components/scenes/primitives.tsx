"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { enter } from "@/lib/motion/tokens";

/** Common props for every scene (docs/MOTION_SCENES.md §3.2). Data arrives through props; scenes never fetch. */
export type SceneMode = "entry" | "ambient" | "static";
export type SceneEvent = { type: "entry-complete" } | { type: "node-click"; id: string };
export interface SceneProps {
  mode?: SceneMode;
  playKey?: string | number;
  speed?: number;
  chrome?: boolean;
  /** Gallery only: behave as if the viewer asked for reduced motion. */
  forceReducedMotion?: boolean;
  onEvent?: (e: SceneEvent) => void;
  className?: string;
}

/** OS-wide pause for ambient motion (WCAG 2.2.2). Provided by the shell or the gallery. */
export const ScenePauseContext = createContext(false);

function useTabVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const on = () => setV(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

/**
 * What a scene may do right now. `entry`: play the build-up (false means render the final frame at once).
 * `loop`: run ambient loops; only when on screen, the tab is visible, nothing is paused and motion is allowed.
 */
export function useSceneRun(ref: React.RefObject<Element | null>, p: SceneProps) {
  const reduced = useReducedMotion() || !!p.forceReducedMotion;
  const paused = useContext(ScenePauseContext);
  const inView = useInView(ref, { amount: 0.15 });
  const visible = useTabVisible();
  const still = reduced || p.mode === "static";
  return { entry: !still && p.mode !== "ambient", loop: !still && !paused && inView && visible, speed: p.speed ?? 1, reduced: still };
}

/** The site's hairline grid: 24 px minor, 96 px major, in design-space units. */
export function Grid({ id, w = 1920, h = 1080 }: { id: string; w?: number; h?: number }) {
  return (
    <g aria-hidden="true">
      <defs>
        <pattern id={`${id}-minor`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#6c4e30" strokeOpacity="0.045" /></pattern>
        <pattern id={`${id}-major`} width="96" height="96" patternUnits="userSpaceOnUse"><path d="M96 0H0V96" fill="none" stroke="#6c4e30" strokeOpacity="0.08" /></pattern>
      </defs>
      <rect width={w} height={h} fill="var(--bg)" />
      <rect width={w} height={h} fill={`url(#${id}-minor)`} />
      <rect width={w} height={h} fill={`url(#${id}-major)`} />
    </g>
  );
}

const mono = { fontFamily: "var(--font-mono)", textTransform: "uppercase" } as const;

/**
 * Scene chrome (§4): the "TIGER CAPITAL AI" lockup, a numbered section label whose rule draws left to right, the pill
 * on the right and the FIG. caption. Entry: the rule draws (0.7 s), then the labels fade up 6 px.
 */
export function SceneChrome({ n, section, pill, fig, entry, speed, sectionRuleFrom }: {
  n: string; section: string[]; pill: string; fig: string; entry: boolean; speed: number; sectionRuleFrom: number;
}) {
  const up = (d: number) => (entry ? { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: enter(0.6, d, speed) } : {});
  const draw = (d: number) => (entry ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: enter(0.7, d, speed) } : {});
  return (
    <g>
      <motion.g {...up(0.1)}>
        <text x="72" y="59" fill="var(--ink)" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.02em" }}>TIGER CAPITAL AI</text>
        <text x="72" y="76" fill="var(--ink-muted)" textLength={196} lengthAdjust="spacing" style={{ fontFamily: "var(--font-sans)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Sovereign Intelligence Architecture</text>
        <rect x="1650" y="39" width="198" height="35" fill="none" stroke="var(--primary)" strokeOpacity="0.6" />
        <text x="1668" y="61" fill="var(--primary)" textLength={163} lengthAdjust="spacing" style={{ ...mono, fontSize: 10 }}>{pill}</text>
      </motion.g>
      <motion.path d="M0 104H1920" stroke="var(--line)" {...draw(0)} />
      <motion.g {...up(0.35)}>
        {/* One string, fitted to the plate's measured width so the rule starts where the label ends. */}
        <text x="72" y="152" fill="var(--primary)" textLength={sectionRuleFrom - 90} lengthAdjust="spacing" xmlSpace="preserve" style={{ ...mono, fontSize: 11 }}>{[n, ...section].join("   ·   ")}</text>
      </motion.g>
      <motion.path d={`M${sectionRuleFrom} 148H1848`} stroke="var(--primary)" strokeOpacity="0.45" {...draw(0.2)} />
      <motion.g {...up(0.6)}>
        <text x="72" y="1028" fill="var(--ink-muted)" textLength={fig.length * 6.75} lengthAdjust="spacing" style={{ ...mono, fontSize: 10 }}>{fig}</text>
        <text x="1666" y="1028" fill="var(--ink-faint)" textLength={182} lengthAdjust="spacing" xmlSpace="preserve" style={{ ...mono, fontSize: 10 }}>TIGERIS AI OS   ·   Prototype</text>
      </motion.g>
    </g>
  );
}
