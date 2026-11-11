"use client";
/**
 * Live movement over the Command Centre map illustrations: ships under way along the sea lanes with a wake,
 * cargo flowing along land and air routes, chokepoints and terminals pulsing. Positions are traced in each
 * picture's own pixel space and drawn with preserveAspectRatio "slice", which matches the image's object-fit: cover.
 * Illustrative only, like the pictures under it (no data, no positions): the map card stays labelled as such.
 * Runs on Motion's frame loop only while the map is on screen; reduced motion shows the overlay still.
 */
import { useRef } from "react";
import { useAnimationFrame, useInView, useReducedMotion } from "motion/react";

type Glyph = "ship" | "tanker" | "plane" | "cargo";
interface Lane { d: string; glyph: Glyph; secs: number; count?: number; offset?: number; color?: string }
interface Pulse { x: number; y: number; r?: number; color?: string; delay?: number }
interface Overlay { w: number; h: number; lanes: Lane[]; flows?: Array<{ d: string; color: string; dash?: string }>; pulses?: Pulse[] }

const OVERLAYS: Record<string, Overlay> = {
  "/command/energy-map.webp": {
    w: 536, h: 219,
    lanes: [
      { d: "M318 68 C360 70 410 64 470 76 S530 92 560 96", glyph: "tanker", secs: 26, count: 2 },
      { d: "M352 150 C390 160 430 178 470 192 S520 212 560 222", glyph: "tanker", secs: 30, count: 2, offset: 0.4 },
      { d: "M560 40 C500 44 450 52 400 62 S340 70 318 68", glyph: "ship", secs: 34, offset: 0.2 },
      { d: "M560 130 C520 128 470 118 420 112 S372 108 352 112", glyph: "ship", secs: 38, offset: 0.65 },
    ],
    flows: [
      { d: "M0 40 C40 44 80 52 120 60 S190 72 230 70 S280 64 300 66", color: "#b68a3f", dash: "3 6" },
      { d: "M140 112 C180 120 220 140 260 156 S310 160 340 152", color: "#b68a3f", dash: "3 6" },
    ],
    pulses: [{ x: 300, y: 66, r: 7, color: "#b68a3f" }, { x: 340, y: 150, r: 7, color: "#b68a3f", delay: 1.2 }, { x: 196, y: 82, r: 6, color: "#1f4b3b", delay: 0.6 }],
  },
  "/command/energy-route.webp": {
    w: 331, h: 125,
    lanes: [
      { d: "M236 44 C252 56 254 76 236 86 S196 92 176 90 C150 98 128 108 106 112 C88 96 70 72 52 48 C44 34 38 22 32 10", glyph: "tanker", secs: 24, count: 2 },
      { d: "M176 90 C210 84 250 78 300 72 S330 70 340 70", glyph: "tanker", secs: 18, offset: 0.5 },
    ],
    flows: [{ d: "M236 44 C252 56 254 76 236 86 S196 92 176 90", color: "#1f4b3b", dash: "2 4" }],
    pulses: [{ x: 52, y: 48, r: 6, color: "#9a3328" }, { x: 106, y: 112, r: 6, color: "#9a3328", delay: 0.8 }, { x: 176, y: 90, r: 6, color: "#9a3328", delay: 1.6 }],
  },
  "/command/supply-map.webp": {
    w: 717, h: 321,
    lanes: [
      { d: "M40 40 C80 62 120 92 140 130 S160 200 140 250 S120 300 110 330", glyph: "tanker", secs: 32, count: 2 },
      { d: "M500 205 C540 222 580 236 620 248 S690 262 730 268", glyph: "ship", secs: 24, offset: 0.3 },
      { d: "M730 150 C680 160 630 168 590 178 S540 190 510 196", glyph: "ship", secs: 28, offset: 0.6 },
      { d: "M360 18 C400 22 440 30 470 40 S520 60 540 70", glyph: "ship", secs: 26, offset: 0.1 },
      { d: "M560 12 C480 30 400 52 330 80 S200 130 120 170", glyph: "plane", secs: 16 },
      { d: "M148 76 C190 66 230 60 256 60 S300 80 316 98 S380 120 402 126 S470 150 505 166", glyph: "cargo", secs: 14, count: 3 },
    ],
    flows: [
      { d: "M148 76 C190 66 230 60 256 60 S300 80 316 98 S380 120 402 126 S470 150 505 166", color: "#3f9a5e", dash: "4 6" },
      { d: "M200 66 C220 120 250 170 278 208", color: "#3f9a5e", dash: "4 6" },
    ],
    pulses: [{ x: 148, y: 76, r: 7, color: "#e3c06a" }, { x: 316, y: 98, r: 7, color: "#e3c06a", delay: 0.7 }, { x: 402, y: 126, r: 7, color: "#e3c06a", delay: 1.4 }, { x: 505, y: 166, r: 7, color: "#e3c06a", delay: 2.1 }, { x: 278, y: 208, r: 7, color: "#e3c06a", delay: 2.8 }],
  },
};

export const hasMapMotion = (img: string) => img in OVERLAYS;

function GlyphShape({ g }: { g: Glyph }) {
  // Drawn pointing along +x; the mover rotates it to the lane's heading.
  if (g === "plane") return <g><path d="M7 0 L-5 -1.2 L-7 -6 L-8.5 -6 L-7.2 -1 L-9 -0.6 L-10 -2.4 L-11 -2.4 L-10.4 0 L-11 2.4 L-10 2.4 L-9 0.6 L-7.2 1 L-8.5 6 L-7 6 L-5 1.2 Z" fill="#fffdf8" stroke="#3a4a42" strokeWidth=".6" /></g>;
  if (g === "cargo") return <g><circle r="3.4" fill="#e3c06a" opacity=".35" /><circle r="2" fill="#fffbe8" stroke="#b68a3f" strokeWidth=".8" /></g>;
  const len = g === "tanker" ? 9 : 7;
  return (
    <g>
      {/* wake */}
      <path d={`M${-len} 0 L${-len - 16} -3.2 M${-len} 0 L${-len - 16} 3.2`} stroke="#ffffff" strokeOpacity=".75" strokeWidth=".9" strokeLinecap="round" />
      <path d={`M${-len} -2.2 L${len - 2.6} -2.2 L${len} 0 L${len - 2.6} 2.2 L${-len} 2.2 Z`} fill={g === "tanker" ? "#7a3a2c" : "#2f4f63"} stroke="#fffdf8" strokeWidth=".5" />
      <rect x={-len + 1} y="-1.2" width="2.2" height="2.4" fill="#fffdf8" />
    </g>
  );
}

function Mover({ lane, run }: { lane: Lane; run: boolean }) {
  const path = useRef<SVGPathElement>(null);
  const items = useRef<Array<SVGGElement | null>>([]);
  const n = lane.count ?? 1;
  useAnimationFrame((t) => {
    const p = path.current;
    if (!run || !p) return;
    const L = p.getTotalLength();
    for (let i = 0; i < n; i++) {
      const el = items.current[i];
      if (!el) continue;
      const f = ((t / 1000) / lane.secs + (lane.offset ?? 0) + i / n) % 1;
      const s = f * L, a = p.getPointAtLength(s), b = p.getPointAtLength(Math.min(L, s + 1.5));
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      el.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${ang})`);
      el.style.opacity = String(Math.min(1, f * 12, (1 - f) * 12)); // fade in and out at the ends of the lane
    }
  });
  return (
    <g>
      <path ref={path} d={lane.d} fill="none" stroke="none" />
      {Array.from({ length: n }, (_, i) => <g key={i} ref={(el) => { items.current[i] = el; }} transform="translate(-99 -99)"><GlyphShape g={lane.glyph} /></g>)}
    </g>
  );
}

export function MapMotion({ img }: { img: string }) {
  const o = OVERLAYS[img];
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { amount: 0.1 });
  const reduce = useReducedMotion();
  if (!o) return null;
  const run = inView && !reduce;
  return (
    <svg ref={ref} viewBox={`0 0 ${o.w} ${o.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="cc-map-motion">
      {o.flows?.map((f, i) => <path key={i} d={f.d} fill="none" stroke={f.color} strokeWidth="1.6" strokeDasharray={f.dash} strokeLinecap="round" className={run ? "cc-flow" : undefined} opacity=".85" />)}
      {o.pulses?.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          {run && <circle r={p.r ?? 6} fill="none" stroke={p.color} strokeWidth="1.4" className="cc-ping" style={{ animationDelay: `${p.delay ?? 0}s` }} />}
          <circle r="2.2" fill={p.color} />
        </g>
      ))}
      {o.lanes.map((l, i) => <Mover key={i} lane={l} run={run} />)}
    </svg>
  );
}
