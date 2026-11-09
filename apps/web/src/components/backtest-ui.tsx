"use client";
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { api } from "@/lib/api";
import { requireText, clearInvalid } from "@/lib/forms";
import { formatDate, num } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan, useSession } from "./session-context";
import { useLineage } from "./lineage";
import { SERIES_COLOR } from "./charts";

interface Ep { key: string; name: string; date: string; share_pct: number; pre_avg: number; post_avg: number; observed_pct: number; predicted_pct: number; loo_predicted_pct: number; prior_pct: number; observed10_pct: number; fact_ids: string[]; assumption_fact_ids: string[] }
interface Run { id: string; status: string; method: string; episodes: Ep[]; fitted: { response_pct_per_pct: number; premium_usd_per_pct_at_80: number }; prior: { response_pct_per_pct: number; premium_usd_per_pct_at_80: number }; metrics: { episodes: number; mae_pp: number; loo_mae_pp: number; prior_mae_pp: number }; run_by_label: string; adopted_by_label: string | null; adopted_at: string | null; created_at: string }

/** Dot plot: one row per episode, observed move against the prior assumption and the fitted response (dataviz: one axis, shape + colour, table view). */
function DotPlot({ eps }: { eps: Ep[] }) {
  const [table, setTable] = useState(false);
  const series = [
    { key: "observed_pct", label: "Observed", shape: "circle" },
    { key: "prior_pct", label: "Analyst assumption (before)", shape: "square" },
    { key: "predicted_pct", label: "Fitted response", shape: "diamond" },
  ] as const;
  const vals = eps.flatMap((e) => series.map((s) => e[s.key]));
  const max = Math.ceil(Math.max(10, ...vals) / 10) * 10, min = Math.min(0, Math.floor(Math.min(...vals) / 10) * 10);
  const W = 720, L = 230, R = 24, rowH = 46, T = 8, H = T + eps.length * rowH + 30;
  const sx = (v: number) => L + ((v - min) / (max - min)) * (W - L - R);
  const ticks = Array.from({ length: (max - min) / 10 + 1 }, (_, i) => min + i * 10);
  const mark = (shape: string, x: number, y: number, c: string) => shape === "circle" ? <circle cx={x} cy={y} r={5.5} fill={c} /> : shape === "square" ? <rect x={x - 5} y={y - 5} width={10} height={10} fill={c} /> : <path d={`M${x},${y - 6.5}L${x + 6.5},${y}L${x},${y + 6.5}L${x - 6.5},${y}Z`} fill={c} />;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-muted" aria-label="Legend">
          {series.map((s, i) => <li key={s.key} className="flex items-center gap-1.5"><svg width="14" height="14" aria-hidden="true">{mark(s.shape, 7, 7, SERIES_COLOR[i]!)}</svg>{s.label}</li>)}
        </ul>
        <button type="button" className="text-[13px] text-accent hover:underline" onClick={() => setTable((t) => !t)} aria-pressed={table}>{table ? "Show chart" : "Show table"}</button>
      </div>
      {!table ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[900px]" role="img" aria-label="Brent price move in the first three trading days for each episode: observed, the prior assumption and the fitted response. A table view is available.">
          {ticks.map((t) => <g key={t}><line x1={sx(t)} x2={sx(t)} y1={T} y2={H - 26} stroke="var(--line)" /><text x={sx(t)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--ink-faint)" className="tabular">{t > 0 ? `+${t}` : t}%</text></g>)}
          {eps.map((e, r) => {
            const y = T + r * rowH + rowH / 2;
            return (
              <g key={e.key}>
                <text x={0} y={y - 6} dy="0.32em" fontSize="12" fill="var(--ink)">{e.name.length > 30 ? `${e.name.slice(0, 29)}…` : e.name}</text>
                <text x={0} y={y + 14} fontSize="10.5" fill="var(--ink-faint)" className="tabular">{e.date.slice(0, 4)} · {num(e.share_pct, 1)}% of supply</text>
                <line x1={sx(Math.min(...series.map((s) => e[s.key])))} x2={sx(Math.max(...series.map((s) => e[s.key])))} y1={y} y2={y} stroke="var(--line-strong)" />
                {series.map((s, i) => <g key={s.key}><title>{`${s.label}: ${e[s.key] > 0 ? "+" : ""}${num(e[s.key], 1)}%`}</title>{mark(s.shape, sx(e[s.key]), y, SERIES_COLOR[i]!)}</g>)}
              </g>
            );
          })}
        </svg>
      ) : (
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-line text-ink-faint">{["Episode", "Share lost", "Before", "First 3 days", "Observed", "Assumption", "Fitted", "Fitted without it"].map((h) => <th key={h} className="px-2 py-1 text-end font-medium first:text-start">{h}</th>)}</tr></thead>
          <tbody>{eps.map((e) => <tr key={e.key} className="border-b border-line/50 tabular"><td className="px-2 py-1">{e.name}</td><td className="px-2 py-1 text-end">{num(e.share_pct, 2)}%</td><td className="px-2 py-1 text-end">USD {num(e.pre_avg, 2)}</td><td className="px-2 py-1 text-end">USD {num(e.post_avg, 2)}</td><td className="px-2 py-1 text-end">{num(e.observed_pct, 1)}%</td><td className="px-2 py-1 text-end">{num(e.prior_pct, 1)}%</td><td className="px-2 py-1 text-end">{num(e.predicted_pct, 1)}%</td><td className="px-2 py-1 text-end">{num(e.loo_predicted_pct, 1)}%</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

export function BacktestPanel() {
  const can = useCan();
  const s = useSession();
  const show = useLineage();
  const [d, setD] = useState<{ runs: Run[]; available: Array<{ key: string; name: string; prices: number }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => api<{ runs: Run[]; available: Array<{ key: string; name: string; prices: number }> }>("/backtests").then((r) => r.ok && setD(r.data)), []);
  useEffect(() => { load(); }, [load]);
  async function run() {
    setBusy(true);
    const r = await api("/backtests", { json: {} });
    setBusy(false);
    setMsg(r.ok ? "Back-test complete." : r.message);
    load();
  }
  async function adopt(id: string) {
    const bad = requireText(reason, 5, "adopt-reason", "The reason to adopt");
    if (bad) { setMsg(bad); return; }
    clearInvalid("adopt-reason");
    const r = await api(`/backtests/${id}/adopt`, { json: { reason } });
    setMsg(r.ok ? "Adopted. New scenario runs use the fitted price response." : r.message);
    if (r.ok) setReason("");
    load();
  }
  const latest = d?.runs[0];
  const adopted = d?.runs.find((x) => x.status === "adopted");
  return (
    <Panel className="mt-5">
      <PanelHeader eyebrow="Calibration" title="Back-test of the price response" actions={<div className="flex items-center gap-2">{adopted ? <Badge tone="ok">Calibrated · adopted by {adopted.adopted_by_label}</Badge> : <Badge tone="warn">Analyst assumption in use</Badge>}{can("scenario.run") && <Button size="sm" variant="secondary" onClick={run} disabled={busy}><Play />{busy ? "Running…" : "Run back-test"}</Button>}</div>} />
      <div className="grid gap-4 p-4 text-[13px]">
        <p className="max-w-[80ch] text-ink-muted">How much did Brent move in the first three trading days of past supply disruptions, and how well does the engine's price response explain it? Prices are EIA daily Brent (public domain); the size of each disruption is an analyst estimate, labelled as an assumption. A domain expert other than the person who ran it adopts a result before scenarios use it.</p>
        {!latest && d && <p className="text-ink-muted">{d.available.length ? `${d.available.length} episodes with ${d.available.reduce((s, a) => s + a.prices, 0)} daily prices are ready.` : "Import the back-test package first."} No back-test has been run yet.</p>}
        {latest && (
          <>
            <dl className="grid grid-cols-2 gap-4 tabular sm:grid-cols-4">
              <div><dt className="text-[13px] text-ink-faint">Fitted response</dt><dd className="text-[20px] font-medium">{num(latest.fitted.response_pct_per_pct, 2)}%</dd><dd className="text-[13px] text-ink-faint">per 1% of world supply lost · USD {num(latest.fitted.premium_usd_per_pct_at_80, 2)} at USD 80</dd></div>
              <div><dt className="text-[13px] text-ink-faint">Analyst assumption</dt><dd className="text-[20px] font-medium">{num(latest.prior.response_pct_per_pct, 2)}%</dd><dd className="text-[13px] text-ink-faint">USD {latest.prior.premium_usd_per_pct_at_80} at USD 80</dd></div>
              <div><dt className="text-[13px] text-ink-faint">Average error</dt><dd className="text-[20px] font-medium">{num(latest.metrics.mae_pp, 1)} pp</dd><dd className="text-[13px] text-ink-faint">assumption {num(latest.metrics.prior_mae_pp, 1)} pp</dd></div>
              <div><dt className="text-[13px] text-ink-faint">Leave-one-out error</dt><dd className="text-[20px] font-medium">{num(latest.metrics.loo_mae_pp, 1)} pp</dd><dd className="text-[13px] text-ink-faint">fitted without the episode it predicts</dd></div>
            </dl>
            <DotPlot eps={latest.episodes} />
            <p className="text-[13px] text-ink-faint">{latest.method} {latest.metrics.episodes} episodes; few and varied, so calibration is rated medium, not high. Run by {latest.run_by_label} · {formatDate(latest.created_at, true)} · <span className={cn(latest.status === "adopted" ? "text-ok" : "text-warn")}>{latest.status}</span>.
              {" "}Lineage: <button type="button" className="text-accent hover:underline" onClick={() => show(latest.episodes[0]!.fact_ids[0]!)}>a Brent price fact</button> · <button type="button" className="text-accent hover:underline" onClick={() => show(latest.episodes[0]!.assumption_fact_ids[0]!)}>an episode assumption</button></p>
            {latest.status === "proposed" && s.principal.role === "domain_expert" && (
              <div className="flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 text-[13px] text-ink-muted">Reason to adopt<input autoComplete="off" id="adopt-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink" /></label><Button size="sm" variant="primary" onClick={() => adopt(latest.id)}><FlaskConical />Adopt calibration</Button></div>
            )}
          </>
        )}
        {msg && <p role="status" className="text-[13px] text-ink-muted">{msg}</p>}
      </div>
    </Panel>
  );
}
