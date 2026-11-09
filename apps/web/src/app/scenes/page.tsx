"use client";
import { useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { BriefingScene } from "@/components/scenes/BriefingScene";
import { ScenePauseContext, type SceneMode, type SceneProps } from "@/components/scenes/primitives";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Scene gallery (docs/MOTION_SCENES.md §6). Each live scene with replay, mode, speed, simulated reduced motion, a
 * global pause, and a compare overlay of its reference plate at 50% to check the final frame lines up.
 */
const SCENES: Array<{ n: string; name: string; plate: string | null; C: ((p: SceneProps) => React.ReactNode) | null }> = [
  { n: "06", name: "Briefing", plate: "/brand/plates/06-briefing.webp", C: BriefingScene },
  { n: "01", name: "Sovereign Horizon", plate: "/brand/plates/01-horizon.webp", C: null },
  { n: "02", name: "Operating Loop", plate: "/brand/plates/02-loop.webp", C: null },
  { n: "04", name: "Coordination debt, resolved", plate: "/brand/plates/04-coordination.webp", C: null },
  { n: "05", name: "Architecture layers", plate: "/brand/plates/05-layers.webp", C: null },
];

export default function ScenesPage() {
  const [active, setActive] = useState("06");
  const [playKey, setPlayKey] = useState(0);
  const [mode, setMode] = useState<SceneMode>("entry");
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [compare, setCompare] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const s = SCENES.find((x) => x.n === active)!;

  return (
    <ScenePauseContext.Provider value={paused}>
      <div className="min-h-full">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <Wordmark />
          <span className="eyebrow">Live motion scenes · gallery</span>
        </header>
        <main className="grid gap-5 px-6 py-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Scenes" className="grid content-start gap-1">
            {SCENES.map((x) => (
              <button key={x.n} type="button" onClick={() => { setActive(x.n); setPlayKey((k) => k + 1); }} aria-current={x.n === active}
                className={`flex items-center justify-between gap-2 border px-3 py-2 text-start text-[14px] ${x.n === active ? "border-primary bg-primary-soft" : "border-line"}`}>
                <span><span className="eyebrow me-2 tabular">{x.n}</span>{x.name}</span>
                {!x.C && <Badge>to build</Badge>}
              </button>
            ))}
          </nav>
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Button size="sm" variant="ghost" onClick={() => { setMode("entry"); setPlayKey((k) => k + 1); }}><RotateCcw />Replay entry</Button>
              <label className="flex items-center gap-1.5">Mode
                <select value={mode} onChange={(e) => { setMode(e.target.value as SceneMode); setPlayKey((k) => k + 1); }} className="h-8 border border-line bg-surface px-2">
                  <option value="entry">entry</option><option value="ambient">ambient</option><option value="static">static</option>
                </select></label>
              <label className="flex items-center gap-1.5">Speed
                <input type="range" min={0.25} max={2} step={0.25} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
                <span className="tabular w-10">{speed}×</span></label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={reduced} onChange={(e) => { setReduced(e.target.checked); setPlayKey((k) => k + 1); }} />Reduced motion</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} disabled={!s.plate} />Compare with plate</label>
              <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? <Play /> : <Pause />}{paused ? "Resume motion" : "Pause motion"}</Button>
            </div>
            <div className="relative overflow-hidden border border-line">
              {s.C ? <s.C mode={mode} playKey={playKey} speed={speed} forceReducedMotion={reduced} className="block h-auto w-full"
                onEvent={(e) => setEvents((l) => [`${new Date().toLocaleTimeString()} · ${e.type}`, ...l].slice(0, 4))} /> : (
                // eslint-disable-next-line @next/next/no-img-element
                s.plate && <img src={s.plate} alt={`Reference plate ${s.n}: ${s.name} (scene not built yet)`} className="block w-full opacity-60" />
              )}
              {compare && s.C && s.plate && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.plate} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-multiply" />
              )}
            </div>
            <p className="fig-caption">Fig. {s.n} — {s.name} · events: {events.join("  ·  ") || "none yet"}</p>
          </section>
        </main>
      </div>
    </ScenePauseContext.Provider>
  );
}
