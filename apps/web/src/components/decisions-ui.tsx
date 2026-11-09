"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BookMarked, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Gavel, History, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { verdict } from "@/lib/format";
import { requireText, clearInvalid, useUnsavedWarning } from "@/lib/forms";
import { formatDate, num } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan, useSession } from "./session-context";
import { PrecedentList, type Hit } from "./memory-ui";

/* ---------- shared ---------- */
interface RuleTrace { rule: string; description: string; applied: boolean; passed: boolean; effect: string | null; message: string | null }
export function PolicyResultBadge({ result }: { result: string }) {
  const tone = result === "PASS" ? "ok" : result === "HOLD" ? "warn" : "crit";
  return <Badge tone={tone}>{result === "PASS" ? <ShieldCheck /> : result === "HOLD" ? <AlertTriangle /> : <ShieldAlert />}{verdict(result)}</Badge>;
}
export function TraceList({ trace }: { trace: RuleTrace[] }) {
  return (
    <ul className="grid gap-0.5 text-[13px]">
      {trace.map((t) => (
        <li key={t.rule} className="grid grid-cols-[18px_220px_1fr] items-start gap-2">
          {!t.applied ? <span className="text-ink-faint" aria-label="not applicable">–</span> : t.passed ? <CheckCircle2 className="size-3.5 text-ok" aria-label="passed" /> : <XCircle className="size-3.5 text-crit" aria-label="failed" />}
          <span translate="no" className={cn("font-mono", t.applied ? "text-ink" : "text-ink-faint")}>{t.rule}</span>
          <span className={t.passed ? "text-ink-faint" : "text-warn"}>{t.message ?? (t.applied ? "passes" : "does not apply")}</span>
        </li>
      ))}
    </ul>
  );
}
const STATUS_TONE: Record<string, "ok" | "warn" | "crit" | "info" | "neutral"> = { approved: "ok", pending: "warn", rejected: "crit", deferred: "neutral", open: "neutral", in_progress: "info", done: "ok", blocked: "crit" };

/* ---------- case: Decision and memory tab ---------- */
interface Option { id: string; title: string; option_key: string; authority: string; governance: string; base_score: number; band: string; approval: { id: string; required: number; roles: string[]; description: string }; preview: { result: string; explanation: string; rule: string } }
interface Decision {
  id: string; option_title: string; outcome: string; status: string; rationale: string; required_approvals: number; approval_roles: string[]; approval_rule: string | null; policy_version: number; policy_hash: string; policy_trace: RuleTrace[]; snapshot_hash: string;
  proposed_by_label: string; proposed_by_role: string; created_at: string; finalised_at: string | null; approvals: Array<{ approver_label: string; approver_role: string; vote: string; rationale: string; created_at: string }>;
}
interface Handoff { id: string; title: string; description: string; owner_role: string; due_at: string; status: string; updates: Array<{ status: string; note: string; actor_label: string; actor_role: string; created_at: string }> }
interface DecisionData { state: string; decisions: Decision[]; handoffs: Handoff[]; options: Option[]; policy: { version: number; hash: string } }

export function DecisionPanel({ caseKey, onChange }: { caseKey: string; onChange?: () => void }) {
  const [d, setD] = useState<DecisionData | null>(null);
  const load = useCallback(() => api<DecisionData>(`/cases/${caseKey}/decision`).then((r) => r.ok && setD(r.data)), [caseKey]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { load(); onChange?.(); };
  if (!d) return <div className="h-60 animate-pulse rounded-lg bg-surface-2" />;
  const live = d.decisions.find((x) => x.status === "pending" || x.status === "approved");
  return (
    <div className="grid gap-5">
      <Panel className="flex flex-wrap items-center gap-3 p-3 text-[13px] text-ink-muted"><Gavel className="size-4 text-accent" />Every step below is checked by the active policy (v{d.policy.version}, hash {d.policy.hash}) on the server. Decisions create handoff tasks only; nothing executes from TIGERIS.</Panel>
      {!live && <RecordDecision caseKey={caseKey} data={d} onDone={refresh} />}
      {d.decisions.map((x) => <DecisionCard key={x.id} d={x} onDone={refresh} />)}
      {d.handoffs.length > 0 && <Handoffs items={d.handoffs} onDone={refresh} />}
      <CaseMemory caseKey={caseKey} />
    </div>
  );
}

function RecordDecision({ caseKey, data, onDone }: { caseKey: string; data: DecisionData; onDone: () => void }) {
  const can = useCan();
  const [opt, setOpt] = useState(data.options[0]?.id ?? "");
  const [outcome, setOutcome] = useState<"approve" | "reject" | "defer">("approve");
  const [rationale, setRationale] = useState("");
  useUnsavedWarning(rationale.trim().length > 0);
  const [res, setRes] = useState<{ ok: boolean; message: string; trace?: RuleTrace[] } | null>(null);
  if (!data.options.length) return <Panel className="p-5 text-ink-muted">No ranked options yet. Run the agent analysis first; a decision is always taken on one option.</Panel>;
  const o = data.options.find((x) => x.id === opt)!;
  async function submit() {
    const r = await api<{ decisionStatus: string; required: number; handoffs: number }>(`/cases/${caseKey}/decisions`, { json: { recommendationId: opt, outcome, rationale } });
    if (r.ok) { setRes({ ok: true, message: `Decision recorded: ${r.data.decisionStatus}${r.data.decisionStatus === "pending" ? ` — needs ${r.data.required} approvals` : ""}${r.data.handoffs ? `; ${r.data.handoffs} handoff task(s) created` : ""}.` }); setRationale(""); onDone(); }
    else {
      const body = r as unknown as { message: string };
      setRes({ ok: false, message: body.message });
    }
  }
  return (
    <Panel>
      <PanelHeader eyebrow={`Case at ${data.state}`} title="Record a named decision" />
      <div className="grid gap-4 p-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-medium">Option</legend>
          {data.options.map((x) => (
            <label key={x.id} className={cn("grid cursor-pointer grid-cols-[18px_1fr_auto] items-start gap-2 rounded-md border p-2.5 text-[13px]", opt === x.id ? "border-primary bg-primary-soft/40" : "border-line")}>
              <input type="radio" name="option" checked={opt === x.id} onChange={() => setOpt(x.id)} className="mt-1" />
              <span><span className="font-medium">{x.title}</span><br /><span className="text-[13px] text-ink-muted">Score {num(x.base_score, 1)} · confidence {x.band} · option policy {x.governance} · {x.approval.required === 1 ? "one approval" : `${x.approval.required} approvals by different people`} ({x.authority})</span></span>
              <PolicyResultBadge result={x.preview.result} />
            </label>
          ))}
        </fieldset>
        {o.preview.result !== "PASS" && <p className="rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">Preview for you: {o.preview.explanation}</p>}
        <div className="flex flex-wrap gap-4 text-[13px]">
          {(["approve", "reject", "defer"] as const).map((x) => <label key={x} className="flex items-center gap-1.5"><input type="radio" name="outcome" checked={outcome === x} onChange={() => setOutcome(x)} />{x === "approve" ? "Approve" : x === "reject" ? "Reject" : "Defer"}</label>)}
        </div>
        <label className="grid gap-1 text-[13px] text-ink-muted">Rationale (kept with the decision and on the audit trail)
          <textarea autoComplete="off" aria-label="Decision rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} className="rounded-md border border-line bg-surface-2 p-2 text-[13.5px] text-ink" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={submit} disabled={!can("decision.approve")}><Gavel />Record decision</Button>
          {!can("decision.approve") && <span className="text-[13px] text-ink-muted">Your role can read decisions; approvers and executives record them.</span>}
          {res && <span role="status" className={cn("text-[13px]", res.ok ? "text-ok" : "text-warn")}>{res.message}</span>}
        </div>
      </div>
    </Panel>
  );
}

function DecisionCard({ d, onDone }: { d: Decision; onDone: () => void }) {
  const can = useCan();
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [vote, setVote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [drift, setDrift] = useState<{ overall: string; items: Array<{ check: string; level: string; detail: string }> } | null>(null);
  const [replay, setReplay] = useState<{ identical: boolean; checks: Array<{ check: string; ok: boolean; detail: string }> } | null>(null);
  const approvals = d.approvals.filter((a) => a.vote === "approve").length;
  async function cast(v: "approve" | "reject") {
    const bad = requireText(vote, 3, `vote-${d.id}`, "Your reason");
    if (bad) { setMsg(bad); return; }
    clearInvalid(`vote-${d.id}`);
    const r = await api<{ decisionStatus: string; approvals: number; required: number }>(`/decisions/${d.id}/approvals`, { json: { vote: v, rationale: vote } });
    setMsg(r.ok ? `Recorded. ${r.data.approvals}/${r.data.required} approvals; decision ${r.data.decisionStatus}.` : r.message);
    if (r.ok) { setVote(""); onDone(); }
  }
  const voted = d.approvals.some((a) => a.approver_label === s.principal.name);
  return (
    <Panel className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Gavel className="mt-1 size-5 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-medium">{d.outcome === "approve" ? "Approve" : d.outcome === "reject" ? "Reject" : "Defer"}: {d.option_title}</h3><Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge></div>
          <p className="mt-0.5 text-[13px] text-ink-muted">Recorded by {d.proposed_by_label} ({d.proposed_by_role.replace("_", " ")}) · {formatDate(d.created_at, true)} · policy v{d.policy_version}</p>
        </div>
        {d.outcome === "approve" && <div className="text-end"><div className="tabular text-[20px] font-medium">{approvals}/{d.required_approvals}</div><div className="text-[13px] text-ink-faint">approvals</div></div>}
      </div>
      <p className="font-serif text-[14.5px]">“{d.rationale}”</p>
      {d.approvals.length > 0 && <ul className="grid gap-1 text-[13px]">{d.approvals.map((a, i) => <li key={i} className="flex flex-wrap gap-2"><Badge tone={a.vote === "approve" ? "ok" : "crit"}>{a.vote}</Badge><span>{a.approver_label} ({a.approver_role.replace("_", " ")})</span><span className="text-ink-muted">“{a.rationale}”</span><span className="ms-auto tabular text-ink-faint">{formatDate(a.created_at, true)}</span></li>)}</ul>}
      {d.status === "pending" && can("decision.approve") && !voted && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-warn/40 bg-warn-soft/40 p-3">
          <label className="grid flex-1 gap-1 text-[13px] text-ink-muted">Your reason<input autoComplete="off" id={`vote-${d.id}`} value={vote} onChange={(e) => setVote(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink" /></label>
          <Button size="sm" variant="primary" aria-label="Approve this decision" onClick={() => cast("approve")}>Approve</Button>
          <Button size="sm" variant="danger" aria-label="Reject this decision" onClick={() => cast("reject")}>Reject</Button>
        </div>
      )}
      {msg && <p role="status" className="text-[13px] text-ink-muted">{msg}</p>}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button size="sm" variant="secondary" onClick={async () => { const r = await api<typeof drift>(`/decisions/${d.id}/drift`); if (r.ok) setDrift(r.data); }}><Activity />Check for drift</Button>
        <Button size="sm" variant="secondary" onClick={async () => { const r = await api<typeof replay>(`/decisions/${d.id}/replay`, { json: {} }); if (r.ok) setReplay(r.data); }}><History />Replay decision</Button>
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap ms-auto flex items-center gap-1 text-[13px] text-accent hover:underline">{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5 rtl:rotate-180" />}Policy trace and snapshot</button>
      </div>
      {drift && (
        <div className="grid gap-1.5 rounded-md border border-line bg-surface-2 p-3 text-[13px]">
          <div className="flex items-center gap-2 font-medium">Drift since the decision <Badge tone={drift.overall === "none" ? "ok" : drift.overall === "minor" ? "warn" : "crit"}>{drift.overall === "none" ? "No drift" : drift.overall === "minor" ? "Minor drift" : "Material drift"}</Badge></div>
          <ul className="grid gap-1">{drift.items.map((i) => <li key={i.check} className="grid grid-cols-[90px_1fr] gap-2"><Badge tone={i.level === "none" ? "ok" : i.level === "minor" ? "warn" : "crit"} className="justify-self-start">{i.level}</Badge><span><span className="text-ink">{i.check}.</span> <span className="text-ink-muted">{i.detail}</span></span></li>)}</ul>
        </div>
      )}
      {replay && (
        <div className="grid gap-1.5 rounded-md border border-line bg-surface-2 p-3 text-[13px]">
          <div className="flex items-center gap-2 font-medium">Replay {replay.identical ? <Badge tone="ok"><CheckCircle2 />Identical</Badge> : <Badge tone="crit"><XCircle />Differences found</Badge>}</div>
          <ul className="grid gap-1">{replay.checks.map((c) => <li key={c.check} className="flex gap-2">{c.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" aria-label="ok" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-crit" aria-label="failed" />}<span><span className="text-ink">{c.check}.</span> <span className="text-ink-muted">{c.detail}</span></span></li>)}</ul>
        </div>
      )}
      {open && (
        <div className="grid gap-2 rounded-md border border-line bg-surface-2 p-3">
          <TraceList trace={d.policy_trace} />
          <p className="text-[13px] text-ink-faint">Approval rule: {d.approval_rule ?? "default"} ({d.required_approvals} required from {d.approval_roles.join(", ").replace(/_/g, " ")}). Policy hash {d.policy_hash.slice(0, 16)}… Snapshot hash {d.snapshot_hash.slice(0, 16)}…</p>
        </div>
      )}
    </Panel>
  );
}

function Handoffs({ items, onDone }: { items: Handoff[]; onDone: () => void }) {
  const can = useCan();
  const [edit, setEdit] = useState<string | null>(null);
  const [status, setStatus] = useState("in_progress");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function save(id: string) {
    const r = await api<{ open: number }>(`/handoffs/${id}/updates`, { json: { status, note } });
    setMsg(r.ok ? `Updated. ${r.data.open} task(s) still open.` : r.message);
    if (r.ok) { setEdit(null); setNote(""); onDone(); }
  }
  return (
    <Panel>
      <PanelHeader eyebrow="Operations handoff" title="Tasks from the approved decision" actions={<Badge className="tabular">{items.filter((h) => h.status === "done").length}/{items.length} done</Badge>} />
      <ul className="grid gap-2 p-4">
        {items.map((h) => (
          <li key={h.id} className="grid gap-1.5 rounded-md border border-line p-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2"><ClipboardList className="size-4 text-accent" /><span className="font-medium">{h.title}</span><Badge tone={STATUS_TONE[h.status]}>{h.status.replace("_", " ")}</Badge><span className="ms-auto text-[13px] text-ink-faint">Owner: {h.owner_role.replace("_", " ")} · due {formatDate(h.due_at)}</span></div>
            <p className="text-[13px] text-ink-muted">{h.description}</p>
            {h.updates.map((u, i) => <p key={i} className="text-[13px] text-ink-faint">{formatDate(u.created_at, true)} · {u.actor_label}: {u.status.replace("_", " ")} — {u.note}</p>)}
            {can("handoff.update") && h.status !== "done" && (edit === h.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <select aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-[13px]">{["in_progress", "done", "blocked"].map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</select>
                <input autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Terminal slots confirmed with the operator…" aria-label="Note" className="h-8 flex-1 rounded-md border border-line bg-surface-2 px-2 text-[13px]" />
                <Button size="sm" variant="primary" onClick={() => save(h.id)}>Save update</Button>
              </div>
            ) : <Button size="sm" variant="secondary" className="justify-self-start" onClick={() => setEdit(h.id)}>Update task</Button>)}
          </li>
        ))}
      </ul>
      {msg && <p role="status" className="px-4 pb-3 text-[13px] text-ink-muted">{msg}</p>}
    </Panel>
  );
}

interface Draft { title: string; summary: string; outcome: string; lessons: string[]; caseKey: string }
function CaseMemory({ caseKey }: { caseKey: string }) {
  const can = useCan();
  const [d, setD] = useState<{ hits: Hit[]; semantic: boolean; draft: Draft } | null>(null);
  const [form, setForm] = useState<Draft | null>(null);
  useUnsavedWarning(form !== null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<{ hits: Hit[]; semantic: boolean; draft: Draft }>(`/cases/${caseKey}/precedents`).then((r) => r.ok && setD(r.data)); }, [caseKey]);
  async function propose() {
    const r = await api<{ id: string }>(`/cases/${caseKey}/memory`, { json: { ...form, lessons: form!.lessons.filter((l) => l.trim().length > 2) } });
    setMsg(r.ok ? "Proposed. An approver or executive reviews it in Institutional Memory." : r.message);
    if (r.ok) setForm(null);
  }
  return (
    <Panel>
      <PanelHeader eyebrow="Institutional memory" title="Similar precedents" actions={can("case.edit") && d && !form && <Button size="sm" variant="secondary" onClick={() => setForm({ ...d.draft, lessons: d.draft.lessons.length ? d.draft.lessons : [""] })}><BookMarked />Propose memory entry</Button>} />
      <div className="grid gap-3 p-4">
        {!d ? <div className="h-24 animate-pulse rounded bg-surface-2" /> : <PrecedentList hits={d.hits} semantic={d.semantic} empty="No similar precedent found." />}
        {form && (
          <div className="grid gap-2 rounded-md border border-line bg-surface-2 p-3 text-[13px]">
            <p className="text-ink-muted">Draft assembled from this case's decision, handoff and agent challenges. Edit before proposing; an approver must approve it.</p>
            <label className="grid gap-1">Title<input autoComplete="off" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 rounded-md border border-line bg-surface px-2" /></label>
            <label className="grid gap-1">Summary<textarea autoComplete="off" value={form.summary} rows={3} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="rounded-md border border-line bg-surface p-2" /></label>
            <label className="grid gap-1">Outcome<textarea autoComplete="off" value={form.outcome} rows={2} onChange={(e) => setForm({ ...form, outcome: e.target.value })} className="rounded-md border border-line bg-surface p-2" /></label>
            {form.lessons.map((l, i) => <label key={i} className="grid gap-1">Lesson {i + 1}<input autoComplete="off" value={l} onChange={(e) => setForm({ ...form, lessons: form.lessons.map((x, j) => (j === i ? e.target.value : x)) })} className="h-8 rounded-md border border-line bg-surface px-2" /></label>)}
            <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setForm({ ...form, lessons: [...form.lessons, ""] })}>Add lesson</Button><Button size="sm" variant="primary" onClick={propose}>Propose</Button><Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button></div>
          </div>
        )}
        {msg && <p role="status" className="text-ink-muted">{msg}</p>}
      </div>
    </Panel>
  );
}

/* ---------- Decision Authority module ---------- */
interface DecisionRow { id: string; option_title: string; outcome: string; status: string; required_approvals: number; approvals: number; open_handoffs: number; proposed_by_label: string; created_at: string; case_key: string; case_title: string; policy_version: number }
export function DecisionsModule() {
  const [rows, setRows] = useState<DecisionRow[] | null>(null);
  const [drift, setDrift] = useState<Record<string, string>>({});
  useEffect(() => { api<{ decisions: DecisionRow[] }>("/decisions").then((r) => r.ok && setRows(r.data.decisions)); }, []);
  async function check(id: string) {
    setDrift((d) => ({ ...d, [id]: "checking" }));
    const r = await api<{ overall: string }>(`/decisions/${id}/drift`);
    setDrift((d) => ({ ...d, [id]: r.ok ? r.data.overall : "error" }));
  }
  return (
    <>
      <PageHeader nav="nav.decisions" description="Every named decision across the institution: who decided, under which policy version, how many approvals it needed, whether its handoff is complete, and whether anything it rested on has changed since." />
      <Panel>
        <PanelHeader eyebrow="Decisions" title="Decision register" actions={rows && <Badge className="tabular">{rows.length}</Badge>} />
        {!rows ? <div className="m-4 h-32 animate-pulse rounded bg-surface-2" /> : !rows.length ? <p className="geo-pattern p-8 text-center text-ink-muted">No decisions yet. Decisions are recorded on a case's Decision and memory tab.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead><tr className="border-b border-line text-ink-faint">{["Case", "Decision", "Status", "Approvals", "Handoff", "Policy", "Drift"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60">
                  <td className="px-4 py-2"><Link href={`/cases/${r.case_key}?tab=Decision and memory`} className="tap font-mono text-[13px] text-accent hover:underline">{r.case_key}</Link><div className="text-[13px] text-ink-muted">{r.case_title}</div></td>
                  <td className="px-4 py-2">{r.outcome}: {r.option_title}<div className="text-[13px] text-ink-faint">{r.proposed_by_label} · {formatDate(r.created_at, true)}</div></td>
                  <td className="px-4 py-2"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                  <td className="px-4 py-2 tabular">{r.approvals}/{r.required_approvals}</td>
                  <td className="px-4 py-2">{r.open_handoffs ? `${r.open_handoffs} open` : "complete"}</td>
                  <td className="px-4 py-2 tabular">v{r.policy_version}</td>
                  <td className="px-4 py-2">{drift[r.id] ? <Badge tone={drift[r.id] === "none" ? "ok" : drift[r.id] === "minor" ? "warn" : drift[r.id] === "checking" ? "neutral" : "crit"}>{drift[r.id]}</Badge> : <Button size="sm" variant="ghost" onClick={() => check(r.id)}><Activity />Check</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
