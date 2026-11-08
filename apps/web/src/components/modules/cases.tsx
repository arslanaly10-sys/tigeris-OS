"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUnsavedWarning } from "@/lib/forms";
import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronRight, MessageSquare, ShieldAlert } from "lucide-react";
import { CASE_STATES, ROLE_LABELS, type CaseState, type Role } from "@tigeris/shared";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ClaimBadge, ValidationBadge } from "../labels";
import { FactValue } from "../lineage";
import { useSession } from "../session-context";
import { ConfidenceBand, ModeBadge, URGENCY_TONE, type Confidence } from "./signals";
import { PathList, typeLabel, type Paths } from "./graph";
import { ScenarioWorkspace } from "../scenarios";
import { AgentAnalysis, AskPanel, OptionsPanel } from "../agents";
import { DecisionPanel } from "../decisions-ui";
import { cn } from "@/lib/cn";
import { usePrefs } from "../prefs";
import type { I18nKey } from "@/lib/i18n";

const STATE_LABEL: Record<CaseState, string> = { detected: "Detected", triaged: "Triaged", analysis: "Analysis", scenario: "Scenario", review: "Review", decision: "Decision", handoff: "Handoff", closed: "Closed" };
const DEPTH_LABEL: Record<string, string> = { full: "Full case", medium: "Medium case", short: "Short case" };

export function StateTrack({ state }: { state: CaseState }) {
  const { t } = usePrefs();
  const idx = CASE_STATES.indexOf(state);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={`Case state: ${STATE_LABEL[state]}`}>
      {CASE_STATES.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span className={cn("rounded px-2 py-0.5 text-[11.5px]", i < idx ? "bg-surface-3 text-ink-muted" : i === idx ? "bg-primary font-semibold text-primary-ink" : "text-ink-faint")} aria-current={i === idx ? "step" : undefined}>{t(`case.state.${s}` as I18nKey)}</span>
          {i < CASE_STATES.length - 1 && <ChevronRight className="size-3 text-ink-faint rtl:rotate-180" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

interface CaseRow { id: string; case_key: string; title: string; domain: string; depth: string; state: CaseState; closure: string | null; owner_label: string; last_activity_at: string; signals: number; comments: number }

export function CasesList() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [next, setNext] = useState<Record<string, Role[]>>({});
  useEffect(() => { api<{ cases: CaseRow[]; nextActor: Record<string, Role[]> }>("/cases").then((r) => { if (r.ok) { setRows(r.data.cases); setNext(r.data.nextActor); } }); }, []);
  return (
    <>
      <PageHeader nav="nav.cases" description="The primary work object. Each case keeps its signals, evidence, impact paths, scenarios, options, decision and memory together, with a full history." />
      <Panel>
        <PanelHeader eyebrow="Cases" title="All cases" actions={rows && <Badge className="tabular">{rows.filter((r) => r.state !== "closed").length} open</Badge>} />
        {!rows && <div className="m-4 h-64 animate-pulse rounded bg-surface-2" />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Case", "State", "Waiting for", "Owner", "Activity", ""].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows?.map((c) => (
                <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3"><Link href={`/cases/${c.case_key}`} className="font-medium hover:underline">{c.title}</Link><div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint"><span translate="no" className="font-mono">{c.case_key}</span> · {DEPTH_LABEL[c.depth]} · {c.domain.replace(/_/g, " ")}</div></td>
                  <td className="px-4 py-3"><Badge tone={c.state === "closed" ? "neutral" : c.state === "decision" ? "warn" : "info"}>{STATE_LABEL[c.state]}{c.closure ? ` · ${c.closure.replace("_", " ")}` : ""}</Badge></td>
                  <td className="px-4 py-3 text-ink-muted">{(next[c.state] ?? []).map((r) => ROLE_LABELS[r]).join(" or ") || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.owner_label}</td>
                  <td className="px-4 py-3 tabular text-ink-muted">{formatDate(c.last_activity_at, true)}</td>
                  <td className="px-4 py-3 text-ink-faint"><span className="flex items-center gap-2 text-[12px]">{c.signals > 0 && <span>{c.signals} signal{c.signals > 1 ? "s" : ""}</span>}{c.comments > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="size-3" />{c.comments}</span>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

interface CaseDetail {
  case: { id: string; case_key: string; title: string; objective: string; domain: string; depth: string; state: CaseState; closure: string | null; sensitivity: string; owner_label: string; created_by_label: string; created_at: string; last_activity_at: string; situation: string; why_it_matters: string; open_questions: string[]; version: number };
  transitions: { to: CaseState; label: string; roles: Role[]; needsRationale: boolean; allowed: boolean }[];
  nextActor: Role[];
  signals: { id: string; title: string; urgency: string; data_mode: string; confidence: Confidence; event_time: string }[];
  evidence: { evidence_id: string; title: string; validation_state: string; data_class: string; source_name: string; note: string | null; added_by_label: string; fact_id: string | null; predicate_label: string | null; value_num: number | null; unit: string | null; period: string | null; claim_class: string | null }[];
  entities: { role: string; key: string; name: string; type: string; claim_class: string }[];
  events: { kind: string; from_state: string | null; to_state: string | null; actor_label: string; actor_role: string | null; rationale: string | null; occurred_at: string; payload: { label?: string; mentions?: number } }[];
  comments: { id: string; author_label: string; author_role: string; body: string; created_at: string }[];
  linked: { case_key: string; title: string; state: string } | null;
  impact: Paths | null;
}

const TABS = ["Situation", "Evidence", "Impact graph", "Scenarios", "Agents", "Options", "Ask TIGERIS", "Decision and memory", "Discussion", "History"] as const;
type Tab = (typeof TABS)[number];

export function CaseWorkspace({ caseKey }: { caseKey: string }) {
  const s = useSession();
  const { t: tr } = usePrefs();
  const [d, setD] = useState<CaseDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openTab = (t: Tab) => { setTab(t); router.replace(t === "Situation" ? pathname : `${pathname}?tab=${encodeURIComponent(t)}`, { scroll: false }); };
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "Situation");
  const load = useCallback(() => api<CaseDetail>(`/cases/${caseKey}`).then((r) => (r.ok ? setD(r.data) : setErr(r.message))), [caseKey]);
  useEffect(() => { load(); }, [load]);
  if (err) return <Panel role="alert" className="border-crit/40 bg-crit-soft p-4 text-crit">{err}</Panel>;
  if (!d) return <div className="h-96 animate-pulse rounded-lg bg-surface-2" />;
  const c = d.case;
  return (
    <>
      <div className="mb-5 grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
          <Link href="/cases" className="hover:underline">Intelligence Cases</Link><ChevronRight className="size-3 rtl:rotate-180" /><span translate="no" className="font-mono">{c.case_key}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-[30px] font-semibold leading-tight">{c.title}</h1>
            <p className="mt-1 text-ink-muted">{c.objective}</p>
          </div>
          <div className="flex flex-wrap gap-1.5"><Badge>{DEPTH_LABEL[c.depth]}</Badge><Badge tone="warn">{c.sensitivity}</Badge><Badge>v{c.version}</Badge></div>
        </div>
        <StateTrack state={c.state} />
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-muted">
          <span>Owner: <span className="text-ink">{c.owner_label}</span></span>
          <span>Opened by {c.created_by_label} · {formatDate(c.created_at, true)}</span>
          <span>Last activity {formatDate(c.last_activity_at, true)}</span>
          {d.linked && <Link href={`/cases/${d.linked.case_key}`} className="text-accent hover:underline">Linked: {d.linked.case_key} · {d.linked.title}</Link>}
        </div>
      </div>

      <TransitionBar d={d} onDone={load} role={s.principal.role} />

      <div role="tablist" aria-label="Case workspace" className="sticky top-[52px] z-10 -mx-1 mb-6 mt-6 flex flex-wrap gap-x-1 border-b border-line bg-bg/90 px-1 backdrop-blur-md">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => openTab(t)} className={cn("-mb-px border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors", tab === t ? "border-primary text-ink" : "border-transparent text-ink-faint hover:border-line-strong hover:text-ink")}>
            {tr(`case.tab.${t}` as I18nKey)}{t === "Discussion" && d.comments.length ? ` (${d.comments.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Situation" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel className="grid gap-4 p-5 text-[14px]">
            <div><div className="eyebrow mb-1 text-ink-faint">What changed</div><p>{c.situation}</p></div>
            <div><div className="eyebrow mb-1 text-ink-faint">Why it matters</div><p>{c.why_it_matters}</p></div>
            {c.open_questions.length > 0 && <div><div className="eyebrow mb-1 text-ink-faint">Unresolved questions</div><ul className="grid list-disc gap-1 ps-5">{c.open_questions.map((q) => <li key={q}>{q}</li>)}</ul></div>}
          </Panel>
          <div className="grid h-fit gap-5">
            <Panel>
              <PanelHeader eyebrow="Signals" title="What raised this case" />
              {d.signals.length === 0 && <p className="p-4 text-[13px] text-ink-muted">Opened without a signal (requested directly).</p>}
              <ul className="divide-y divide-line">{d.signals.map((sg) => <li key={sg.id} className="grid gap-1.5 px-4 py-3"><div className="flex flex-wrap gap-1.5"><Badge tone={URGENCY_TONE[sg.urgency]}>{sg.urgency}</Badge><ModeBadge mode={sg.data_mode} /></div><Link href={`/signals?focus=${sg.id}`} className="font-medium hover:underline">{sg.title}</Link><ConfidenceBand c={sg.confidence} compact /></li>)}</ul>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Graph" title="Entities in scope" />
              <ul className="flex flex-wrap gap-1.5 p-4">{d.entities.map((e) => <li key={e.key}><Link href={`/graph?focus=${encodeURIComponent(e.key)}`}><Badge tone={e.role === "origin" ? "crit" : e.role === "alternative" ? "ok" : "info"}>{e.role}: {e.name}</Badge></Link></li>)}{d.entities.length === 0 && <li className="text-[13px] text-ink-muted">None linked.</li>}</ul>
            </Panel>
          </div>
        </div>
      )}

      {tab === "Evidence" && (
        <Panel>
          <PanelHeader eyebrow="Evidence" title="Attached evidence" actions={<Link href="/sources" className="text-[13px] text-accent hover:underline">Browse Data & Sources</Link>} />
          {d.evidence.length === 0 && <p className="p-4 text-[13px] text-ink-muted">No evidence attached yet. A case needs at least one signal or evidence record before review.</p>}
          <ul className="divide-y divide-line">
            {d.evidence.map((e, i) => (
              <li key={i} className="grid gap-1 px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{e.title}</span><ValidationBadge state={e.validation_state} /></div>
                <div className="text-[12px] text-ink-muted">{e.source_name} · added by {e.added_by_label}{e.note ? ` · ${e.note}` : ""}</div>
                {e.fact_id && <div className="flex items-center gap-2">{e.predicate_label}{e.period ? ` (${e.period})` : ""}: <FactValue id={e.fact_id} value={e.value_num} unit={e.unit} />{e.claim_class && <ClaimBadge claim={e.claim_class} />}</div>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === "Impact graph" && (
        <Panel className="p-5">
          {d.impact ? <PathList paths={d.impact} onSelect={(k) => (window.location.href = `/graph?focus=${encodeURIComponent(k)}`)} /> : <p className="text-ink-muted">No origin entity in scope.</p>}
        </Panel>
      )}

      {tab === "Scenarios" && <ScenarioWorkspace caseKey={c.case_key} />}
      {tab === "Agents" && <AgentAnalysis caseKey={c.case_key} onDone={load} />}
      {tab === "Options" && <OptionsPanel caseKey={c.case_key} />}
      {tab === "Ask TIGERIS" && <AskPanel caseKey={c.case_key} />}

      {tab === "Decision and memory" && <DecisionPanel caseKey={c.case_key} onChange={load} />}

      {tab === "Discussion" && <Discussion d={d} onDone={load} />}

      {tab === "History" && (
        <Panel>
          <PanelHeader eyebrow="Append-only" title="Case history" />
          <ol className="divide-y divide-line">
            {d.events.map((e, i) => (
              <li key={i} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-[13px]">
                <span className="tabular text-ink-faint">{formatDate(e.occurred_at, true)}</span>
                <span>
                  {e.kind === "transition" ? <>Moved from <b>{STATE_LABEL[e.from_state as CaseState]}</b> to <b>{STATE_LABEL[e.to_state as CaseState]}</b></> : e.kind === "created" ? "Case opened" : e.kind === "comment" ? `Comment${e.payload.mentions ? ` mentioning ${e.payload.mentions}` : ""}` : e.kind.replace(/_/g, " ")}
                  <span className="text-ink-muted"> · {e.actor_label}{e.actor_role ? ` (${e.actor_role.replace("_", " ")})` : ""}</span>
                  {e.rationale && <span className="block text-[12.5px] text-ink-muted">&ldquo;{e.rationale}&rdquo;</span>}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </>
  );
}

function TransitionBar({ d, onDone, role }: { d: CaseDetail; onDone: () => void; role: Role }) {
  const [rationale, setRationale] = useState("");
  const [result, setResult] = useState<{ result: string; explanation: string; rule: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const needsRationale = useMemo(() => d.transitions.some((t) => t.allowed && t.needsRationale), [d.transitions]);
  async function move(to: CaseState) {
    setBusy(true);
    const r = await fetch(`/api/cases/${d.case.case_key}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, rationale: rationale || undefined }) });
    const body = await r.json();
    setBusy(false);
    setResult(body.policy ?? { result: "BLOCK", explanation: body.message, rule: "" });
    if (r.ok) { setRationale(""); onDone(); }
  }
  if (d.case.state === "closed") return <Panel className="flex items-center gap-2 p-4 text-[13px]"><CheckCircle2 className="size-4 text-ok" />Closed{d.case.closure ? ` as ${d.case.closure.replace("_", " ")}` : ""}.</Panel>;
  return (
    <Panel className="grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <span>Next step needs: <b>{d.nextActor.map((r) => ROLE_LABELS[r]).join(" or ")}</b>{d.nextActor.includes(role) ? " — that is you." : ""}</span>
        <span className="text-[12px] text-ink-faint">Moves are checked on the server and recorded in the audit trail.</span>
      </div>
      {needsRationale && <textarea autoComplete="off" id="case-rationale" aria-label="Rationale" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="e.g. Scenario assumptions reviewed with the energy team…" className="rounded-md border border-line bg-surface-2 p-2 text-[13px]" />}
      <div className="flex flex-wrap gap-2">
        {d.transitions.map((t) => (
          <Button key={t.to + t.label} size="sm" variant={t.allowed ? (t.to === "closed" && t.label !== "Record outcome and close" ? "secondary" : "primary") : "ghost"} disabled={busy} onClick={() => move(t.to)} title={t.allowed ? undefined : `Needs ${t.roles.map((r) => ROLE_LABELS[r]).join(" or ")}`}>
            {t.label}{!t.allowed && <span className="text-[11px] text-ink-faint">({t.roles.map((r) => ROLE_LABELS[r]).join("/")})</span>}
          </Button>
        ))}
      </div>
      {result && (
        <div role="status" className={cn("flex items-start gap-2 rounded-md border p-2.5 text-[13px]", result.result === "PASS" ? "border-ok/40 bg-ok-soft text-ok" : result.result === "HOLD" ? "border-warn/40 bg-warn-soft text-warn" : "border-crit/40 bg-crit-soft text-crit")}>
          {result.result === "PASS" ? <CheckCircle2 className="size-4 shrink-0" /> : <ShieldAlert className="size-4 shrink-0" />}
          <span><b className="font-mono">{result.result}</b> {result.explanation}{result.rule ? <span className="ms-1 font-mono text-[11px] opacity-80">({result.rule})</span> : null}</span>
        </div>
      )}
    </Panel>
  );
}

function Discussion({ d, onDone }: { d: CaseDetail; onDone: () => void }) {
  const s = useSession();
  const [body, setBody] = useState("");
  useUnsavedWarning(body.trim().length > 0);
  const [mentions, setMentions] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  async function send() {
    const r = await api<{ mentions: number }>(`/cases/${d.case.case_key}/comments`, { json: { body, mentions } });
    if (!r.ok) return setErr(r.message);
    setBody(""); setMentions([]); onDone();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHeader eyebrow="Discussion" title="Comments" />
        {d.comments.length === 0 && <p className="p-4 text-[13px] text-ink-muted">No comments yet.</p>}
        <ul className="divide-y divide-line">{d.comments.map((c) => <li key={c.id} className="grid gap-1 px-4 py-3 text-[13px]"><div className="text-[12px] text-ink-muted"><b className="text-ink">{c.author_label}</b> · {c.author_role.replace("_", " ")} · {formatDate(c.created_at, true)}</div><p className="whitespace-pre-wrap">{c.body}</p></li>)}</ul>
      </Panel>
      <Panel className="grid h-fit gap-3 p-4">
        <label htmlFor="comment-body" className="font-medium">Add a comment</label>
        <textarea autoComplete="off" id="comment-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-md border border-line bg-surface-2 p-2 text-[13px]" />
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-[12px] text-ink-muted">Mention colleagues (they are notified)</legend>
          {s.roleSwitch.filter((p) => p.id !== s.principal.id).map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={mentions.includes(p.id)} onChange={(e) => setMentions((m) => (e.target.checked ? [...m, p.id] : m.filter((x) => x !== p.id)))} />{p.name} <span className="text-ink-faint">· {ROLE_LABELS[p.role]}</span></label>
          ))}
        </fieldset>
        <Button variant="primary" size="sm" disabled={!body.trim()} onClick={send}>Post comment</Button>
        {err && <p role="alert" className="text-[12px] text-crit">{err}</p>}
      </Panel>
    </div>
  );
}

export { typeLabel };
