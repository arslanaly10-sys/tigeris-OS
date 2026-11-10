"use client";
import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { BASELINES, DEFAULT_SHOCK, OUTLOOK_DEFAULT, TRANSMISSION_VERSION, TX_NODES, normaliseOutlook, simulate, type ShockParams, type SimNode } from "@tigeris/shared";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { DataLabel } from "./data-label";
import { ShockScene, ILLUSTRATIVE_SHOCK } from "./scenes/ShockScene";

/**
 * Shock simulator (brief v3 §5, module 4): Hormuz only in phase 1. Parameters → transmission graph → three orders of
 * effect, the real-time impact panel, the scenario outlook and the re-derived sleeves. Everything is MODELLED by the
 * deterministic engine in @tigeris/shared and shows its inputs; the coefficients are placeholders until sourced.
 */
export const fmt = (n: SimNode | { unit: string; value: number }) => {
  const s = n.value > 0 ? "+" : "";
  return n.unit === "%" ? `${s}${n.value.toFixed(1)}%` : n.unit === "pp" ? `${s}${n.value.toFixed(2)} pp` : n.unit === "days" ? `${s}${n.value.toFixed(1)} d` : `${n.value.toFixed(0)}/100`;
};

const PARAMS: Array<{ key: keyof ShockParams; label: string; min: number; max: number; step: number; unit: string }> = [
  { key: "durationDays", label: "Duration", min: 7, max: 150, step: 1, unit: "days" },
  { key: "throughputChangePct", label: "Tanker throughput change", min: -80, max: 0, step: 1, unit: "%" },
  { key: "warRiskChangePct", label: "War-risk premium change", min: 0, max: 500, step: 10, unit: "%" },
  { key: "brentMovePct", label: "Brent move", min: -20, max: 60, step: 0.1, unit: "%" },
];

export function SimulatorModule() {
  const [p, setP] = useState<ShockParams>(DEFAULT_SHOCK);
  const [shockKey, setShockKey] = useState(0);
  const [outlook, setOutlook] = useState(OUTLOOK_DEFAULT);
  const [focus, setFocus] = useState<string>("fiscal");
  const run = useMemo(() => simulate(p), [p]);
  const outl = normaliseOutlook(outlook);
  const pos = new Map(ILLUSTRATIVE_SHOCK.nodes.map((n) => [n.id, n] as const));
  const nodes = run.nodes.map((n) => ({ ...pos.get(n.id)!, value: fmt(n) }));
  const f = run.nodes.find((n) => n.id === focus)!;
  const label = (id: string) => TX_NODES.find((n) => n.id === id)?.label ?? id;

  return (
    <>
      <PageHeader nav="nav.simulator" description="One shock, three orders of effect. Move a parameter and every dependent figure recomputes from the transmission graph; select any effect to see exactly how it was derived." />
      <div className="grid gap-5">
        <Panel>
          <PanelHeader eyebrow="Simulate · parameters" title="Strait of Hormuz disruption" actions={<><DataLabel kind="MODELLED" /><span className="sys text-ink-faint">{TRANSMISSION_VERSION} · {run.ms} ms</span></>} />
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {PARAMS.map((x) => (
              <label key={x.key} className="grid gap-1 text-[13px]"><span className="flex justify-between"><span className="text-ink-muted">{x.label}</span><span className="tabular font-medium">{p[x.key]} {x.unit}</span></span>
                <input type="range" min={x.min} max={x.max} step={x.step} value={p[x.key]} onChange={(e) => setP({ ...p, [x.key]: Number(e.target.value) })} /></label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-[13px]">
            <Button size="sm" variant="primary" onClick={() => setShockKey((k) => k + 1)}><Zap />Fire the shock</Button>
            <Button size="sm" variant="ghost" onClick={() => setP(DEFAULT_SHOCK)}>Reset to the sandbox narrative</Button>
            <span className="text-ink-faint">Defaults follow the client sandbox: throughput −18%, war-risk +250%, Brent +8.4%. They are scenario inputs, not live data.</span>
          </div>
        </Panel>

        <Panel className="overflow-hidden"><ShockScene shockKey={shockKey} durationDays={p.durationDays} nodes={nodes} edges={ILLUSTRATIVE_SHOCK.edges} label="Modelled" className="block h-auto w-full" /></Panel>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel>
            <PanelHeader eyebrow="Real-time impact (Kingdom)" title="Impact panel" actions={<DataLabel kind="MODELLED" />} />
            <dl className="grid gap-3 p-4">
              {[["Brent crude", `$${run.impact.brentUsd.toFixed(1)} / bbl`, `baseline $${BASELINES.brentUsd} (placeholder)`], ["Shipping war-risk premium", `${run.impact.warRiskPct > 0 ? "+" : ""}${run.impact.warRiskPct}%`, "scenario input"],
                ["Tanker throughput", `${run.impact.throughputPct}%`, "scenario input"], ["Inflation risk, 90 days", `${run.impact.inflation90dPp > 0 ? "+" : ""}${run.impact.inflation90dPp.toFixed(2)} pp`, "modelled"],
                ["Buffer days, critical categories", `${run.impact.bufferDays.toFixed(0)} days`, `baseline ${BASELINES.bufferDays} days (placeholder)`]].map(([k, v, s]) => (
                <div key={k} className="border-s-2 border-primary ps-3"><dt className="eyebrow">{k}</dt><dd className="tabular font-serif text-[26px] font-bold leading-tight">{v}</dd><dd className="text-[12.5px] text-ink-faint">{s}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Scenario outlook" title="Weights you can edit; shown summing to 100%" actions={<DataLabel kind="ILLUSTRATIVE" />} />
            <ul className="grid gap-2 p-4 text-[13px]">
              {outl.map((o, i) => (
                <li key={o.key} className="grid grid-cols-[1fr_110px_44px] items-center gap-3"><span>{o.label}</span>
                  <input type="range" min={0} max={100} value={outlook[i]!.weight} aria-label={`${o.label} weight`} onChange={(e) => setOutlook(outlook.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} />
                  <span className="tabular text-end font-medium">{o.pct}%</span></li>
              ))}
            </ul>
            <p className="px-4 pb-4 text-[12.5px] text-ink-faint">Probabilities are a committee's judgement, entered here; the client sandbox's own figures summed to 83%.</p>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Allocation re-derivation" title="Illustrative mandate sleeves" actions={<DataLabel kind="MODELLED" />} />
            <ul className="grid gap-3 p-4 text-[13px]">
              {(["balanced", "resilience", "liquidity", "localization"] as const).map((k) => (
                <li key={k} className="grid gap-1"><span className="flex justify-between capitalize"><span>{k}</span><span className="tabular">{run.sleeves.before[k]}% → <b>{run.sleeves.after[k].toFixed(1)}%</b></span></span>
                  <span className="relative h-2 bg-surface-2"><span className="absolute inset-y-0 start-0 bg-[var(--gold-soft)]" style={{ width: `${run.sleeves.before[k]}%` }} /><span className="absolute inset-y-0 start-0 h-1 bg-primary" style={{ width: `${run.sleeves.after[k]}%` }} /></span></li>
              ))}
            </ul>
            <p className="px-4 pb-4 text-[12.5px] text-ink-faint">Rule: move the modelled reallocation ({run.sleeves.shiftPct}% of the mandate) out of balanced, 40% each to resilience and liquidity, 20% to localization.</p>
          </Panel>
        </div>

        <Panel>
          <PanelHeader eyebrow="Provenance" title="How each effect was derived" />
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ul className="grid gap-1 text-[13px]">{run.nodes.map((n) => (
              <li key={n.id}><button type="button" onClick={() => setFocus(n.id)} aria-pressed={focus === n.id} className={`flex w-full items-center justify-between border px-3 py-1.5 text-start ${focus === n.id ? "border-primary bg-primary-soft" : "border-line"}`}>
                <span><Badge className="me-2">{n.order === 1 ? "1st" : n.order === 2 ? "2nd" : "3rd"}</Badge>{n.label}</span><span className="tabular">{fmt(n)}</span></button></li>
            ))}</ul>
            <div className="grid content-start gap-2 text-[13px]">
              <h3 className="font-serif text-[18px] font-semibold">{f.label}: <span className="tabular">{fmt(f)}</span></h3>
              <p className="text-ink-muted">{f.note}.</p>
              {f.contributions.length === 0 ? <p>A scenario parameter, set above.</p> : (
                <table className="w-full"><thead><tr className="border-b border-line text-ink-faint">{["From", "Coefficient", "Parent", "Lag factor", "Contribution", "Status"].map((h) => <th key={h} className="py-1 text-start font-medium">{h}</th>)}</tr></thead>
                  <tbody>{f.contributions.map((c) => (
                    <tr key={c.from} className="border-b border-line/60"><td className="py-1">{label(c.from)}</td><td className="tabular">{c.coef}</td><td className="tabular">{c.parent.toFixed(2)}</td><td className="tabular">{c.lagFactor}</td><td className="tabular">{c.value.toFixed(2)}</td><td><Badge tone="warn">{c.assumptionStatus}</Badge></td></tr>
                  ))}</tbody></table>
              )}
              {f.unit === "priority" && <p className="text-ink-faint">Opportunity priorities are clamped to 0–100.</p>}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
