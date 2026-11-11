"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DEFAULT_SHOCK, simulate, type Diagnosis, type Valuation } from "@tigeris/shared";
import { api } from "@/lib/api";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { DataLabel } from "./data-label";
import { OperatingLoopScene } from "./scenes/OperatingLoopScene";
import { CoordinationScene } from "./scenes/CoordinationScene";
import { usd } from "./gap-report-ui";
import { fmt } from "./simulator-ui";

/**
 * Boardroom command surface (brief v3 §7 module 12). Every metric is computed: from Fund A's engagement through the
 * diagnosis and value engines, and from the shock simulator. Each card states its formula and carries its label.
 * The coordination network shows "resolved" only when the computed coordination debt falls below 50.
 */
interface Loaded { engagement: { id: string; title: string; data_mode: string }; diagnosis: Diagnosis; value: Valuation; inputs: Array<{ metric_id: string; value: number | null }> }
type Lens = "opportunity" | "friction" | "value";

export function BoardroomModule() {
  const [d, setD] = useState<Loaded | null>(null);
  const [lens, setLens] = useState<Lens>("friction");
  const reduce = useReducedMotion();
  useEffect(() => { api<{ engagements: Array<{ id: string }> }>("/engagements").then(async (r) => { if (r.ok && r.data.engagements[0]) { const e = await api<Loaded>(`/engagements/${r.data.engagements[0].id}`); if (e.ok) setD(e.data); } }); }, []);
  const sim = useMemo(() => simulate(DEFAULT_SHOCK), []);
  if (!d) return <><PageHeader nav="nav.boardroom" description="" /><div className="h-60 animate-pulse bg-surface-2" /></>;
  const g = (id: number) => d.diagnosis.gaps.find((x) => x.id === id)?.score ?? null;
  const mean = (xs: Array<number | null>) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const input = (k: string) => d.inputs.find((x) => x.metric_id === k)?.value ?? null;
  const readiness = mean([g(2), g(5), g(7)]), governance = g(3);
  const coord = d.diagnosis.indices.coordinationDebt;
  const cards: Array<{ k: string; v: string; formula: string; better: string }> = [
    { k: "CSAI", v: d.diagnosis.indices.csai?.toFixed(1) ?? "—", formula: "100 − weighted mean of the eight gaps", better: "higher is better" },
    { k: "Value at stake", v: usd(d.value.valueAtStakeUsd.base), formula: `base case; range ${usd(d.value.valueAtStakeUsd.low)}–${usd(d.value.valueAtStakeUsd.high)}`, better: "percentage points of the mandate" },
    { k: "Capability readiness", v: readiness === null ? "—" : `${(100 - readiness).toFixed(0)}%`, formula: "100 − mean of fragmentation, capital orchestration and sovereignty gaps", better: "higher is better" },
    { k: "Governance confidence", v: governance === null ? "—" : `${(100 - governance).toFixed(0)}%`, formula: "100 − governance velocity gap", better: "higher is better" },
    { k: "Cognitive debt", v: d.diagnosis.indices.cognitiveDebt?.toFixed(1) ?? "—", formula: "mean of governance velocity, memory and drift gaps", better: "lower is better" },
    { k: "Coordination debt", v: coord?.toFixed(1) ?? "—", formula: "coordination gap score", better: "lower is better" },
    { k: "Time to governed action", v: input("time_to_governed_action_days") === null ? "—" : `${input("time_to_governed_action_days")} days`, formula: "rubric input", better: "lower is better" },
  ];
  const ticker = [
    `Hormuz · tanker throughput ${DEFAULT_SHOCK.throughputChangePct}% · scenario input`,
    `Brent ${fmt(sim.nodes.find((n) => n.id === "brent")!)} · $${sim.impact.brentUsd.toFixed(1)}/bbl · modelled`,
    `Freight cost ${fmt(sim.nodes.find((n) => n.id === "freight")!)} · modelled`,
    `Buffer days ${sim.impact.bufferDays.toFixed(0)} · modelled`,
    `Coordination debt ${coord?.toFixed(1)} · ${coord !== null && coord < 50 ? "owner assigned" : "no owner assigned"}`,
    `Sleeve reallocation ${sim.sleeves.shiftPct}% of mandate · modelled`,
  ];
  const lensRows = lens === "opportunity" ? sim.nodes.filter((n) => n.order === 3).map((n) => [n.label, fmt(n)])
    : lens === "friction" ? [...d.diagnosis.gaps].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map((x) => [x.name, x.score?.toFixed(1) ?? "—"])
    : d.value.perGap.slice().sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 5).map((x) => [x.name, usd(x.valueUsd)]);

  return (
    <>
      <PageHeader nav="nav.boardroom" description="One screen for the board: the composite indices, value at stake and the state of the Hormuz response, all computed, each with its formula and label." />
      <div className="grid gap-4">
        {/* Ticker */}
        <div className="overflow-hidden border-y border-line py-2" aria-label="Signal ticker">
          <motion.div className="eyebrow flex w-max gap-10 whitespace-nowrap" animate={reduce ? undefined : { x: ["0%", "-50%"] }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}>
            {[...ticker, ...ticker].map((t, i) => <span key={i}>{t}</span>)}
          </motion.div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="sys text-ink-muted">{d.engagement.title}</span>{d.engagement.data_mode === "synthetic" && <DataLabel kind="SYNTHETIC" />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Panel key={c.k} className="grid content-start gap-1 p-4">
              <span className="eyebrow">{c.k}</span>
              <span className="tabular font-serif text-[28px] font-bold leading-none">{c.v}</span>
              <span className="text-[12.5px] text-ink-muted">{c.formula} · {c.better}</span>
              <span><DataLabel kind="MODELLED" /></span>
            </Panel>
          ))}
          <Panel className="grid content-start gap-2 p-4">
            <span className="eyebrow">Lens</span>
            <div role="radiogroup" aria-label="Lens" className="flex flex-wrap gap-1">
              {(["opportunity", "friction", "value"] as Lens[]).map((l) => <button key={l} role="radio" aria-checked={lens === l} onClick={() => setLens(l)} className={`border px-2.5 py-1 text-[13px] capitalize ${lens === l ? "border-primary bg-primary-soft" : "border-line"}`}>{l}</button>)}
            </div>
            <ul className="grid gap-1 text-[13px]">{lensRows.map(([a, b]) => <li key={a} className="flex justify-between gap-2"><span>{a}</span><span className="tabular">{b}</span></li>)}</ul>
          </Panel>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel className="overflow-hidden"><PanelHeader eyebrow="Operating loop" title="Where the institution is now" /><OperatingLoopScene activeStep={coord !== null && coord < 50 ? 8 : 7} chrome={false} className="block h-auto w-full" /></Panel>
          <Panel className="overflow-hidden"><PanelHeader eyebrow="L3 orchestration" title={coord !== null && coord < 50 ? "Coordination debt, resolved" : "Coordination debt, rising: no owner assigned"} actions={<DataLabel kind="MODELLED" />} />
            <CoordinationScene state={coord !== null && coord < 50 ? "resolved" : "fragmented"} chrome={false} className="block h-auto w-full" /></Panel>
        </div>
      </div>
    </>
  );
}
