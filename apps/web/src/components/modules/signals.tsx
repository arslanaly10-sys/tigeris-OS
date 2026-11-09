"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Radio, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { LensHeading, OthersToggle, industryName, splitByIndustry } from "../industry";
import { usePrefs } from "../prefs";
import { formatDate, formatValue } from "@/lib/format";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Drawer, Field } from "../drawer";
import { ClaimBadge, ValidationBadge } from "../labels";
import { useCan } from "../session-context";
import { cn } from "@/lib/cn";

export interface Confidence { band: "low" | "medium" | "high"; components: { factor: string; level: "low" | "medium" | "high"; basis: string }[] }
interface Signal { id: string; title: string; summary: string; in_industry?: boolean; domain: string; urgency: string; impact: string; data_mode: string; event_time: string; detected_at: string; status: string; why_surfaced: string; confidence: Confidence; corroborations: number; entities: { key: string; name: string }[] | null; cases: { caseKey: string; title: string }[] | null; disposition_note: string | null; disposition_by: string | null }

export const URGENCY_TONE: Record<string, "crit" | "warn" | "info" | "neutral"> = { critical: "crit", high: "warn", medium: "info", low: "neutral" };
export const ModeBadge = ({ mode }: { mode: string }) => <Badge tone={mode === "observed" ? "ok" : "gold"} className="text-[13px] font-medium">{mode === "observed" ? "Observed" : mode === "simulated" ? "Simulated" : "Synthetic"}</Badge>;

export function ConfidenceBand({ c, compact }: { c: Confidence; compact?: boolean }) {
  const steps = { low: 1, medium: 2, high: 3 }[c.band];
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="flex gap-0.5" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={cn("h-2 w-5 rounded-sm", i <= steps ? "bg-primary" : "bg-surface-3")} />)}</span>
        <span className="text-[13px] font-medium">Confidence: {c.band}</span>
      </div>
      {!compact && (
        <ul className="grid gap-1">
          {c.components.map((x) => (
            <li key={x.factor} className="grid grid-cols-[130px_60px_1fr] gap-2 text-[13px]">
              <span className="text-ink-muted">{x.factor}</span>
              <span className={cn("font-medium", x.level === "high" ? "text-ok" : x.level === "medium" ? "text-info" : "text-warn")}>{x.level}</span>
              <span className="text-ink-faint">{x.basis}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SignalsModule() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<string>("");
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [open, setOpen] = useState<string | null>(params.get("focus"));
  const [industry, setIndustry] = useState("");
  const [showOthers, setShowOthers] = useState(false);
  const { lang } = usePrefs();
  const load = useCallback(() => api<{ signals: Signal[]; industry: string }>(`/signals${filter ? `?status=${filter}` : ""}`).then((r) => { if (r.ok) { setSignals(r.data.signals); setIndustry(r.data.industry); } }), [filter]);
  const split = splitByIndustry(signals ?? [], (s) => s.in_industry);
  // A signal opened by link (?focus=) stays visible even when it is outside the lens.
  const focusOutside = !!open && split.others.some((s) => s.id === open);
  const shown = showOthers || focusOutside ? [...split.mine, ...split.others] : split.mine;
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader nav="nav.signals" description="Things that may need attention, with why each was surfaced and how confident the system is. Simulated and synthetic signals are labelled on every screen." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader eyebrow="Queue" title="Signals" actions={
            <select id="signal-filter" aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-[13px]">
              <option value="">All</option><option value="new">New</option><option value="monitoring">Monitoring</option><option value="in_case">In a case</option><option value="dismissed">Dismissed</option>
            </select>} />
          {!signals && <div className="m-4 h-64 animate-pulse rounded bg-surface-2" />}
          {signals && <LensHeading industry={industry} count={split.mine.length} lang={lang === "ar" ? "ar" : "en"} />}
          {signals && !split.mine.length && <p className="px-4 py-4 text-[13px] text-ink-muted">No signals in this industry for this filter.</p>}
          <ul className="cv-auto divide-y divide-line">
            {shown.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setOpen(s.id)} className="grid w-full gap-1.5 px-4 py-3 text-start hover:bg-surface-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={URGENCY_TONE[s.urgency]}>{s.urgency}</Badge><ModeBadge mode={s.data_mode} />
                    <Badge>{s.status.replace("_", " ")}</Badge>
                    {s.corroborations > 0 && <Badge tone="ok">{s.corroborations} corroborating</Badge>}
                    <span className="ms-auto text-[13px] tabular text-ink-faint">{formatDate(s.event_time, true)}</span>
                  </div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-[13px] text-ink-muted">{s.why_surfaced}</div>
                  <ConfidenceBand c={s.confidence} compact />
                </button>
              </li>
            ))}
          </ul>
          <OthersToggle count={split.others.length} open={showOthers || focusOutside} onToggle={() => setShowOthers((v) => !v)} />
        </Panel>
        <LivePanel onInjected={load} />
      </div>
      <SignalDrawer id={open} onClose={() => { setOpen(null); load(); }} />
    </>
  );
}

function LivePanel({ onInjected }: { onInjected: () => void }) {
  const can = useCan();
  const [tick, setTick] = useState<{ at: string; corridors: { key: string; name: string; value: number; baseline: number; unit: string; deltaPct: number }[] } | null>(null);
  const [on, setOn] = useState(true);
  const [events, setEvents] = useState<{ kind: string; title: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<{ events: { kind: string; title: string }[] }>("/signals/simulated-events").then((r) => r.ok && setEvents(r.data.events)); }, []);
  useEffect(() => {
    if (!on) return;
    const es = new EventSource("/api/signals/live");
    es.onmessage = (e) => setTick(JSON.parse(e.data));
    return () => es.close();
  }, [on]);
  async function inject(kind: string) {
    const r = await api<{ id: string; created: boolean }>("/signals/simulate", { json: { kind } });
    setMsg(r.ok ? "Simulated event raised. It is at the top of the queue." : r.message);
    onInjected();
  }
  return (
    <Panel className="h-fit">
      <PanelHeader eyebrow="Movement stream" title="Simulated live feed" actions={<><Badge tone="gold" className="text-[13px] font-medium">Simulated</Badge><Button size="sm" variant="ghost" onClick={() => setOn((v) => !v)} aria-pressed={on}>{on ? "Pause" : "Resume"}</Button></>} />
      <div className="grid gap-3 p-4">
        <p className="text-[13px] text-ink-muted">A labelled simulation of corridor transit counts. It is not live AIS. Licensed feeds connect in the pilot stage.</p>
        {tick?.corridors.map((c) => (
          <div key={c.key} className="grid gap-1">
            <div className="flex items-baseline justify-between text-[13px]"><span>{c.name}</span><span className="tabular"><span className="font-medium">{c.value}</span> <span className="text-ink-faint">/ {c.baseline} avg</span></span></div>
            <div className="h-1.5 overflow-hidden rounded bg-surface-3"><div className={cn("h-full rounded transition-[width] duration-700", c.deltaPct < -15 ? "bg-crit" : c.deltaPct < -5 ? "bg-warn" : "bg-ok")} style={{ width: `${Math.min(100, (c.value / c.baseline) * 80)}%` }} /></div>
            <div className="flex justify-between text-[13px] text-ink-faint"><span>{c.unit}</span><span className={cn("tabular", c.deltaPct < -15 && "text-crit")}>{c.deltaPct > 0 ? "+" : ""}{c.deltaPct}% vs 7-day average</span></div>
          </div>
        ))}
        {tick && <p className="flex items-center gap-1.5 text-[13px] text-ink-faint"><Radio className={cn("size-3", on && "text-ok")} />Updated {new Date(tick.at).toLocaleTimeString("en-GB")}</p>}
        <div className="border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium"><Zap className="size-4 text-accent" />Presenter controls</div>
          <div className="grid gap-1.5">
            {events.map((e) => <Button key={e.kind} size="sm" variant="secondary" className="h-auto justify-start whitespace-normal py-1.5 text-start" disabled={!can("evidence.upload")} onClick={() => inject(e.kind)}><Activity />{e.title}</Button>)}
          </div>
          {msg && <p role="status" className="mt-2 text-[13px] text-ok">{msg}</p>}
        </div>
      </div>
    </Panel>
  );
}

function SignalDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const can = useCan();
  const router = useRouter();
  const [d, setD] = useState<{ signal: Signal; evidence: { role: string; note: string | null; evidence_id: string; title: string; validation_state: string; source_name: string; value_text: string | null }[]; entities: { key: string; name: string; type: string }[]; cases: { case_key: string; title: string; state: string }[] } | null>(null);
  const [rationale, setRationale] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (id) { setD(null); setErr(null); setRationale(""); api<NonNullable<typeof d>>(`/signals/${id}`).then((r) => r.ok && setD(r.data)); } }, [id]);
  async function act(action: "monitor" | "dismiss" | "open_case") {
    const r = await api<{ status: string; caseKey?: string }>(`/signals/${id}/disposition`, { json: { action, rationale } });
    if (!r.ok) return setErr(r.message);
    if (r.data.caseKey) router.push(`/cases/${r.data.caseKey}`);
    else onClose();
  }
  return (
    <Drawer open={!!id} onClose={onClose} eyebrow="Signal" title={d?.signal.title ?? "Loading"}>
      {!d ? <div className="h-64 animate-pulse rounded bg-surface-2" /> : (
        <div className="grid gap-5 text-[13px]">
          <div className="flex flex-wrap gap-1.5"><Badge tone={URGENCY_TONE[d.signal.urgency]}>{d.signal.urgency}</Badge><ModeBadge mode={d.signal.data_mode} /><Badge>{industryName(d.signal.domain)}</Badge><Badge>{d.signal.status.replace("_", " ")}</Badge></div>
          <p>{d.signal.summary}</p>
          <div className="rounded-md border border-line bg-surface-2 p-3"><div className="mb-1 font-medium">Why this was surfaced</div><p className="text-ink-muted">{d.signal.why_surfaced}</p></div>
          <dl className="grid grid-cols-2 gap-3"><Field label="Event time">{formatDate(d.signal.event_time, true)}</Field><Field label="Detected">{formatDate(d.signal.detected_at, true)}</Field></dl>
          <ConfidenceBand c={d.signal.confidence} />
          <div>
            <div className="mb-1.5 font-medium">Evidence</div>
            {d.evidence.length === 0 && <p className="text-ink-muted">{d.signal.data_mode === "observed" ? "No evidence linked." : "From the simulated stream; no source record. Upload or import evidence to corroborate it."}</p>}
            <ul className="grid gap-2">{d.evidence.map((e, i) => <li key={i} className="rounded-md border border-line p-2.5"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={e.role === "corroborating" ? "ok" : "neutral"}>{e.role}</Badge><span className="font-medium">{e.title}</span><ValidationBadge state={e.validation_state} /></div><p className="mt-1 text-[13px] text-ink-muted">{e.source_name}{e.note ? ` · ${e.note}` : ""}</p>{e.value_text && <p className="mt-1 text-[13px]">&ldquo;{e.value_text}&rdquo;</p>}</li>)}</ul>
          </div>
          {d.entities.length > 0 && <div><div className="mb-1.5 font-medium">Linked in the graph</div><div className="flex flex-wrap gap-1.5">{d.entities.map((e) => <Link key={e.key} href={`/graph?focus=${encodeURIComponent(e.key)}`}><Badge tone="info">{e.name}</Badge></Link>)}</div></div>}
          {d.cases.length > 0 && <div><div className="mb-1.5 font-medium">Cases</div>{d.cases.map((c) => <Link key={c.case_key} href={`/cases/${c.case_key}`} className="tap block text-accent hover:underline">{c.case_key} · {c.title} ({c.state})</Link>)}</div>}
          {d.signal.disposition_note && <p className="text-[13px] text-ink-faint">Disposition by {d.signal.disposition_by}: {d.signal.disposition_note}</p>}
          {can("evidence.dispose") && d.signal.status !== "in_case" && (
            <div className="grid gap-2 border-t border-line pt-4">
              <label htmlFor="sig-rationale" className="font-medium">Disposition</label>
              <textarea autoComplete="off" id="sig-rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} placeholder="e.g. Corroborated by the shipping advisory…" className="rounded-md border border-line bg-surface-2 p-2" />
              <div className="flex flex-wrap gap-2">
                {can("case.create") && <Button variant="primary" size="sm" onClick={() => act("open_case")}>Open a case</Button>}
                <Button size="sm" onClick={() => act("monitor")}>Monitor</Button>
                <Button size="sm" variant="ghost" onClick={() => act("dismiss")}>Dismiss</Button>
              </div>
              {err && <p role="alert" className="text-crit">{err}</p>}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

export const fmtVal = formatValue;
