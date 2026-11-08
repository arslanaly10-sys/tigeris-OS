"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Bot, ChevronDown, ChevronRight, Cpu, Download, FileText, Gavel, Play, Scale, Send, ShieldCheck, Swords, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { useLineage } from "./lineage";
import { ResultLineage, fmtUnit } from "./scenarios";

/* ---------- shared types ---------- */
export interface Src { tag: string; kind: string; ref: string | null; label: string; text: string }
export interface Sentence { sentence: string; tags: string[]; status: "cited" | "unverified"; reason?: string }
interface Attempt { provider: string; model: string; outcome: string; reason?: string; check?: string }
interface Step {
  seq: number; agent_key: string; phase: string; title: string; ms: number; writer: string; fallback_reason: string | null;
  tool_calls: Array<{ tool: string; input: unknown; summary: string; ms: number }>; sources: Src[]; text: Sentence[];
  output: Record<string, unknown> & { excluded?: Array<{ label: string; reason: string }>; attempts?: Attempt[]; modelText?: string | null; challenges?: Challenge[] };
}
interface Challenge { id: string; challenger: string; target: string; claim: string; contention: string; response: string; status: "accepted" | "rebutted"; effect: string }
interface Run { id: string; status: string; provider_requested: string; tokens_in: number; tokens_out: number; cost_usd: number; model_calls: number; summary: Record<string, unknown>; error: string | null; requested_by_label: string; started_at: string; finished_at: string | null }
interface Call { step_seq: number | null; agent_key: string; provider: string; model: string; outcome: string; reason: string | null; tokens_in: number; tokens_out: number; latency_ms: number; cost_usd: number; priced: boolean }
interface ProviderInfo { key: string; label: string; foreign: boolean; usable: boolean; allowlisted: boolean; reason: string | null; model: string }

export const AGENT_LABEL: Record<string, string> = {
  signal_triage: "Signal triage", noise_moderation: "Noise moderation", entity_resolution: "Entity resolution", document_extraction: "Document extraction",
  causal_impact: "Causal impact", financial_impact: "Financial impact", scenario_analyst: "Scenario analyst", sector: "Sector agent",
  governance_checker: "Governance checker", brief_writer: "Brief writer", ask: "Ask TIGERIS", graph_query: "Graph query parser",
};
const PHASES: Array<{ key: string; label: string; icon: typeof Bot }> = [
  { key: "gather", label: "Gather", icon: Wrench }, { key: "analyse", label: "Analyse", icon: Cpu }, { key: "challenge", label: "Challenge", icon: Swords },
  { key: "recommend", label: "Recommend", icon: Scale }, { key: "govern", label: "Govern", icon: Gavel }, { key: "compose", label: "Compose", icon: FileText },
];
const fmtUsd = (v: number) => fmtUnit(v, "USD");

/* ---------- writer + provider ---------- */
export function WriterBadge({ writer }: { writer: string }) {
  const base = writer.replace(" (cached)", "");
  const label = base === "local" ? "Local model" : base === "deterministic" ? "Deterministic writer" : base === "anthropic" ? "Claude" : base === "openai" ? "OpenAI" : base;
  return <Badge tone={base === "deterministic" ? "neutral" : base === "local" ? "ok" : "warn"} title="Who wrote this text. Numbers always come from tools.">{base === "deterministic" ? <FileText /> : <Bot />}{label}{writer.endsWith("(cached)") ? " · cached" : ""}</Badge>;
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [defaultProvider, setDefault] = useState("local");
  useEffect(() => {
    api<{ providers: ProviderInfo[]; settings: { default_provider: string } }>("/ai/status").then((r) => {
      if (r.ok) { setProviders(r.data.providers); setDefault(r.data.settings.default_provider); }
    });
  }, []);
  return { providers, defaultProvider };
}

export function ProviderPicker({ value, onChange, providers }: { value: string; onChange: (v: string) => void; providers: ProviderInfo[] }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
      Model
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-[12.5px] text-ink">
        {providers.filter((p) => p.key !== "deterministic").map((p) => (
          <option key={p.key} value={p.key}>{p.label}{p.usable ? "" : " (blocked: falls back)"}</option>
        ))}
        <option value="deterministic">Deterministic writer (no model)</option>
      </select>
    </label>
  );
}

/* ---------- checked text with citations ---------- */
export function CheckedText({ text, sources, className }: { text: Sentence[]; sources: Src[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const showFact = useLineage();
  const src = (tag: string) => sources.find((s) => s.tag === tag);
  return (
    <div className={cn("grid gap-1.5", className)}>
      <p className="leading-relaxed">
        {text.map((t, i) => {
          const clean = t.sentence.replace(/\s*\[S\d+\]/g, "").trim();
          return (
            <span key={i} className={cn(t.status === "unverified" && "rounded-sm bg-warn-soft px-0.5 text-warn")}>
              {t.status === "unverified" && <span className="me-1 align-[1px] text-[10px] font-semibold uppercase tracking-wide" title={t.reason}>Unverified</span>}
              {clean}
              {t.tags.map((tag) => (
                <button key={tag} type="button" onClick={() => setOpen(open === `${i}:${tag}` ? null : `${i}:${tag}`)} aria-expanded={open === `${i}:${tag}`} className="mx-0.5 rounded bg-surface-3 px-1 align-[1px] font-mono text-[10.5px] text-accent hover:underline">{tag}</button>
              ))}
              {" "}
            </span>
          );
        })}
      </p>
      {open && (() => {
        const [i, tag] = open.split(":");
        const s = src(tag!);
        const t = text[Number(i)];
        return s ? (
          <div className="rounded-md border border-line bg-surface-2 p-2.5 text-[12px]">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-ink">{s.tag} · {s.label}</span><Badge>{s.kind.replace("_", " ")}</Badge></div>
            <p className="mt-1 text-ink-muted">{s.text}</p>
            {s.kind === "fact" && s.ref && <button type="button" className="mt-1 text-accent hover:underline" onClick={() => showFact(s.ref!)}>Open source lineage</button>}
            {s.kind === "scenario_result" && s.ref && <button type="button" className="mt-1 text-accent hover:underline" onClick={() => setResultId(s.ref)}>Open calculation lineage</button>}
            {t?.status === "unverified" && <p className="mt-1 text-warn">Not verified: {t.reason}</p>}
          </div>
        ) : null;
      })()}
      {text.some((t) => t.status === "unverified") && <p className="text-[11.5px] text-ink-faint">Highlighted sentences failed the citation check and are shown as unverified: {[...new Set(text.filter((t) => t.status === "unverified").map((t) => t.reason))].join("; ")}.</p>}
      <ResultLineage id={resultId} onClose={() => setResultId(null)} />
    </div>
  );
}

/* ---------- agent analysis (trace + debate) ---------- */
export function AgentAnalysis({ caseKey, onDone }: { caseKey: string; onDone?: () => void }) {
  const can = useCan();
  const { providers, defaultProvider } = useProviders();
  const [provider, setProvider] = useState<string | null>(null);
  const [d, setD] = useState<{ runs: Run[]; run: Run | null; steps: Step[]; calls: Call[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    const r = await api<{ runs: Run[]; run: Run | null; steps: Step[]; calls: Call[] }>(`/cases/${caseKey}/analysis${runId ? `?run=${runId}` : ""}`);
    if (!r.ok) { setErr(r.message); return; }
    setD(r.data);
    if (r.data.run?.status === "running") timer.current = setTimeout(load, 1500);
    else if (timer.current) { timer.current = null; onDone?.(); }
  }, [caseKey, runId, onDone]);
  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [load]);

  async function start() {
    setErr(null);
    const r = await api<{ runId: string }>(`/cases/${caseKey}/analysis`, { json: { provider: provider ?? defaultProvider } });
    if (!r.ok) { setErr(r.message); return; }
    setRunId(r.data.runId);
  }
  const run = d?.run;
  const running = run?.status === "running";
  const challenges = d?.steps.find((s) => s.phase === "challenge")?.output.challenges ?? [];
  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h3 className="text-[17px] font-semibold">Bounded agent analysis</h3>
            <p className="mt-1 text-[13px] text-ink-muted">Ten agents gather, analyse, challenge each other, score options with the scenario engine and draft the brief. Numbers come only from tools; models only phrase them, and every sentence is checked for citations.</p>
          </div>
          {can("recommendation.draft") ? (
            <div className="flex flex-wrap items-center gap-2">
              <ProviderPicker value={provider ?? defaultProvider} onChange={setProvider} providers={providers} />
              <Button variant="primary" onClick={start} disabled={running}><Play />{running ? "Running…" : d?.run ? "Run again" : "Run analysis"}</Button>
            </div>
          ) : <Badge>Your role can read the analysis; analysts run it</Badge>}
        </div>
        {err && <p role="alert" className="mt-2 text-[12.5px] text-crit">{err}</p>}
        {run && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-[12.5px] text-ink-muted">
            <Badge tone={run.status === "completed" ? "ok" : run.status === "failed" ? "crit" : "info"}>{run.status}</Badge>
            <span>Requested model: <span className="text-ink">{run.provider_requested}</span></span>
            <span>Steps: <span className="tabular text-ink">{d!.steps.length}</span>/12</span>
            <span>Model calls: <span className="tabular text-ink">{d!.calls.filter((c) => c.outcome === "ok" || c.outcome === "cached").length}</span>{d!.calls.some((c) => c.outcome === "blocked") && <span className="text-warn"> · {d!.calls.filter((c) => c.outcome === "blocked").length} blocked</span>}</span>
            <span>Tokens: <span className="tabular text-ink">{d!.calls.reduce((s, c) => s + c.tokens_in + c.tokens_out, 0).toLocaleString("en-GB")}</span></span>
            <span>Cost: <span className="tabular text-ink">USD {d!.calls.reduce((s, c) => s + c.cost_usd, 0).toFixed(4)}</span></span>
            <span>By {run.requested_by_label} · {formatDate(run.started_at, true)}</span>
            {run.error && <span className="text-crit">Error: {run.error}</span>}
          </div>
        )}
      </Panel>

      {d && d.steps.length > 0 && (
        <ol className="grid gap-4" aria-label="Agent phases">
          {PHASES.map((ph) => {
            const steps = d.steps.filter((s) => s.phase === ph.key);
            const Icon = ph.icon;
            const pending = running && !steps.length;
            return (
              <li key={ph.key} className={cn("grid gap-2", pending && "opacity-60")}>
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-ink-faint"><Icon className="size-4 text-accent" />{ph.label}{pending && <span className="normal-case tracking-normal">· waiting</span>}</div>
                {ph.key === "challenge" && challenges.length > 0 && <Debate challenges={challenges} />}
                <div className="grid gap-2 md:grid-cols-2">{steps.map((s) => <StepCard key={s.seq} s={s} calls={d.calls.filter((c) => c.step_seq === s.seq)} />)}</div>
              </li>
            );
          })}
        </ol>
      )}
      {d && !d.run && !running && <Panel className="p-6 text-center text-ink-muted">No agent analysis has been run for this case yet.</Panel>}
      {d && d.runs.length > 1 && (
        <Panel className="p-4">
          <PanelHeader eyebrow="History" title="Earlier runs" className="p-0 pb-2" />
          <ul className="grid gap-1 text-[12.5px]">
            {d.runs.map((r) => <li key={r.id}><button type="button" onClick={() => setRunId(r.id)} className={cn("hover:underline", r.id === d.run?.id ? "font-medium text-ink" : "text-accent")}>{formatDate(r.started_at, true)} · {r.status} · {r.provider_requested} · {r.requested_by_label}</button></li>)}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Debate({ challenges }: { challenges: Challenge[] }) {
  return (
    <Panel className="border-primary/30 p-4">
      <div className="mb-3 flex items-center gap-2"><Swords className="size-4 text-accent" /><span className="font-semibold">Agents challenge each other</span><Badge className="tabular">{challenges.filter((c) => c.status === "accepted").length} accepted · {challenges.filter((c) => c.status === "rebutted").length} rebutted</Badge></div>
      <ol className="grid gap-3">
        {challenges.map((c) => (
          <li key={c.id} className="grid gap-1.5 rounded-md border border-line bg-surface-2 p-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="font-mono text-ink-faint">{c.id}</span>
              <span className="font-medium">{AGENT_LABEL[c.challenger] ?? c.challenger}</span><ArrowRight className="size-3.5 text-ink-faint rtl:rotate-180" aria-label="challenges" /><span className="font-medium">{AGENT_LABEL[c.target] ?? c.target}</span>
              <Badge tone={c.status === "accepted" ? "ok" : "info"} className="ms-auto">{c.status === "accepted" ? "Accepted" : "Rebutted"}</Badge>
            </div>
            <p className="text-ink-muted"><span className="text-ink-faint">Claim:</span> {c.claim}</p>
            <p><span className="text-ink-faint">Challenge:</span> {c.contention}</p>
            <p><span className="text-ink-faint">Response:</span> {c.response}</p>
            <p className="text-[12px] text-accent">Effect: {c.effect}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function StepCard({ s, calls }: { s: Step; calls: Call[] }) {
  const [trace, setTrace] = useState(false);
  return (
    <Panel className="grid gap-2 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-ink-faint">#{s.seq}</span>
        <span className="font-semibold">{s.agent_key === "sector" ? s.title.split(":")[0] : AGENT_LABEL[s.agent_key] ?? s.agent_key}</span>
        <WriterBadge writer={s.writer} />
        <span className="ms-auto tabular text-[11.5px] text-ink-faint">{(s.ms / 1000).toFixed(1)} s</span>
      </div>
      <p className="text-[12.5px] text-ink-muted">{s.agent_key === "sector" ? s.title.split(": ").slice(1).join(": ") : s.title}</p>
      <CheckedText text={s.text} sources={s.sources} className="text-[13.5px]" />
      {s.fallback_reason && <p className="flex gap-1.5 text-[11.5px] text-ink-faint"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />{s.fallback_reason}</p>}
      <button type="button" onClick={() => setTrace((t) => !t)} aria-expanded={trace} className="flex items-center gap-1 justify-self-start text-[12px] text-accent hover:underline">{trace ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 rtl:rotate-180" />}Run trace</button>
      {trace && (
        <div className="grid gap-2 rounded-md border border-line bg-surface-2 p-2.5 text-[12px]">
          <div><div className="mb-1 font-medium">Tool calls</div>
            <ul className="grid gap-1">{s.tool_calls.map((t, i) => <li key={i} className="grid grid-cols-[1fr_auto] gap-2"><span><span className="font-mono text-accent">{t.tool}</span> <span className="text-ink-faint">{JSON.stringify(t.input)}</span><br /><span className="text-ink-muted">→ {t.summary}</span></span><span className="tabular text-ink-faint">{t.ms} ms</span></li>)}</ul>
          </div>
          <div><div className="mb-1 font-medium">Sources given to the writer ({s.sources.length})</div>
            <ul className="grid gap-0.5">{s.sources.map((x) => <li key={x.tag} className="text-ink-muted"><span className="font-mono text-ink-faint">{x.tag}</span> {x.label}: {x.text}</li>)}</ul>
          </div>
          {!!s.output.excluded?.length && <div><div className="mb-1 font-medium text-warn">Excluded before the model</div><ul>{s.output.excluded.map((x, i) => <li key={i} className="text-ink-muted">{x.label}: {x.reason}</li>)}</ul></div>}
          {calls.length > 0 && <div><div className="mb-1 font-medium">Model gateway</div>
            <ul className="grid gap-0.5">{calls.map((c, i) => <li key={i} className="text-ink-muted"><Badge tone={c.outcome === "ok" || c.outcome === "cached" ? "ok" : c.outcome === "blocked" ? "warn" : "crit"}>{c.outcome}</Badge> {c.provider} · {c.model}{c.outcome === "ok" && ` · ${c.tokens_in}+${c.tokens_out} tokens · ${(c.latency_ms / 1000).toFixed(1)} s · USD ${c.cost_usd.toFixed(4)}`}{c.reason && ` · ${c.reason}`}</li>)}</ul>
          </div>}
          {s.output.modelText && <div><div className="mb-1 font-medium">Raw model text (before the citation check)</div><p className="whitespace-pre-wrap break-words text-ink-faint">{s.output.modelText}</p></div>}
        </div>
      )}
    </Panel>
  );
}

/* ---------- options (recommendations) ---------- */
interface Rec {
  id: string; option_key: string; title: string; description: string; rank: number; baseRank: number; score: number; base_score: number;
  learned: { votes: number; entries: number; adjustment: number }; effect: { var_90d: { base: number; with: number; delta: number; p10: [number, number]; p90: [number, number] }; resilience: { base: number; with: number; delta: number }; shortfall_72h: { base: number; with: number; delta: number }; input_hash: string; basis: string; burden: number; score_formula: string };
  confidence: { band: string; components: Array<{ key: string; label: string; level: string; basis: string }> }; effectiveBand: string;
  confidenceAdjustment: { from_band: string; to_band: string; reason: string; actor_label: string; actor_role: string; created_at: string } | null;
  constraints: string[]; owner_role: string; authority: string; governance: { result: string; checks: Array<{ rule: string; result: string; detail: string }> };
  feedback: Array<{ vote: number; reason: string; actor_label: string; actor_role: string; created_at: string }>; driver_changes: Record<string, number>;
}
const RULE_LABEL: Record<string, string> = { no_external_action: "No external action", authority: "Decision authority", separation_of_duties: "Separation of duties", evidence_sufficiency: "Evidence sufficiency", assumption_disclosure: "Assumptions disclosed" };

export function OptionsPanel({ caseKey }: { caseKey: string }) {
  const [d, setD] = useState<{ run: { started_at: string; requested_by_label: string } | null; recommendations: Rec[] } | null>(null);
  const load = useCallback(() => api<{ run: { started_at: string; requested_by_label: string } | null; recommendations: Rec[] }>(`/cases/${caseKey}/recommendations`).then((r) => r.ok && setD(r.data)), [caseKey]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="h-60 animate-pulse rounded-lg bg-surface-2" />;
  if (!d.run) return <Panel className="p-6 text-center text-ink-muted">No options yet. Run the agent analysis on the Agents tab; options are scored with the scenario engine.</Panel>;
  return (
    <div className="grid gap-4">
      <Panel className="flex flex-wrap items-center gap-3 border-warn/40 bg-warn-soft p-3 text-[13px] text-warn"><ShieldCheck className="size-4" />Recommendations only. Each option needs a named human decision; nothing executes from TIGERIS.</Panel>
      <ol className="grid gap-3">{d.recommendations.map((r) => <OptionCard key={r.id} r={r} onChange={load} />)}</ol>
      <BriefPanel caseKey={caseKey} />
    </div>
  );
}

function OptionCard({ r, onChange }: { r: Rec; onChange: () => void }) {
  const can = useCan();
  const [vote, setVote] = useState<1 | -1 | null>(null);
  const [reason, setReason] = useState("");
  const [adjust, setAdjust] = useState(false);
  const [band, setBand] = useState(r.effectiveBand === "low" ? "medium" : "low");
  const [msg, setMsg] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const moved = r.rank !== r.baseRank;
  async function sendVote() {
    const res = await api<{ rankBefore: number; rankAfter: number }>(`/recommendations/${r.id}/feedback`, { json: { vote, reason } });
    setMsg(res.ok ? `Feedback recorded. Rank ${res.data.rankBefore} → ${res.data.rankAfter}.` : res.message);
    if (res.ok) { setVote(null); setReason(""); onChange(); }
  }
  async function sendAdjust() {
    const res = await api(`/confidence-adjustments`, { json: { targetType: "recommendation", targetId: r.id, toBand: band, reason } });
    setMsg(res.ok ? "Adjustment recorded." : res.message);
    if (res.ok) { setAdjust(false); setReason(""); onChange(); }
  }
  const steps = { low: 1, medium: 2, high: 3 }[r.effectiveBand as "low"] ?? 1;
  return (
    <li>
      <Panel className="grid gap-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-primary-soft font-serif text-[18px] font-semibold text-accent" aria-label={`Rank ${r.rank}`}>{r.rank}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[16px] font-semibold">{r.title}</h3>
              <Badge tone={r.governance.result === "PASS" ? "ok" : "warn"}>{r.governance.result === "PASS" ? <ShieldCheck /> : <AlertTriangle />}Policy {r.governance.result}</Badge>
              {moved && <Badge tone="info">Moved from #{r.baseRank} by feedback</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-ink-muted">{r.description}</p>
          </div>
          <div className="text-end">
            <div className="tabular text-[20px] font-semibold">{r.score.toFixed(1)}</div>
            <div className="text-[11px] text-ink-faint">score{r.learned.adjustment ? ` (${r.base_score.toFixed(1)} ${r.learned.adjustment > 0 ? "+" : "−"} ${Math.abs(r.learned.adjustment)} learned)` : ""}</div>
          </div>
        </div>
        <dl className="grid gap-3 text-[12.5px] sm:grid-cols-3">
          <div><dt className="text-ink-faint">90-day value at risk</dt><dd className="tabular">{fmtUsd(r.effect.var_90d.base)} → <span className="font-medium text-ink">{fmtUsd(r.effect.var_90d.with)}</span></dd></div>
          <div><dt className="text-ink-faint">Resilience score</dt><dd className="tabular">{r.effect.resilience.base.toFixed(0)} → <span className="font-medium text-ink">{r.effect.resilience.with.toFixed(0)}</span></dd></div>
          <div><dt className="text-ink-faint">Net shortfall, first 72 h</dt><dd className="tabular">{r.effect.shortfall_72h.base.toFixed(1)} → <span className="font-medium text-ink">{r.effect.shortfall_72h.with.toFixed(1)}</span> mb/d</dd></div>
        </dl>
        <p className="text-[12px] text-ink-faint">Effect basis: {r.effect.basis}. Engine input {r.effect.input_hash.slice(0, 12)}.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex gap-0.5" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={cn("h-2 w-5 rounded-sm", i <= steps ? "bg-primary" : "bg-surface-3")} />)}</span>
              <span className="text-[12.5px] font-medium">Confidence: {r.effectiveBand}</span>
              {r.confidenceAdjustment && <Badge tone="info">Expert adjusted from {r.confidenceAdjustment.from_band}</Badge>}
            </div>
            <ul className="grid gap-0.5">{r.confidence.components.map((c) => <li key={c.key} className="grid grid-cols-[120px_56px_1fr] gap-2 text-[12px]"><span className="text-ink-muted">{c.label}</span><span className={cn("font-medium", c.level === "high" ? "text-ok" : c.level === "medium" ? "text-info" : "text-warn")}>{c.level}</span><span className="text-ink-faint">{c.basis}</span></li>)}</ul>
            {r.confidenceAdjustment && <p className="text-[12px] text-ink-muted">{r.confidenceAdjustment.actor_label} ({r.confidenceAdjustment.actor_role.replace("_", " ")}): “{r.confidenceAdjustment.reason}”</p>}
          </div>
          <div className="grid content-start gap-1 text-[12.5px]">
            <div><span className="text-ink-faint">Owner:</span> {r.owner_role.replace("_", " ")} · <span className="text-ink-faint">Decision by:</span> {r.authority}</div>
            <ul className="list-disc ps-4 text-ink-muted">{r.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </div>
        <button type="button" onClick={() => setDetails((x) => !x)} aria-expanded={details} className="flex items-center gap-1 justify-self-start text-[12px] text-accent hover:underline">{details ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 rtl:rotate-180" />}Policy checks, score and feedback</button>
        {details && (
          <div className="grid gap-2 rounded-md border border-line bg-surface-2 p-3 text-[12.5px]">
            <ul className="grid gap-1">{r.governance.checks.map((c) => <li key={c.rule} className="grid grid-cols-[150px_56px_1fr] gap-2"><span className="text-ink-muted">{RULE_LABEL[c.rule] ?? c.rule}</span><span className={c.result === "PASS" ? "text-ok" : "text-warn"}>{c.result}</span><span className="text-ink-faint">{c.detail}</span></li>)}</ul>
            <p className="text-ink-faint">Score = {r.effect.score_formula}. Learned adjustment: 4 points per net vote on this kind of option across the institution, capped at 12 ({r.learned.entries} feedback entr{r.learned.entries === 1 ? "y" : "ies"}).</p>
            {r.feedback.length > 0 && <ul className="grid gap-0.5">{r.feedback.map((f, i) => <li key={i} className="text-ink-muted">{f.vote > 0 ? "▲" : "▼"} {f.actor_label} ({f.actor_role.replace("_", " ")}): “{f.reason}”</li>)}</ul>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {can("case.comment") && <>
            <Button size="sm" variant={vote === 1 ? "primary" : "secondary"} onClick={() => setVote(vote === 1 ? null : 1)} aria-pressed={vote === 1}><ThumbsUp />Useful</Button>
            <Button size="sm" variant={vote === -1 ? "primary" : "secondary"} onClick={() => setVote(vote === -1 ? null : -1)} aria-pressed={vote === -1}><ThumbsDown />Not useful</Button>
          </>}
          {can("evidence.dispose") && <Button size="sm" variant="ghost" onClick={() => setAdjust((a) => !a)} aria-pressed={adjust}>Adjust confidence</Button>}
          {msg && <span role="status" className="text-[12px] text-ink-muted">{msg}</span>}
        </div>
        {(vote !== null || adjust) && (
          <div className="flex flex-wrap items-end gap-2">
            {adjust && <label className="grid gap-1 text-[12px] text-ink-muted">New band<select value={band} onChange={(e) => setBand(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink">{["low", "medium", "high"].filter((b) => b !== r.effectiveBand).map((b) => <option key={b}>{b}</option>)}</select></label>}
            <label className="grid flex-1 gap-1 text-[12px] text-ink-muted">Reason (recorded and audited)<input value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink" placeholder={adjust ? "Why the confidence should change" : "Why this option is or is not useful"} /></label>
            <Button size="sm" variant="primary" disabled={reason.trim().length < 5} onClick={adjust ? sendAdjust : sendVote}>Record</Button>
          </div>
        )}
      </Panel>
    </li>
  );
}

/* ---------- executive brief ---------- */
interface Brief { id: string; version: number; content_hash: string; created_by_label: string; created_at: string; content: { title: string; classification: string; status: string; sections: Array<{ heading: string; writer: string; sentences: Array<{ text: string; status: string; reason: string | null; sources: Array<{ kind: string; ref: string | null; label: string; text: string }> }> }> } }
export function BriefPanel({ caseKey }: { caseKey: string }) {
  const can = useCan();
  const [b, setB] = useState<Brief | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { api<{ brief: Brief | null }>(`/cases/${caseKey}/brief`).then((r) => setB(r.ok ? r.data.brief : null)); }, [caseKey]);
  if (!b) return null;
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow text-ink-faint">Executive brief</div>
          <div className="font-semibold">Version {b.version} · {b.content.classification} · {formatDate(b.created_at, true)}</div>
          <div className="text-[12px] text-ink-faint">{b.created_by_label} · hash {b.content_hash.slice(0, 12)}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}><FileText />{open ? "Hide brief" : "Read brief"}</Button>
          {can("export.create") ? <ExportMenu caseKey={caseKey} /> : <Badge>Export needs the export permission</Badge>}
        </div>
      </div>
      {open && (
        <article className="mt-4 grid gap-4 border-t border-line pt-4">
          <p className="rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">{b.content.status}</p>
          {b.content.sections.filter((s) => s.sentences.length).map((s) => (
            <section key={s.heading}>
              <h4 className="mb-1 text-[15px] font-semibold">{s.heading} <span className="ms-1 align-middle"><WriterBadge writer={s.writer} /></span></h4>
              <p className="font-serif text-[14.5px] leading-relaxed">
                {s.sentences.map((x, i) => <span key={i} className={cn(x.status === "unverified" && "rounded-sm bg-warn-soft px-0.5 text-warn")} title={x.sources.map((y) => `${y.label}: ${y.text}`).join("\n") || x.reason || ""}>{x.status === "unverified" && <span className="me-1 text-[10px] font-semibold uppercase">Unverified</span>}{x.text} </span>)}
              </p>
            </section>
          ))}
        </article>
      )}
    </Panel>
  );
}

/* ---------- Ask TIGERIS (inside a case only) ---------- */
interface AskItem { id: string; question: string; requested_by_label: string; started_at: string; text: Sentence[]; sources: Src[]; writer: string; fallback_reason: string | null; summary: { answerable?: boolean } }
export function AskPanel({ caseKey }: { caseKey: string }) {
  const { providers, defaultProvider } = useProviders();
  const [provider, setProvider] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<AskItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api<{ history: AskItem[] }>(`/cases/${caseKey}/ask`).then((r) => r.ok && setItems(r.data.history)), [caseKey]);
  useEffect(() => { load(); }, [load]);
  async function ask(question: string) {
    setBusy(true); setErr(null);
    const r = await api(`/cases/${caseKey}/ask`, { json: { question, provider: provider ?? defaultProvider } });
    setBusy(false);
    if (!r.ok) setErr(r.message); else { setQ(""); load(); }
  }
  const examples = ["What is the 90-day value at risk and its range?", "Which option scores best, and why?", "Which inputs are simulated or synthetic?", "What did the agents challenge?"];
  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <h3 className="text-[17px] font-semibold">Ask TIGERIS</h3>
        <p className="mt-1 text-[13px] text-ink-muted">Answers come only from this case's records: its signals, evidence, scenario results, options and agent challenges. Every sentence carries its source or is marked unverified. A question the records cannot answer gets that answer.</p>
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length > 2) ask(q.trim()); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question about this case" placeholder="Ask about this case…" className="h-9 min-w-[260px] flex-1 rounded-md border border-line bg-surface-2 px-3 text-[13.5px]" />
          <ProviderPicker value={provider ?? defaultProvider} onChange={setProvider} providers={providers} />
          <Button variant="primary" type="submit" disabled={busy || q.trim().length < 3}><Send />{busy ? "Answering…" : "Ask"}</Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">{examples.map((x) => <button key={x} type="button" disabled={busy} onClick={() => { setQ(x); ask(x); }} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-muted hover:border-line-strong hover:text-ink">{x}</button>)}</div>
        {err && <p role="alert" className="mt-2 text-[12.5px] text-crit">{err}</p>}
      </Panel>
      {items.map((it) => (
        <Panel key={it.id} className="grid gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint"><span className="font-medium text-ink">{it.question}</span><span className="ms-auto">{it.requested_by_label} · {formatDate(it.started_at, true)}</span></div>
          <div className="flex flex-wrap items-center gap-2"><WriterBadge writer={it.writer} />{it.summary?.answerable === false && <Badge tone="warn">Not answerable from this case</Badge>}</div>
          <CheckedText text={it.text} sources={it.sources} className="text-[14px]" />
          {it.fallback_reason && <p className="text-[11.5px] text-ink-faint">{it.fallback_reason}</p>}
        </Panel>
      ))}
    </div>
  );
}

/* ---------- graph questions ---------- */
interface GraphAnswer { interpretation: { parser: string; intent?: string; from?: string; to?: string; fromEntity?: { name: string; type: string } | null; toEntity?: { name: string; type: string } | null }; writer: string; text: Sentence[]; sources: Src[] }
export function GraphAsk() {
  const { providers, defaultProvider } = useProviders();
  const [provider, setProvider] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<GraphAnswer | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function ask(question: string) {
    setBusy(true); setErr(null);
    const r = await api<GraphAnswer>(`/graph/ask`, { json: { question, provider: provider ?? defaultProvider } });
    setBusy(false);
    if (r.ok) setA(r.data); else setErr(r.message);
  }
  const INTENT: Record<string, string> = { path: "Shortest path", exposure: "Exposure (impact traversal)", neighbours: "Direct relationships" };
  return (
    <Panel className="p-4">
      <div className="eyebrow text-ink-faint">Ask the graph</div>
      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length > 2) ask(q.trim()); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question about the graph" placeholder="e.g. Which holdings are exposed to Strait of Hormuz?" className="h-9 min-w-[260px] flex-1 rounded-md border border-line bg-surface-2 px-3 text-[13.5px]" />
        <ProviderPicker value={provider ?? defaultProvider} onChange={setProvider} providers={providers} />
        <Button variant="primary" type="submit" disabled={busy || q.trim().length < 3}><Send />{busy ? "Working…" : "Ask"}</Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["What is the path between Strait of Hormuz and Jebel Ali?", "Which holdings are exposed to Bab el-Mandeb?", "What is connected to Ras Tanura?"].map((x) => <button key={x} type="button" disabled={busy} onClick={() => { setQ(x); ask(x); }} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-muted hover:border-line-strong hover:text-ink">{x}</button>)}
      </div>
      {err && <p role="alert" className="mt-2 text-[12.5px] text-crit">{err}</p>}
      {a && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3">
          <p className="text-[12px] text-ink-muted">
            Read as: <span className="text-ink">{INTENT[a.interpretation.intent ?? ""] ?? "not understood"}</span>
            {a.interpretation.fromEntity && <> · from <span className="text-ink">{a.interpretation.fromEntity.name}</span></>}
            {a.interpretation.toEntity && <> · to <span className="text-ink">{a.interpretation.toEntity.name}</span></>}
            {" "}· parsed by {a.interpretation.parser === "rules" ? "rules" : a.interpretation.parser.replace("local", "the local model")}. The query itself is deterministic.
          </p>
          <div className="flex items-center gap-2"><WriterBadge writer={a.writer} /></div>
          <CheckedText text={a.text} sources={a.sources} className="text-[13.5px]" />
        </div>
      )}
    </Panel>
  );
}

/** Export audiences come from the active policy; the server applies redaction and refuses audiences the role may not release. */
function ExportMenu({ caseKey }: { caseKey: string }) {
  const [audience, setAudience] = useState("internal");
  const [err, setErr] = useState<string | null>(null);
  async function download() {
    setErr(null);
    const res = await fetch(`/api/cases/${caseKey}/brief.pdf?audience=${audience}`, { credentials: "same-origin" });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.message ?? "Export refused."); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `${caseKey}-brief-${audience}.pdf`; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex gap-2">
        <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Export version" className="h-9 rounded-md border border-line bg-surface-2 px-2 text-[13px]">
          <option value="internal">Internal (full)</option>
          <option value="board">Board pack (values withheld)</option>
          <option value="partner">External partner (redacted)</option>
        </select>
        <Button variant="primary" onClick={download}><Download />Download PDF</Button>
      </div>
      {err && <p role="alert" className="text-[12px] text-crit">{err}</p>}
    </div>
  );
}
