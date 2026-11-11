"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Play, Plus, RotateCcw, ShieldAlert, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, num } from "@/lib/format";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Drawer, Field } from "./drawer";
import { ClaimBadge } from "./labels";
import { FactValue } from "./lineage";
import { LineChart, RangeBar, SeriesKey, Tornado } from "./charts";
import { useCan } from "./session-context";
import { cn } from "@/lib/cn";

interface DriverSpec { label: string; unit: string; min: number; max: number }
interface Templates { model_version: string; drivers: Record<string, DriverSpec>; templates: Record<string, { kind: string; route: string | null; drivers: Record<string, number> }> }
interface Result { id: string; key: string; label: string; horizon: string; unit: string; value: number; p10: number | null; p50: number | null; p90: number | null; method: string }
interface Run {
  id: string; group_id: string; variant: "baseline" | "alt1" | "alt2"; name: string; template: string; model_version: string; input_hash: string; monte_carlo_runs: number; duration_ms: number; created_by_label: string; created_at: string;
  derived: { world_consumption_mbd: number; route_flow_mbd: number; usable_bypass_mbd: number; gcc_exports_mbd: number };
  cascade: { day: number; availability_pct: number; net_shortfall_mbd: number; oil_price_usd: number; cumulative_lost_mb: number; reserve_cover_days: number; gross_loss_mbd: number; bypass_mbd: number }[];
  resilience: { score: number; components: { key: string; label: string; score: number; weight: number; basis: string }[] };
  sensitivity: { driver: string; label: string; low: number; high: number }[];
  top_exposures: { holding_key: string; name: string; sector: string; value_usd: number; path_strength: number }[];
  results: Result[]; assumptions: { key: string; label: string; value_num: number; unit: string }[];
}

const HORIZONS = [["72h", "72 hours"], ["90d", "90 days"], ["1y", "1 year"], ["5y", "5 years"]] as const;
const METRIC_ORDER = ["avg_net_shortfall_mbd", "avg_oil_price_usd", "cumulative_lost_mb", "gcc_export_revenue_change_usd", "portfolio_value_at_risk_usd", "min_reserve_cover_days"];
const VARIANT_ORDER = { baseline: 0, alt1: 1, alt2: 2 } as const;

export function fmtUnit(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const n = (d: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: d }).format(v);
  if (unit === "USD") {
    const a = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    if (a >= 1e9) return `${sign}$${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(a / 1e9)} bn`;
    if (a >= 1e6) return `${sign}$${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(a / 1e6)} m`;
    return `${sign}$${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(a)}`;
  }
  if (unit === "million b/d") return `${n(2)} mb/d`;
  if (unit === "USD/bbl") return `$${n(1)}`;
  if (unit === "million bbl") return `${n(0)} m bbl`;
  if (unit === "days") return `${n(0)} d`;
  return `${n(2)} ${unit}`;
}

const CASCADE_METRICS = [
  { key: "net_shortfall_mbd", label: "Net supply shortfall", unit: "million b/d" },
  { key: "oil_price_usd", label: "Oil price", unit: "USD/bbl" },
  { key: "availability_pct", label: "Route availability", unit: "%" },
  { key: "reserve_cover_days", label: "Staple reserve cover", unit: "days" },
  { key: "cumulative_lost_mb", label: "Cumulative oil lost", unit: "million bbl" },
] as const;

export function ScenarioWorkspace({ caseKey }: { caseKey: string }) {
  const can = useCan();
  const [tpl, setTpl] = useState<Templates | null>(null);
  const [template, setTemplate] = useState<string>("hormuz");
  const [runs, setRuns] = useState<Run[]>([]);
  const [history, setHistory] = useState<{ group_id: string; created_at: string; names: string; by: string }[]>([]);
  const [variants, setVariants] = useState<{ name: string; drivers: Record<string, number> }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lineage, setLineage] = useState<string | null>(null);
  const [replay, setReplay] = useState<{ identical: boolean; checked: number; differences: string[] } | null>(null);
  const [cascadeMetric, setCascadeMetric] = useState<(typeof CASCADE_METRICS)[number]["key"]>("net_shortfall_mbd");

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([api<Templates>("/scenarios/templates"), api<{ template: string; runs: Run[]; history: typeof history }>(`/cases/${caseKey}/scenarios`)]);
    if (!t.ok) return setErr("The reasoning service is not reachable. Start it, then reload.");
    setTpl(t.data);
    if (s.ok) {
      setTemplate(s.data.template);
      const sorted = [...s.data.runs].sort((a, b) => VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant]);
      setRuns(sorted);
      setHistory(s.data.history);
      const defaults = t.data.templates[s.data.template]?.drivers ?? {};
      setVariants((v) => v.length ? v : sorted.length ? sorted.map((r) => ({ name: r.name, drivers: Object.fromEntries(r.assumptions.map((a) => [a.key.replace("driver.", ""), a.value_num])) })) : [{ name: "Baseline", drivers: { ...defaults } }]);
    }
  }, [caseKey]);
  useEffect(() => { load(); }, [load]);

  async function run() {
    setBusy(true); setErr(null); setReplay(null);
    const r = await api<{ runs: Run[] }>(`/cases/${caseKey}/scenarios`, { json: { variants } });
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    setRuns([...r.data.runs].sort((a, b) => VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant]));
    load();
  }
  async function doReplay() {
    if (!runs[0]) return;
    const r = await api<{ identical: boolean; checked: number; differences: string[] }>(`/scenario-runs/${runs[0].id}/replay`, { json: {} });
    if (r.ok) setReplay(r.data);
  }

  const results = useMemo(() => METRIC_ORDER.map((key) => ({
    key, label: runs[0]?.results.find((r) => r.key === key)?.label ?? key, unit: runs[0]?.results.find((r) => r.key === key)?.unit ?? "",
    byHorizon: HORIZONS.map(([h]) => runs.map((run) => run.results.find((r) => r.key === key && r.horizon === h)!)),
  })), [runs]);

  if (err && !tpl) return <Panel role="alert" className="flex gap-2 border-crit/40 bg-crit-soft p-4 text-crit"><ShieldAlert className="size-5" />{err}</Panel>;
  if (!tpl) return <div className="h-64 animate-pulse rounded-lg bg-surface-2" />;
  const cm = CASCADE_METRICS.find((m) => m.key === cascadeMetric)!;

  return (
    <div className="grid gap-4">
      <Panel>
        <PanelHeader eyebrow={`Template: ${template.replace("_", " ")} · ${tpl.model_version}`} title="Drivers" actions={
          <div className="flex flex-wrap gap-2">
            {variants.length < 3 && <Button size="sm" onClick={() => setVariants((v) => [...v, { name: v.length === 1 ? "Alternative 1" : "Alternative 2", drivers: { ...v[0]!.drivers } }])}><Plus />Add alternative</Button>}
            <Button size="sm" variant="primary" disabled={busy || !can("scenario.run")} onClick={run}><Play />{busy ? "Running…" : "Run scenarios"}</Button>
          </div>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink-faint">
                <th className="px-4 py-2 text-start font-medium">Driver</th>
                {variants.map((v, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium">
                    <div className="flex items-center gap-2">
                      <SeriesKey index={i} label="" />
                      <input autoComplete="off" aria-label={`Name of scenario ${i + 1}`} value={v.name} onChange={(e) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-7 w-36 rounded border border-line bg-surface-2 px-2 text-[13px] text-ink" />
                      {i > 0 && <button type="button" aria-label="Remove alternative" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}><X className="size-3.5 text-ink-faint" /></button>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(tpl.drivers).map(([k, spec]) => (
                <tr key={k} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2"><div>{spec.label}</div><div className="text-[13px] text-ink-faint">{spec.unit} · assumption</div></td>
                  {variants.map((v, i) => (
                    <td key={i} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <input autoComplete="off" type="range" aria-label={`${spec.label}, ${v.name}`} min={spec.min} max={spec.max} step={spec.max - spec.min > 50 ? 1 : 0.1} value={v.drivers[k] ?? spec.min} onChange={(e) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, drivers: { ...x.drivers, [k]: Number(e.target.value) } } : x)))} className="w-28 accent-[var(--primary)]" />
                        <span className="w-14 text-end tabular">{v.drivers[k] ?? "—"}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && <p role="alert" className="px-4 pb-3 text-[13px] text-crit">{err}</p>}
        <p className="border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">Drivers are assumptions for this run. Facts come from the evidence base: EIA strait flow and bypass capacity, JODI exports, and the institution&apos;s holdings (synthetic). Numbers are calculated by the deterministic engine; no model writes a number.</p>
      </Panel>

      {runs.length === 0 ? (
        <Panel className="geo-pattern p-6 text-[14px] text-ink-muted">No scenario has been run for this case yet. Set the drivers and press Run scenarios.</Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
            <span>Run by {runs[0]!.created_by_label} · {formatDate(runs[0]!.created_at, true)} · {runs[0]!.monte_carlo_runs} Monte Carlo draws per scenario</span>
            <span translate="no" className="font-mono text-[13px] text-ink-faint">input {runs[0]!.input_hash.slice(0, 12)}</span>
            <Button size="sm" variant="ghost" onClick={doReplay}><RotateCcw />Replay and compare</Button>
            {replay && (replay.identical ? <Badge tone="ok"><CheckCircle2 />Identical: {replay.checked} numbers reproduced</Badge> : <Badge tone="crit"><ShieldAlert />{replay.differences.length} differences</Badge>)}
          </div>

          <Panel>
            <PanelHeader eyebrow="Four horizons" title="Scenario comparison" actions={<div className="flex flex-wrap gap-3 text-[13px] text-ink-muted">{runs.map((r, i) => <SeriesKey key={r.id} index={i} label={r.name} />)}</div>} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead><tr className="border-b border-line text-ink-faint"><th className="px-4 py-2 text-start font-medium">Measure</th>{HORIZONS.map(([h, l]) => <th key={h} className="px-3 py-2 text-start font-medium">{l}</th>)}</tr></thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.key} className="border-b border-line/60 align-top last:border-0">
                      <td className="px-4 py-3"><div className="font-medium">{row.label}</div><div className="mt-0.5"><Badge>Calculated</Badge></div></td>
                      {row.byHorizon.map((cells, hi) => {
                        const vals = cells.flatMap((c) => [c?.value, c?.p10, c?.p90].filter((x): x is number => x !== null && x !== undefined));
                        const min = Math.min(...vals), max = Math.max(...vals);
                        return (
                          <td key={hi} className="px-3 py-2.5">
                            <div className="grid gap-2">
                              {cells.map((c, i) => c && (
                                <div key={c.id} className="grid gap-1">
                                  <button type="button" onClick={() => setLineage(c.id)} className="tap flex items-baseline justify-between gap-2 text-start hover:underline" title="Show how this number was calculated">
                                    <span className="text-[13px] text-ink-faint">{runs[i]!.name}</span>
                                    <span className="tabular font-medium">{fmtUnit(c.value, c.unit)}</span>
                                  </button>
                                  <RangeBar value={c.value} p10={c.p10} p90={c.p90} min={min} max={max} index={i} />
                                  {c.p10 !== null && <span className="text-[13px] tabular text-ink-faint">P10–P90 {fmtUnit(c.p10, c.unit)} to {fmtUnit(c.p90, c.unit)}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">Bars show the P10–P90 range from the Monte Carlo draws; the tick is the deterministic value. Horizons are comparison windows, not forecasts. Click any value to see its formula, facts and assumptions.</p>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader eyebrow="Day by day to day 150" title="Cascade" actions={
                <select id="cascade-metric" aria-label="Cascade measure" value={cascadeMetric} onChange={(e) => setCascadeMetric(e.target.value as typeof cascadeMetric)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-[13px]">
                  {CASCADE_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>} />
              <div className="p-4">
                <LineChart
                  series={runs.map((r) => ({ key: r.id, label: r.name, points: r.cascade.map((d) => ({ x: d.day, y: d[cm.key] })) }))}
                  xLabel="Day" yLabel={`${cm.label} (${cm.unit}). Simulated from the drivers and EIA baseline; not a forecast.`}
                  format={(v) => cm.unit === "%" ? `${Math.round(v)}%` : fmtUnit(v, cm.unit)}
                  markers={runs[0] ? [{ x: Number(runs[0].assumptions.find((a) => a.key === "driver.duration_days")?.value_num ?? 0), label: "Baseline disruption ends" }] : []}
                />
              </div>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="How big a hit, how fast a recovery, is future risk falling" title="Structural resilience" />
              <div className="grid gap-4 p-4">
                <div className="flex flex-wrap gap-4">
                  {runs.map((r, i) => (
                    <div key={r.id} className="grid gap-0.5">
                      <SeriesKey index={i} label={r.name} className="text-[13px] text-ink-muted" />
                      <span className="font-serif text-[26px] leading-none tabular">{num(r.resilience.score, 0)}<span className="text-[14px] text-ink-faint"> / 100</span></span>
                    </div>
                  ))}
                </div>
                <ul className="grid gap-2.5">
                  {runs[0]!.resilience.components.map((c) => (
                    <li key={c.key} className="grid gap-1 text-[13px]">
                      <div className="flex justify-between"><span>{c.label}</span><span className="tabular text-ink-muted">{runs.map((r) => num(r.resilience.components.find((x) => x.key === c.key)!.score, 0)).join(" · ")}</span></div>
                      <div className="h-1.5 overflow-hidden rounded bg-surface-3"><div className="h-full rounded bg-[var(--series-1)]" style={{ width: `${c.score}%` }} /></div>
                      <span className="text-[13px] text-ink-faint">{c.basis}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader eyebrow={`${runs[0]!.name} · 90-day value at risk`} title="What moves the result most" />
              <div className="p-4">
                <Tornado rows={runs[0]!.sensitivity.slice(0, 6)} base={runs[0]!.results.find((r) => r.key === "portfolio_value_at_risk_usd" && r.horizon === "90d")!.value} format={(v) => fmtUnit(v, "USD")} />
                <p className="mt-3 text-[13px] text-ink-muted">Each bar moves one driver up and down by a fixed step while the others stay at the baseline.</p>
              </div>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Synthetic institution context" title="Most exposed holdings" actions={<ClaimBadge claim="synthetic" />} />
              <ul className="divide-y divide-line">
                {runs[0]!.top_exposures.map((e) => (
                  <li key={e.holding_key} className="flex items-center justify-between gap-3 px-4 py-2 text-[13px]">
                    <span className="min-w-0"><span className="block truncate">{e.name}</span><span className="text-[13px] text-ink-faint">{e.sector} · path strength {num(e.path_strength, 2)}</span></span>
                    <span className="tabular">{fmtUnit(e.value_usd, "USD")}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {history.length > 1 && (
            <Panel>
              <PanelHeader eyebrow="Saved runs" title="Earlier comparisons" />
              <ul className="divide-y divide-line">{history.map((h) => <li key={h.group_id} className="flex justify-between gap-3 px-4 py-2 text-[13px]"><span>{h.names}</span><span className="text-ink-faint">{h.by} · {formatDate(h.created_at, true)}</span></li>)}</ul>
            </Panel>
          )}
        </>
      )}
      <ResultLineage id={lineage} onClose={() => setLineage(null)} />
    </div>
  );
}

export function ResultLineage({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [d, setD] = useState<{ result: Result & { formula: string; run_name: string; model_version: string; input_hash: string; monte_carlo_runs: number; run_at: string; created_by_label: string }; facts: { id: string; subject_label: string; predicate_label: string; value_num: number; unit: string; period: string | null; claim_class: string; source_name: string }[]; assumptions: { key: string; label: string; kind: string; value_num: number | null; unit: string; basis: string }[] } | null>(null);
  useEffect(() => { if (id) { setD(null); api<NonNullable<typeof d>>(`/scenario-results/${id}/lineage`).then((r) => r.ok && setD(r.data)); } }, [id]);
  return (
    <Drawer open={!!id} onClose={onClose} eyebrow="Scenario lineage" title={d ? `${d.result.label} · ${d.result.horizon}` : "Loading"}>
      {!d ? <div className="h-64 animate-pulse rounded bg-surface-2" /> : (
        <div className="grid gap-4 text-[13px]">
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <Badge>Calculated</Badge>
            <div className="mt-2 font-serif text-[28px] tabular">{fmtUnit(d.result.value, d.result.unit)}</div>
            {d.result.p10 !== null && <div className="text-ink-muted tabular">P10 {fmtUnit(d.result.p10, d.result.unit)} · P50 {fmtUnit(d.result.p50, d.result.unit)} · P90 {fmtUnit(d.result.p90, d.result.unit)}</div>}
          </div>
          <div><div className="mb-1 font-medium">Formula</div><p className="whitespace-pre-wrap break-words rounded-md border border-line p-2.5 font-mono text-[13px]">{d.result.formula}</p></div>
          <div>
            <div className="mb-1.5 font-medium">Facts used ({d.facts.length})</div>
            {d.facts.length === 0 && <p className="text-ink-muted">This measure uses assumptions only.</p>}
            <ul className="grid gap-1.5">{d.facts.map((f) => <li key={f.id} className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block truncate">{f.predicate_label} · {f.subject_label}{f.period ? ` · ${f.period}` : ""}</span><span className="text-[13px] text-ink-faint">{f.source_name}</span></span><span className="flex items-center gap-1.5"><FactValue id={f.id} value={f.value_num} unit={f.unit} /><ClaimBadge claim={f.claim_class} /></span></li>)}</ul>
          </div>
          <div>
            <div className="mb-1.5 font-medium">Assumptions used ({d.assumptions.length})</div>
            <ul className="grid gap-2">{d.assumptions.map((a) => <li key={a.key} className={cn("rounded-md border border-line p-2.5")}><div className="flex items-center justify-between gap-2"><span>{a.label}</span><span className="flex items-center gap-1.5"><span className="tabular">{a.value_num ?? "table"}{a.unit && a.value_num !== null ? ` ${a.unit}` : ""}</span><ClaimBadge claim="assumed" /></span></div><p className="mt-1 text-[13px] text-ink-faint">{a.kind === "driver" ? "Driver set for this run" : a.basis.length > 160 ? `${a.basis.slice(0, 160)}…` : a.basis}</p></li>)}</ul>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
            <Field label="Scenario">{d.result.run_name}</Field><Field label="Engine">{d.result.model_version}</Field>
            <Field label="Method">{d.result.method} ({d.result.monte_carlo_runs} draws)</Field><Field label="Run">{d.result.created_by_label} · {formatDate(d.result.run_at, true)}</Field>
          </dl>
          <p className="break-all font-mono text-[13px] text-ink-faint">Input hash {d.result.input_hash}</p>
        </div>
      )}
    </Drawer>
  );
}
