"use client";
import { useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { BriefingScene } from "@/components/scenes/BriefingScene";
import { HorizonScene } from "@/components/scenes/HorizonScene";
import { OperatingLoopScene, LOOP_STEPS } from "@/components/scenes/OperatingLoopScene";
import { CoordinationScene } from "@/components/scenes/CoordinationScene";
import { LayersScene } from "@/components/scenes/LayersScene";
import { ShockScene } from "@/components/scenes/ShockScene";
import { DiagnosisScene } from "@/components/scenes/DiagnosisScene";
import { MemoryScene } from "@/components/scenes/MemoryScene";
import { GlobalGraphScene } from "@/components/scenes/GlobalGraphScene";
import { KernelScene } from "@/components/scenes/KernelScene";
import { ScenePauseContext, type SceneMode, type SceneProps } from "@/components/scenes/primitives";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Scene gallery (docs/MOTION_SCENES.md §6): every live scene with replay, mode, speed, simulated reduced motion, a
 * global pause, each scene's own toggles, and a 50% overlay of its reference plate where we have the plate file.
 */
type Toggles = { resolved: boolean; showAfter: boolean; shockKey: number; step: number; pulse: number; unified: boolean; autoplay: boolean; disruptionDays: number };
const SCENES: Array<{ n: string; name: string; plate: string | null; render: ((p: SceneProps, t: Toggles) => React.ReactNode) | null }> = [
  { n: "01", name: "Sovereign Horizon", plate: "/brand/plates/01-horizon.webp", render: (p) => <HorizonScene {...p} /> },
  { n: "02", name: "Operating Loop", plate: "/brand/plates/02-loop.webp", render: (p, t) => <OperatingLoopScene {...p} activeStep={t.step} /> },
  { n: "03", name: "Trade corridor chokepoint", plate: null, render: null },
  { n: "04", name: "Coordination debt", plate: "/brand/plates/04-coordination.webp", render: (p, t) => <CoordinationScene {...p} state={t.resolved ? "resolved" : "fragmented"} /> },
  { n: "05", name: "Architecture layers", plate: "/brand/plates/05-layers.webp", render: (p, t) => <LayersScene {...p} pulseOnDecision={t.pulse} /> },
  { n: "06", name: "Briefing", plate: "/brand/plates/06-briefing.webp", render: (p) => <BriefingScene {...p} /> },
  { n: "07", name: "Shock propagation", plate: null, render: (p, t) => <ShockScene {...p} shockKey={t.shockKey} durationDays={t.disruptionDays} /> },
  { n: "08", name: "Gap diagnosis", plate: null, render: (p, t) => <DiagnosisScene {...p} showAfter={t.showAfter} /> },
  { n: "09", name: "Institutional memory", plate: null, render: (p) => <MemoryScene {...p} /> },
  { n: "10", name: "Decision ledger", plate: null, render: null },
  { n: "11", name: "Global sovereign graph", plate: null, render: (p) => <GlobalGraphScene {...p} /> },
  { n: "12", name: "One kernel", plate: null, render: (p, t) => <KernelScene {...p} state={t.unified ? "unified" : "fragmented"} autoplay={t.autoplay} /> },
  { n: "13", name: "Strategic use cases", plate: null, render: null },
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
  const [tg, setTg] = useState<Toggles>({ resolved: true, showAfter: true, shockKey: 0, step: 7, pulse: 0, unified: true, autoplay: false, disruptionDays: 30 });
  const s = SCENES.find((x) => x.n === active)!;
  const set = (p: Partial<Toggles>) => setTg((t) => ({ ...t, ...p }));

  return (
    <ScenePauseContext.Provider value={paused}>
      <div className="min-h-full">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <Wordmark />
          <span className="eyebrow">Live motion scenes · gallery</span>
        </header>
        <main className="grid gap-5 px-6 py-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Scenes" className="grid content-start gap-1">
            {SCENES.map((x) => (
              <button key={x.n} type="button" onClick={() => { setActive(x.n); setCompare(false); setPlayKey((k) => k + 1); }} aria-current={x.n === active}
                className={`flex items-center justify-between gap-2 border px-3 py-2 text-start text-[14px] ${x.n === active ? "border-primary bg-primary-soft" : "border-line"}`}>
                <span><span className="eyebrow me-2 tabular">{x.n}</span>{x.name}</span>
                {!x.render && <Badge>needs plate</Badge>}
              </button>
            ))}
          </nav>
          <section className="grid content-start gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2 text-[13px]" aria-label="Scene controls">
              {active === "02" && <label className="flex items-center gap-2">Active step <input type="range" min={1} max={12} value={tg.step} onChange={(e) => set({ step: Number(e.target.value) })} /><span className="tabular">{tg.step} · {LOOP_STEPS[tg.step - 1]}</span></label>}
              {active === "04" && <Button size="sm" variant="ghost" onClick={() => set({ resolved: !tg.resolved })}>{tg.resolved ? "Show fragmented" : "Resolve"}</Button>}
              {active === "05" && <Button size="sm" variant="ghost" onClick={() => set({ pulse: tg.pulse + 1 })}>Approve a decision (pulse)</Button>}
              {active === "07" && <><Button size="sm" variant="ghost" onClick={() => set({ shockKey: tg.shockKey + 1 })}>Fire the shock again</Button>
                <label className="flex items-center gap-2">Duration <input type="range" min={7} max={90} value={tg.disruptionDays} onChange={(e) => set({ disruptionDays: Number(e.target.value) })} /><span className="tabular">{tg.disruptionDays} days</span></label></>}
              {active === "08" && <Button size="sm" variant="ghost" onClick={() => set({ showAfter: !tg.showAfter })}>{tg.showAfter ? "Hide after TIGERIS" : "Show after TIGERIS"}</Button>}
              {active === "12" && <><Button size="sm" variant="ghost" onClick={() => set({ unified: !tg.unified })}>{tg.unified ? "Show fragmented" : "Unify"}</Button>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={tg.autoplay} onChange={(e) => set({ autoplay: e.target.checked })} />Autoplay (investor screen)</label></>}
              {!["02", "04", "05", "07", "08", "12"].includes(active) && <span className="text-ink-faint">No scene-specific controls.</span>}
            </div>
            <div className="relative overflow-hidden border border-line">
              {s.render ? s.render({ mode, playKey, speed, forceReducedMotion: reduced, className: "block h-auto w-full", onEvent: (e) => setEvents((l) => [`${new Date().toLocaleTimeString()} · ${e.type}`, ...l].slice(0, 4)) }, tg) : (
                <p className="p-10 text-center text-ink-muted">Scene {s.n} waits for its reference plate and plate source, so it is not invented here.</p>
              )}
              {compare && s.render && s.plate && (
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
