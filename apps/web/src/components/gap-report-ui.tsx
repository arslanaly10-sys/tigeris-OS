"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { KPI_DEFS, RUBRIC, VALUATION_DEFAULTS, diagnose, valuation, type Diagnosis, type Valuation } from "@tigeris/shared";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { DataLabel } from "./data-label";
import { DiagnosisScene } from "./scenes/DiagnosisScene";

/**
 * Gap Report (brief v3 §3–§5, module 5): the 8-gap diagnosis, composite indices, value at stake with editable
 * assumptions, and before/after KPIs. Every figure is computed by the shared engine from stored inputs and
 * assumptions (MODELLED, with its inputs shown); Fund A's inputs are SYNTHETIC. Workshop mode edits inputs live,
 * and each edit is written to the Ledger.
 */
interface Row { metric_id: string; value: number | null; source: string; label: string; updated_by_label: string; updated_at: string }
interface Assn { key: string; value: number; source: string; benchmark_status: string; updated_by_label: string }
interface Loaded { engagement: { id: string; title: string; status: string; data_mode: string; rubric_version: string; created_at: string; intake: { organisation: string; challenge: string } }; inputs: Row[]; assumptions: Assn[]; diagnosis: Diagnosis; value: Valuation; kpis: Array<{ key: string; label: string; unit: string; target: number; better: string; current: number | null }> }

export const usd = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B` : `$${(v / 1e6).toFixed(0)}M`);
const num = (v: number | null, d = 1) => (v === null ? "—" : v.toFixed(d));

export function GapReportModule() {
  const can = useCan();
  const [list, setList] = useState<Array<{ id: string; title: string; data_mode: string }> | null>(null);
  const params = useSearchParams();
  const [id, setId] = useState<string | null>(params.get("e"));
  const [d, setD] = useState<Loaded | null>(null);
  const [workshop, setWorkshop] = useState(false);
  const [licence, setLicence] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<{ engagements: Array<{ id: string; title: string; data_mode: string }> }>("/engagements").then((r) => { if (r.ok) { setList(r.data.engagements); setId((x) => x ?? r.data.engagements[0]?.id ?? null); } }); }, []);
  const load = useCallback(() => { if (id) api<Loaded>(`/engagements/${id}`).then((r) => r.ok && setD(r.data)); }, [id]);
  useEffect(() => { load(); }, [load]);

  const values = useMemo(() => Object.fromEntries((d?.inputs ?? []).map((r) => [r.metric_id, r.value])), [d]);
  // "After TIGERIS": the same engine on the inputs with the KPI targets applied (modelled, not promised).
  const after = useMemo(() => diagnose({ ...values, ...Object.fromEntries(KPI_DEFS.map((k) => [k.key, k.target])) }), [values]);
  const roi = useMemo(() => {
    if (!d) return null;
    const a = (k: string) => Number(d.assumptions.find((x) => x.key === k)?.value);
    const l = Number(licence.replace(/[^0-9.]/g, "")) * 1e6;
    return l > 0 ? valuation({ aumUsd: a("aum_usd"), structuralInefficiency: a("structural_inefficiency"), improvement: { low: a("improvement_low"), base: a("improvement_base"), high: a("improvement_high") }, years: a("years"), licenceUsdPerYear: l }, d.diagnosis).roiMultiple : null;
  }, [d, licence]);

  async function saveInput(metric: string, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return;
    const r = await api(`/engagements/${id}/inputs/${metric}`, { method: "PUT", json: { value, note: "Workshop edit" } });
    setMsg(r.ok ? "Saved and written to the Ledger." : r.message); if (r.ok) load();
  }
  async function saveAssumption(key: string, value: number) {
    const r = await api(`/engagements/${id}/assumptions/${key}`, { method: "PUT", json: { value } });
    if (r.ok) load(); else setMsg(r.message);
  }

  const synthetic = d?.engagement.data_mode === "synthetic";
  const sourceLabel = synthetic ? "SYNTHETIC" : "MODELLED";
  return (
    <>
      <PageHeader nav="nav.gap-report" description="The eight-gap diagnosis with its evidence and confidence, the composite indices, the value at stake as a range with every assumption editable, and before and after TIGERIS. All figures are computed by the engine from the inputs below." />
      {!list ? <div className="h-40 animate-pulse bg-surface-2" /> : !list.length ? (
        <Panel className="p-6 text-ink-muted">No engagement yet. Start one from the <Link className="text-accent underline" href="/briefing">briefing intake</Link>.</Panel>
      ) : !d ? <div className="h-40 animate-pulse bg-surface-2" /> : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <label className="flex items-center gap-2">Engagement
              <select value={id ?? ""} onChange={(e) => setId(e.target.value)} className="h-9 border border-line bg-surface px-2">{list.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
            <DataLabel kind={synthetic ? "SYNTHETIC" : "MODELLED"} />
            <span className="sys text-ink-faint">{d.engagement.rubric_version} · confidence {d.diagnosis.confidence}</span>
            {can("diagnostic.run") && <Button size="sm" variant={workshop ? "primary" : "ghost"} onClick={() => setWorkshop((w) => !w)} aria-pressed={workshop}><Pencil />Workshop mode {workshop ? "on" : "off"}</Button>}
            {msg && <span role="status" className="text-ink-muted">{msg}</span>}
          </div>

          {/* Composite indices */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[["CSAI · Compound Sovereign Advantage", d.diagnosis.indices.csai, "100 minus the weighted mean of all eight gaps", true], ["Coordination debt", d.diagnosis.indices.coordinationDebt, "Gap 1 score", false], ["Cognitive debt", d.diagnosis.indices.cognitiveDebt, "Mean of governance velocity, memory and drift", false]].map(([k, v, sub, good]) => (
              <Panel key={k as string} className="grid gap-1 p-4">
                <span className="eyebrow">{k as string}</span>
                <span className="tabular font-serif text-[28px] font-bold leading-none">{num(v as number | null)}</span>
                <span className="text-[13px] text-ink-muted">{sub as string} · {good ? "higher is better" : "lower is better"}</span>
                <span><DataLabel kind="MODELLED" /></span>
              </Panel>
            ))}
          </div>

          <Panel className="overflow-hidden">
            <DiagnosisScene before={d.diagnosis.gaps.map((g) => g.score ?? 0)} after={after.gaps.map((g) => g.score ?? 0)} showAfter label="Modelled" className="block h-auto w-full" />
          </Panel>

          {/* Gaps and inputs */}
          <Panel>
            <PanelHeader eyebrow="Diagnose · evidence" title="Eight gaps, their metrics and inputs" actions={<DataLabel kind={sourceLabel} />} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-[13px]">
                <thead><tr className="border-b border-line text-ink-faint">{["Gap", "Metric", "Input", "Band [best, worst]", "Normalised", "Source"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
                <tbody>{d.diagnosis.gaps.map((g) => g.metrics.map((m, j) => {
                  const row = d.inputs.find((r) => r.metric_id === m.id)!;
                  return (
                    <tr key={m.id} className="border-b border-line/60 align-top">
                      {j === 0 && <td rowSpan={g.metrics.length} className="px-4 py-2"><span className="eyebrow me-1 tabular">{String(g.id).padStart(2, "0")}</span><span className="font-medium">{g.name}</span>
                        <div className="mt-1 flex items-center gap-2"><span className="tabular text-[20px] font-serif font-bold">{num(g.score)}</span><Badge tone={g.confidence === "high" ? "ok" : g.confidence === "medium" ? "warn" : "crit"}>{g.confidence === "high" ? <CheckCircle2 /> : <AlertTriangle />}{g.confidence} · {g.present}/{g.total}</Badge></div></td>}
                      <td className="px-4 py-2">{m.label}</td>
                      <td className="px-4 py-2">{workshop ? (
                        <input defaultValue={m.value ?? ""} aria-label={`${m.label} (${m.unit})`} inputMode="decimal" onBlur={(e) => e.target.value !== String(m.value ?? "") && saveInput(m.id, e.target.value)} className="h-8 w-24 border border-primary/50 bg-surface px-2 tabular" />
                      ) : <span className={cn("tabular", m.value === null && "text-warn")}>{m.value === null ? "missing (not imputed)" : `${m.value} ${m.unit}`}</span>}</td>
                      <td className="px-4 py-2 tabular text-ink-muted">[{m.best}, {m.worst}] {m.unit} <Badge className="ms-1">{m.benchmarkStatus}</Badge></td>
                      <td className="px-4 py-2 tabular">{num(m.normalised)}</td>
                      <td className="px-4 py-2 text-ink-muted">{row.source} · {row.label}<div className="text-ink-faint">{row.updated_by_label} · {formatDate(row.updated_at, true)}</div></td>
                    </tr>
                  );
                }))}</tbody>
              </table>
            </div>
          </Panel>

          {/* Value at stake */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader eyebrow="Quantify · value at stake" title="Percentage points of the mandate, capped by the ceiling" actions={<DataLabel kind="MODELLED" />} />
              <div className="grid gap-4 p-4">
                <div className="grid grid-cols-3 gap-3">
                  {(["low", "base", "high"] as const).map((k) => (
                    <div key={k} className="border border-line p-3"><div className="eyebrow">{k}</div><div className="tabular font-serif text-[28px] font-bold">{usd(d.value.valueAtStakeUsd[k])}</div>
                      <div className="text-[12.5px] text-ink-muted">{usd(d.value.annualUsd[k])} a year{d.value.cappedByCeiling[k] && " · capped by the ceiling"}</div></div>
                  ))}
                </div>
                <p className="text-[13px] text-ink-muted">Ceiling {usd(d.value.ceilingUsd)} (mandate × structural inefficiency). Value at stake never exceeds it.</p>
                <ul className="grid gap-1.5">{d.value.perGap.map((g) => (
                  <li key={g.id} className="grid grid-cols-[200px_1fr_80px] items-center gap-3 text-[13px]"><span>{g.name}</span>
                    <span className="h-2 bg-surface-2"><span className="block h-2 bg-primary" style={{ width: `${(g.share * 100).toFixed(1)}%` }} /></span><span className="tabular text-end">{usd(g.valueUsd)}</span></li>
                ))}</ul>
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[13px]">
                  <label className="flex items-center gap-2">Licence cost per year (US$ m, entered here only, not stored)<input value={licence} onChange={(e) => setLicence(e.target.value)} inputMode="decimal" className="h-8 w-24 border border-line bg-surface px-2 tabular" /></label>
                  <span className="tabular">{roi === null ? "Enter a licence cost to see the ROI multiple." : `ROI: ${roi.toFixed(1)}× (base value per year ÷ licence)`}</span>
                </div>
              </div>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Assumptions" title="Every one editable, with its source" />
              <ul className="grid gap-3 p-4 text-[13px]">
                {VALUATION_DEFAULTS.map((def) => {
                  const a = d.assumptions.find((x) => x.key === def.key)!;
                  const shown = def.unit === "usd" ? usd(a.value) : def.unit === "share" ? `${(a.value * 100).toFixed(2)}%` : `${a.value} ${def.unit}`;
                  return (
                    <li key={def.key} className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{def.label}</span><span className="tabular ms-auto">{shown}</span>
                        {a.benchmark_status !== "sourced" && <Badge tone="warn"><AlertTriangle />{a.benchmark_status}</Badge>}</div>
                      {workshop && <input type="range" min={def.min} max={def.max} step={def.step} defaultValue={a.value} aria-label={def.label} onMouseUp={(e) => saveAssumption(def.key, Number((e.target as HTMLInputElement).value))} onKeyUp={(e) => saveAssumption(def.key, Number((e.target as HTMLInputElement).value))} />}
                      <span className="text-ink-faint">{a.source}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          {/* Before / after */}
          <Panel>
            <PanelHeader eyebrow="Before and after TIGERIS" title="Outcome KPIs, not adoption metrics" actions={<DataLabel kind="MODELLED" />} />
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-line text-ink-faint">{["KPI", "Current", "Target (assumption)", "Change"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>{d.kpis.map((k) => (
                <tr key={k.key} className="border-b border-line/60"><td className="px-4 py-2">{k.label}</td><td className="px-4 py-2 tabular">{k.current === null ? "missing" : `${k.current} ${k.unit}`}</td>
                  <td className="px-4 py-2 tabular">{k.target} {k.unit}</td><td className="px-4 py-2 tabular">{k.current === null ? "—" : `${k.target - k.current > 0 ? "+" : ""}${(k.target - k.current).toFixed(1)} ${k.unit}`}</td></tr>
              ))}</tbody>
            </table>
            <p className="px-4 py-3 text-[13px] text-ink-faint">The "after" profile in the figure is the same engine run on these inputs with the targets applied. It is a modelled outcome, not a promise. Rubric bands are placeholders until the client CTO signs them off.</p>
          </Panel>
          <p className="text-[13px] text-ink-faint">Rubric: {RUBRIC.length} gaps, {RUBRIC.reduce((n, g) => n + g.metrics.length, 0)} metrics. Engagement opened {formatDate(d.engagement.created_at, true)}.</p>
        </div>
      )}
    </>
  );
}
