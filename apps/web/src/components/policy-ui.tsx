"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileCode2, FlaskConical, Play, Save, ShieldAlert, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { requireText, clearInvalid, useUnsavedWarning } from "@/lib/forms";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { PolicyResultBadge, TraceList } from "./decisions-ui";

interface Version { id: string; version: number; status: string; note: string; tests_passed: boolean; test_results: TestResult[]; content_hash: string; created_by_label: string; created_at: string; activated_by_label: string | null; activated_at: string | null; rules: number }
interface TestResult { name: string; action: string; expect: string; got: string; rule: string; expectedRule: string | null; pass: boolean; explanation: string }
interface Validation { ok: boolean; errors: string[]; hash: string; rules: number; tests: TestResult[] }

const SAMPLE: Record<string, string> = {
  "case.transition": JSON.stringify({ from: "decision", to: "handoff", actor: { id: "u2", role: "approver" }, case: { created_by: "u1", depth: "full", inputs_count: 2 }, transition: { needs_rationale: true }, rationale: { length: 40 }, decision: { status: "pending" }, handoff: { open_count: 0 } }, null, 2),
  "decision.record": JSON.stringify({ actor: { id: "u2", role: "approver" }, outcome: "approve", rationale: { length: 60 }, case: { state: "decision", created_by: "u1" }, recommendation: { option_key: "reroute", authority: "Executive committee", governance: "PASS", confidence_band: "medium", drafted_by: "u3" } }, null, 2),
  "decision.approve": JSON.stringify({ actor: { id: "u2", role: "executive" }, decision: { proposed_by: "u2", status: "pending" }, vote: "approve", rationale: { length: 30 } }, null, 2),
  "handoff.update": JSON.stringify({ actor: { id: "u5", role: "operations_owner" }, handoff: { status: "open", owner_role: "operations_owner" }, to_status: "done", note: { length: 4 } }, null, 2),
  "export.create": JSON.stringify({ actor: { id: "u3", role: "analyst" }, audience: "partner", case: { sensitivity: "confidential" } }, null, 2),
  "memory.approve": JSON.stringify({ actor: { id: "u3", role: "approver" }, entry: { proposed_by: "u3" } }, null, 2),
};

/** Policy-as-code editor (Q090..Q095): edit YAML, see compile errors and test results as you type, save a draft, activate only when every test passes. */
export function PolicyEditor() {
  const can = useCan();
  const editable = can("policy.edit");
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [baseline, setBaseline] = useState("");
  const [viewing, setViewing] = useState<Version | null>(null);
  const [v, setV] = useState<Validation | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [action, setAction] = useState("case.transition");
  const [ctx, setCtx] = useState(SAMPLE["case.transition"]!);
  const [evalRes, setEvalRes] = useState<{ result: string; explanation: string; trace: Parameters<typeof TraceList>[0]["trace"] } | { error: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ versions: Version[]; active: { id: string; source: string } }>("/policy");
    if (!r.ok) return;
    setVersions(r.data.versions);
    setActiveId(r.data.active.id);
    setSource((s) => s || r.data.active.source);
    setBaseline(r.data.active.source);
    setViewing((x) => x ?? r.data.versions.find((y) => y.status === "active") ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!source) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => { const r = await api<Validation>("/policy/validate", { json: { source } }); if (r.ok) setV(r.data); }, 400);
  }, [source]);

  async function open(ver: Version) {
    const r = await api<{ source: string }>(`/policy/versions/${ver.id}`);
    if (r.ok) { setSource(r.data.source); setBaseline(r.data.source); setViewing(ver); setMsg(null); }
  }
  async function saveDraft() {
    if (!dirty) { setMsg({ ok: false, text: "There are no edits to save. Change the policy first." }); return; }
    if (!v?.ok) { setMsg({ ok: false, text: "The policy does not compile. Fix the errors listed under the editor, then save." }); return; }
    const bad = requireText(note, 3, "policy-note", "The change note");
    if (bad) { setMsg({ ok: false, text: bad }); return; }
    clearInvalid("policy-note");
    const r = await api<{ version: number; tests: TestResult[] }>("/policy/drafts", { json: { source, note } });
    if (r.ok) { setMsg({ ok: true, text: `Saved as draft v${r.data.version}; ${r.data.tests.filter((t) => t.pass).length}/${r.data.tests.length} tests pass.` }); setNote(""); await load(); setBaseline(source); }
    else setMsg({ ok: false, text: r.message });
  }
  async function activate(ver: Version) {
    if (!ver.tests_passed) { setMsg({ ok: false, text: `Version ${ver.version} fails its tests. Fix the failing tests and save a new draft.` }); return; }
    const bad = requireText(reason, 5, `activate-${ver.id}`, "The reason to activate");
    if (bad) { setMsg({ ok: false, text: bad }); return; }
    clearInvalid(`activate-${ver.id}`);
    const r = await api<{ version: number; previous: number; added: string[]; removed: string[]; changed: string[] }>(`/policy/versions/${ver.id}/activate`, { json: { reason } });
    if (r.ok) { setMsg({ ok: true, text: `Policy v${r.data.version} is active (was v${r.data.previous}). Added ${r.data.added.length}, removed ${r.data.removed.length}, changed ${r.data.changed.length} rule(s).` }); setReason(""); load(); }
    else setMsg({ ok: false, text: r.message });
  }
  async function tryIt() {
    let context: Record<string, unknown>;
    try { context = JSON.parse(ctx); } catch { setEvalRes({ error: "The context is not valid JSON." }); return; }
    const r = await api<{ result: string; explanation: string; trace: Parameters<typeof TraceList>[0]["trace"] }>("/policy/evaluate", { json: { action, context, source } });
    setEvalRes(r.ok ? r.data : { error: r.message });
  }
  const dirty = source !== baseline;
  useUnsavedWarning(dirty);
  const lines = source.split("\n").length;
  return (
    <section className="mt-5 grid gap-5" aria-labelledby="policy-heading">
      <h2 id="policy-heading" className="text-[20px] font-medium">Policy as code</h2>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelHeader eyebrow={viewing ? `Version ${viewing.version} · ${viewing.status}${dirty ? " · edited" : ""}` : "Policy"} title="Rules, approvals, redaction and tests" actions={v && <Badge tone={v.ok ? "ok" : "crit"}>{v.ok ? <CheckCircle2 /> : <XCircle />}{v.ok ? `${v.rules} rules compile` : `${v.errors.length} error(s)`}</Badge>} />
          <div className="grid gap-3 p-4">
            <div className="flex overflow-hidden rounded-md border border-line bg-[var(--bg)] font-mono text-[13px] leading-[1.55] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/30">
              <pre aria-hidden="true" className="select-none border-e border-line px-2 py-2 text-end text-ink-faint">{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</pre>
              <textarea autoComplete="off" value={source} onChange={(e) => setSource(e.target.value)} readOnly={!editable} spellCheck={false} aria-label="Policy source (YAML)" rows={Math.min(30, Math.max(16, lines))} className="min-h-[360px] w-full resize-y whitespace-pre bg-transparent px-3 py-2 text-ink outline-none" style={{ tabSize: 2 }} />
            </div>
            {v && !v.ok && <ul className="grid gap-1 rounded-md border border-crit/40 bg-crit-soft p-3 text-[13px] text-crit">{v.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            {editable ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="grid flex-1 gap-1 text-[13px] text-ink-muted">Change note<input autoComplete="off" id="policy-note" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink" placeholder="e.g. Raise the rationale minimum for decisions…" /></label>
                <Button variant="primary" onClick={saveDraft}><Save />Save as draft</Button>
                <Button variant="ghost" disabled={!dirty} onClick={() => { if (confirmDiscard) { setSource(baseline); setConfirmDiscard(false); } else { setConfirmDiscard(true); setTimeout(() => setConfirmDiscard(false), 4000); } }}>{confirmDiscard ? "Press again to discard" : "Discard edits"}</Button>
              </div>
            ) : <p className="text-[13px] text-ink-muted">Read only. Administrators edit the policy; every version is tested before it can be activated.</p>}
            {msg && <p role="status" className={cn("text-[13px]", msg.ok ? "text-ok" : "text-warn")}>{msg.text}</p>}
          </div>
        </Panel>
        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader eyebrow="Tests" title={v ? `${v.tests.filter((t) => t.pass).length} of ${v.tests.length} pass` : "Tests"} actions={<FlaskConical className="size-4 text-accent" />} />
            <ul className="grid gap-1.5 p-4 text-[13px]">
              {v?.tests.map((t) => (
                <li key={t.name} className="grid grid-cols-[16px_1fr] gap-2">
                  {t.pass ? <CheckCircle2 className="mt-0.5 size-3.5 text-ok" aria-label="pass" /> : <XCircle className="mt-0.5 size-3.5 text-crit" aria-label="fail" />}
                  <span><span className="text-ink">{t.name}</span><br /><span className="text-ink-faint">expects {t.expect}{t.expectedRule ? ` by ${t.expectedRule}` : ""}; got {t.got}{t.got !== "PASS" ? ` by ${t.rule}` : ""}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="History" title="Versions" />
            <ul className="grid gap-2 p-4 text-[13px]">
              {versions.map((x) => (
                <li key={x.id} className={cn("grid gap-1 rounded-md border p-2.5", x.id === viewing?.id ? "border-primary" : "border-line")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => open(x)} className="tap font-medium hover:underline">v{x.version}</button>
                    <Badge tone={x.status === "active" ? "ok" : x.status === "draft" ? "warn" : "neutral"}>{x.status}</Badge>
                    <Badge tone={x.tests_passed ? "ok" : "crit"}>{x.tests_passed ? "tests pass" : "tests fail"}</Badge>
                    <span className="ms-auto tabular text-ink-faint">{x.rules} rules</span>
                  </div>
                  <div className="text-ink-muted">{x.note}</div>
                  <div className="text-ink-faint">{x.created_by_label} · {formatDate(x.created_at, true)}{x.activated_at ? ` · activated by ${x.activated_by_label}` : ""}</div>
                  {editable && x.status === "draft" && x.id !== activeId && (
                    <div className="flex gap-2"><input autoComplete="off" id={`activate-${x.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Approved by the governance committee…" aria-label="Reason to activate" className="h-8 flex-1 rounded-md border border-line bg-surface-2 px-2" /><Button size="sm" variant="primary" onClick={() => activate(x)}>Activate</Button></div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <Panel>
        <PanelHeader eyebrow="Sandbox" title="Try the rules on an example" actions={<FileCode2 className="size-4 text-accent" />} />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <label className="grid gap-1 text-[13px] text-ink-muted">Action<select value={action} onChange={(e) => { setAction(e.target.value); setCtx(SAMPLE[e.target.value]!); setEvalRes(null); }} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink">{Object.keys(SAMPLE).map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="grid gap-1 text-[13px] text-ink-muted">Context (JSON)<textarea autoComplete="off" value={ctx} onChange={(e) => setCtx(e.target.value)} rows={12} spellCheck={false} className="rounded-md border border-line bg-[var(--bg)] p-2 font-mono text-[13px] text-ink" /></label>
            <Button variant="secondary" className="justify-self-start" onClick={tryIt}><Play />Evaluate with the rules in the editor</Button>
          </div>
          <div className="grid content-start gap-2">
            {!evalRes && <p className="text-[13px] text-ink-muted">Evaluation is deterministic: the same rules and context always give the same result. No model is involved.</p>}
            {evalRes && "error" in evalRes && <p role="alert" className="flex gap-2 text-[13px] text-crit"><TriangleAlert className="size-4" />{evalRes.error}</p>}
            {evalRes && "result" in evalRes && (<>
              <div className="flex items-center gap-2"><PolicyResultBadge result={evalRes.result} /><span className="text-[13px]">{evalRes.explanation}</span></div>
              <TraceList trace={evalRes.trace} />
            </>)}
          </div>
        </div>
      </Panel>
    </section>
  );
}

interface PostureCheck { area: string; check: string; status: "pass" | "warn" | "fail"; evidence: string }
export function SecurityPosture() {
  const [d, setD] = useState<{ checkedAt: string; checks: PostureCheck[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useCallback(async () => {
    setBusy(true);
    const r = await api<{ checkedAt: string; checks: PostureCheck[] }>("/security/posture");
    setBusy(false);
    if (r.ok) setD(r.data); else setErr(r.message);
  }, []);
  useEffect(() => { run(); }, [run]);
  const areas = [...new Set(d?.checks.map((c) => c.area) ?? [])];
  return (
    <section className="mt-5" aria-labelledby="posture-heading">
      <Panel>
        <PanelHeader eyebrow="Checked live" title={<span id="posture-heading">Security posture</span>} actions={<div className="flex items-center gap-2">{d && <><Badge tone="ok" className="tabular">{d.checks.filter((c) => c.status === "pass").length} pass</Badge><Badge tone="warn" className="tabular">{d.checks.filter((c) => c.status === "warn").length} warn</Badge><Badge tone={d.checks.some((c) => c.status === "fail") ? "crit" : "neutral"} className="tabular">{d.checks.filter((c) => c.status === "fail").length} fail</Badge></>}<Button size="sm" variant="secondary" onClick={run} disabled={busy}>{busy ? "Checking…" : "Run checks"}</Button></div>} />
        {err && <p role="alert" className="p-4 text-[13px] text-crit">{err}</p>}
        {d && (
          <div className="grid gap-4 p-4">
            {areas.map((a) => (
              <div key={a}>
                <div className="eyebrow mb-1.5 text-ink-faint">{a}</div>
                <ul className="grid gap-1.5">
                  {d.checks.filter((c) => c.area === a).map((c) => (
                    <li key={c.check} className="grid grid-cols-[70px_minmax(0,280px)_1fr] items-start gap-3 text-[13px]">
                      <Badge tone={c.status === "pass" ? "ok" : c.status === "warn" ? "warn" : "crit"} className="justify-self-start">{c.status === "pass" ? <ShieldCheck /> : <ShieldAlert />}{c.status}</Badge>
                      <span className="text-ink">{c.check}</span>
                      <span className="text-ink-muted">{c.evidence}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-[13px] text-ink-faint">Checked {formatDate(d.checkedAt, true)}. Each check queries the running database, the audit chain or the model gateway; the result is recorded on the audit trail.</p>
          </div>
        )}
      </Panel>
    </section>
  );
}
