"use client";
import { useEffect, useId, useRef } from "react";
import { motion } from "motion/react";
import { ambient, enter, stagger } from "@/lib/motion/tokens";
import { BUILDINGS, HORIZON, REFLECTIONS, RINGS, SUN, TEXT } from "@/lib/scene-data/briefing";
import { WELCOME } from "@/content/client-copy";
import { Grid, SceneChrome, useSceneRun, type SceneProps } from "./primitives";

/**
 * Scene 06 · Briefing (welcome screen). docs/MOTION_SCENES.md §5.
 * Entry: the sun rises from behind the horizon (2.4 s), the engraved rings expand from its centre, reflection lines
 * ripple in, the headline reveals line by line (third line gold), then the rule and meta line.
 * Ambient: the rings expand very slowly (20 s), the reflection shimmers. Copy is verbatim from client-copy.ts.
 */
const LINES = ["An invitation to shape", "the Sovereign Intelligence", "Operating System."] as const;
// The plate's line breaks must spell the client headline exactly.
if (LINES.join(" ") !== WELCOME.headline) throw new Error("Briefing scene headline drifted from the client copy");

export function BriefingScene(props: SceneProps) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, "");
  const { entry, loop, speed } = useSceneRun(ref, props);
  const chrome = props.chrome ?? true;
  const onEvent = useRef(props.onEvent);
  onEvent.current = props.onEvent;

  useEffect(() => {
    if (!entry) { onEvent.current?.({ type: "entry-complete" }); return; }
    const t = setTimeout(() => onEvent.current?.({ type: "entry-complete" }), 4200 / speed);
    return () => clearTimeout(t);
  }, [entry, speed, props.playKey]);

  const from = <T,>(initial: T) => (entry ? initial : false);
  const lineReveal = (i: number) => ({ initial: from({ y: 90 }), animate: { y: 0 }, transition: enter(1.0, 1.5 + i * 0.18, speed) });

  return (
    <svg ref={ref} key={props.playKey} viewBox={chrome ? "0 0 1920 1080" : "700 380 1220 560"} className={props.className} role="img"
      aria-label={`${WELCOME.headline} An outlined city skyline stands on the horizon in front of a large gold sun.`}>
      <defs>
        <radialGradient id={`${uid}-sun`} cx="0.48" cy="0.38" r="0.62">
          <stop offset="0" stopColor="#b8956a" />
          <stop offset="0.55" stopColor="#9b6d32" />
          <stop offset="1" stopColor="var(--primary)" />
        </radialGradient>
        <pattern id={`${uid}-stripes`} width="8" height="7" patternUnits="userSpaceOnUse"><rect y="5.6" width="8" height="1.1" fill="#f3e6cf" opacity="0.32" /></pattern>
        <clipPath id={`${uid}-sky`}><rect width="1920" height={HORIZON} /></clipPath>
        {LINES.map((_, i) => <clipPath key={i} id={`${uid}-l${i}`}><rect x="100" y={TEXT.headline.baselines[i]! - 62} width="1000" height="82" /></clipPath>)}
      </defs>

      {chrome && <Grid id={`${uid}-g`} />}

      {/* Engraved rings: expand from the sun's centre, then breathe on a 20 s loop. */}
      <motion.g animate={loop ? { scale: [1, 1.018] } : { scale: 1 }} transition={loop ? ambient(10) : { duration: 0 }}>
        {RINGS.map((r, i) => (
          <motion.circle key={r} cx={SUN.cx} cy={SUN.cy} r={r} fill="none" stroke="var(--primary)" strokeOpacity={Math.max(0.03, 0.16 - i * 0.0065)}
            initial={from({ scale: 0.55, opacity: 0 })} animate={{ scale: 1, opacity: 1 }}
            transition={enter(1.4, 0.9 + stagger(i, 0.04), speed)} />
        ))}
      </motion.g>

      {/* The sun rises from behind the horizon. */}
      <g clipPath={`url(#${uid}-sky)`}>
        <motion.g initial={from({ y: 420 })} animate={{ y: 0 }} transition={enter(2.4, 0.15, speed)}>
          <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={`url(#${uid}-sun)`} />
          <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={`url(#${uid}-stripes)`} />
        </motion.g>
      </g>

      {/* Skyline: buildings stand on the horizon in front of the sun, rising outward from the sun's column. */}
      {BUILDINGS.map(([x, w, h], i) => {
        const fromSun = Math.abs(x + w / 2 - SUN.cx);
        return (
          <motion.g key={i} initial={from({ scaleY: 0 })} animate={{ scaleY: 1 }} style={{ originY: 1 }}
            transition={enter(0.9, 0.5 + fromSun / 1400, speed)}>
            <rect x={x} y={HORIZON - h} width={w} height={h} fill="var(--bg)" stroke="#4b4037" strokeOpacity="0.75" strokeWidth="1" />
            {h > 60 && Array.from({ length: Math.floor(h / 9) - 1 }, (_, j) => (
              <line key={j} x1={x + 3} x2={x + w - 3} y1={HORIZON - h + 9 + j * 9} y2={HORIZON - h + 9 + j * 9} stroke="#6c4e30" strokeOpacity="0.16" />
            ))}
          </motion.g>
        );
      })}

      {/* Horizon */}
      <motion.path d={`M72 ${HORIZON}H1848`} stroke="#4b4037" strokeWidth="1.2" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={enter(1.2, 0, speed)} />

      {/* Reflection: ripples in under the sun, then shimmers. */}
      {REFLECTIONS.map(([y, dx, half], i) => (
        <motion.line key={i} x1={SUN.cx + dx - half} x2={SUN.cx + dx + half} y1={y} y2={y} stroke="var(--primary)" strokeOpacity={Math.max(0.1, 0.55 - i * 0.03)} strokeWidth="1.4"
          initial={from({ opacity: 0, scaleX: 0.3 })} animate={loop ? { opacity: 1, scaleX: 1, x: [-6, 6] } : { opacity: 1, scaleX: 1, x: 0 }}
          transition={loop ? { opacity: enter(0.8, 1.2 + i * 0.05, speed), scaleX: enter(0.8, 1.2 + i * 0.05, speed), x: ambient(6 + (i % 5), i * 0.37) } : enter(0.8, 1.2 + i * 0.05, speed)} />
      ))}

      {chrome && <>
      {/* Headline: line by line from below a mask; the third line is gold. */}
      {LINES.map((line, i) => (
        <g key={line} clipPath={`url(#${uid}-l${i})`}>
          <motion.text x={TEXT.headline.x} y={TEXT.headline.baselines[i]} fill={i === 2 ? "var(--primary)" : "var(--ink)"} {...lineReveal(i)}
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: TEXT.headline.size, letterSpacing: "-0.012em" }}>{line}</motion.text>
        </g>
      ))}
      <motion.path d={`M${TEXT.shortRule.x1} ${TEXT.shortRule.y}H${TEXT.shortRule.x2}`} stroke="var(--primary)" strokeWidth="1.6" initial={from({ pathLength: 0 })} animate={{ pathLength: 1 }} transition={enter(0.7, 2.3, speed)} />
      <motion.text x={TEXT.meta.x} y={TEXT.meta.y} fill="var(--ink-muted)" textLength={347} lengthAdjust="spacing" xmlSpace="preserve" initial={from({ opacity: 0, y: 6 })} animate={{ opacity: 1, y: 0 }} transition={enter(0.6, 2.5, speed)}
        style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase" }}>TIGERIS AI OS   ·   Riyadh   ·   DIFC   ·   Miami</motion.text>

      </>}
      {chrome && <SceneChrome n="06" section={["Private Institutional Briefing", "Sovereign Alignment"]} pill={TEXT.pill.label} fig="Fig. 06 — The briefing table" entry={entry} speed={speed} sectionRuleFrom={TEXT.section.ruleFrom} />}
    </svg>
  );
}
