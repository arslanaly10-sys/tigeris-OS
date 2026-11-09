"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Download, Info, ShieldAlert } from "lucide-react";
import {
  EVIDENCE_LABEL, EVIDENCE_LEVELS, GAPS, QUESTION_COUNT, SEVERITY_LABEL, VALUE_ASSUMPTIONS, assess, formatUsd,
  type DiagnosticAnswer, type DiagnosticResult, type EvidenceLevel, type GapKey, type Severity,
} from "@tigeris/shared";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { usePrefs } from "./prefs";
import { PlaybookLinks } from "./playbooks-ui";

/**
 * Sovereign gap diagnostic (commercial model, steps 1 to 3). The report and the questionnaire are shared by
 * the signed-in module and the public readiness check; scoring always comes from @tigeris/shared.
 */
export interface Assessment {
  id: string; title: string; subject_label: string; priority: string | null; aum_usd: number | null; data_mode: "self_assessment" | "synthetic";
  method_version: string; answers: DiagnosticAnswer[]; result: DiagnosticResult; input_hash: string;
  created_by_label: string; created_by_role: string; created_at: string;
}

const SEVERITY_TONE: Record<Severity, { tone: "crit" | "warn" | "info" | "ok"; Icon: typeof AlertTriangle }> = {
  critical: { tone: "crit", Icon: ShieldAlert },
  major: { tone: "warn", Icon: AlertTriangle },
  moderate: { tone: "info", Icon: Info },
  minor: { tone: "ok", Icon: CheckCircle2 },
};
const gapDef = (k: GapKey) => GAPS.find((g) => g.key === k)!;

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return <Badge>Not assessed</Badge>;
  const s = SEVERITY_TONE[severity];
  return <Badge tone={s.tone}><s.Icon />{SEVERITY_LABEL[severity]}</Badge>;
}

/** The report: headline figures, a score per gap, priorities, and before / after. */
export function GapReport({ result, meta, actions, publicView = false }: {
  result: DiagnosticResult;
  meta: { subject: string; dataMode: string; synthetic: boolean; date?: string; by?: string; priority?: string | null };
  actions?: React.ReactNode;
  publicView?: boolean;
}) {
  const { lang } = usePrefs();
  const v = result.valueAtStake;
  const [showBasis, setShowBasis] = useState(false);
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader eyebrow={meta.subject} title="Diagnostic summary" actions={<div className="flex flex-wrap justify-end gap-2">
          <Badge tone={meta.synthetic ? "gold" : "neutral"}>{meta.dataMode}</Badge>
          {result.evidence && <Badge tone="info">Evidence: {EVIDENCE_LABEL[result.evidence].toLowerCase()}</Badge>}
          {!result.complete && <Badge tone="warn"><AlertTriangle />{result.answered} of {result.questions} answered</Badge>}
          {actions}
        </div>} />
        <div className="grid gap-px bg-line sm:grid-cols-3">
          {[
            { label: "Readiness", value: result.readinessPct === null ? "–" : `${result.readinessPct}%`, note: "Mean score across the gaps assessed" },
            { label: "Governance confidence", value: result.governanceConfidencePct === null ? "–" : `${result.governanceConfidencePct}%`, note: "Governance velocity, decision drift, sovereign control" },
            {
              label: "Value at stake (planning range)",
              value: v.lowUsd !== null && v.highUsd !== null ? `${formatUsd(v.lowUsd)} to ${formatUsd(v.highUsd)}` : `${v.bpLow} to ${v.bpHigh} bp`,
              note: v.aumUsd ? `A year: ${v.bpLow} to ${v.bpHigh} basis points of ${formatUsd(v.aumUsd)}` : "Basis points of assets a year; add an asset figure for a dollar range",
            },
          ].map((k) => (
            <div key={k.label} className="bg-surface p-5">
              <div className="text-[13px] text-ink-muted">{k.label}</div>
              <div className="mt-1 text-[30px] font-medium leading-tight tabular">{k.value}</div>
              <div className="mt-1 text-[13px] text-ink-faint">{k.note}</div>
            </div>
          ))}
        </div>
        {meta.priority && <div className="border-t border-line px-5 py-3 text-[14px]"><span className="text-ink-muted">Briefing priority: </span>{meta.priority}</div>}
        <div className="border-t border-line px-5 py-3 text-[13px]">
          <button type="button" className="tap inline-flex items-center gap-1 text-accent hover:underline" aria-expanded={showBasis} onClick={() => setShowBasis((x) => !x)}>
            <Info className="size-4" />How the value range is calculated
          </button>
          {showBasis && (
            <div className="mt-2 grid max-w-[64ch] gap-2 text-ink-muted">
              <p>Each gap's value is its most likely value if fully closed, times how far it is from the best score: maxBp × (4 − score) ÷ 4. One basis point is 0.01% of assets a year, so on $1 trillion it is $100 million.</p>
              <ul className="grid gap-1.5">
                {VALUE_ASSUMPTIONS.map((a) => (
                  <li key={a.key}><Badge tone="warn" className="me-2">Assumed</Badge><span className="text-ink">{a.label}: {a.value}.</span> {a.basis}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader eyebrow="Seven gaps, scored 0 to 4" title="Where the institution stands" />
          <ul className="grid gap-4 p-5">
            {result.gaps.map((g) => (
              <li key={g.key} className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                  <span className="font-medium">{lang === "ar" ? gapDef(g.key).nameAr : g.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular text-ink-muted">{g.score === null ? "–" : `${g.score} / 4`}</span>
                    <SeverityBadge severity={g.severity} />
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${g.name}: ${g.score ?? "not assessed"} out of 4`}>
                  <div className={cn("h-full rounded-full", g.severity === "critical" ? "bg-crit" : g.severity === "major" ? "bg-warn" : g.severity === "moderate" ? "bg-info" : "bg-ok")} style={{ width: `${((g.score ?? 0) / 4) * 100}%` }} />
                </div>
                <div className="text-[13px] text-ink-faint">{gapDef(g.key).asks} · at stake {g.bpLow} to {g.bpHigh} bp a year{g.evidence ? ` · ${EVIDENCE_LABEL[g.evidence].toLowerCase()}` : ""}</div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Where closing the gap is worth most" title="Priorities" />
          {result.priorities.length === 0 ? (
            <p className="p-5 text-[14px] text-ink-muted">No gap has value at stake: every assessed gap scores at the top of the scale.</p>
          ) : (
            <ol className="grid gap-3 p-5">
              {result.priorities.map((k, i) => {
                const g = result.gaps.find((x) => x.key === k)!;
                return (
                  <li key={k} className="grid grid-cols-[28px_1fr] gap-2 text-[14px]">
                    <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-[13px] font-medium text-accent">{i + 1}</span>
                    <span><span className="font-medium">{g.name}</span><span className="block text-[13px] text-ink-muted">{gapDef(k).metric}. Today: {gapDef(k).before}.</span>{!publicView && <span className="mt-1 block"><PlaybookLinks gap={k} /></span>}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {result.recommendedPilot && (
            <div className="border-t border-line p-5 text-[14px]">
              <div className="eyebrow text-ink-faint">Recommended first mandate pilot</div>
              <p className="mt-1">Close <span className="font-medium">{gapDef(result.recommendedPilot.gap).name.toLowerCase()}</span> first, through {result.recommendedPilot.label.toLowerCase()}.</p>
              {!publicView && <Link href={result.recommendedPilot.href} className="tap mt-2 inline-flex items-center gap-1 text-[13px] text-accent hover:underline">See it in TIGERIS<ArrowRight className="size-4 rtl:rotate-180" /></Link>}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader eyebrow="Measured in the diagnostic, signed as pilot success criteria" title="Before and after TIGERIS" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Gap", "Severity", "Today (typical)", "After TIGERIS (pilot target)", "How it is proved"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {result.gaps.map((g) => {
                const d = gapDef(g.key);
                return (
                  <tr key={g.key} className="border-b border-line/60 align-top last:border-0">
                    <td className="px-4 py-3 font-medium">{g.name}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={g.severity} /></td>
                    <td className="px-4 py-3 text-ink-muted">{d.before}</td>
                    <td className="px-4 py-3">{d.after}</td>
                    <td className="px-4 py-3 text-ink-muted">{d.proof}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">
          An indicative diagnostic: each score rests on the evidence level shown. The paid diagnostic adds interviews and measured samples and replaces the planning range with value lines from the institution's own data. It supports a human judgement and decides nothing.{meta.date ? ` Assessed ${meta.date}${meta.by ? ` by ${meta.by}` : ""}.` : ""}
        </p>
      </Panel>
    </div>
  );
}

/** Fourteen questions, grouped by gap, each with its evidence level. */
export function GapQuestionnaire({ answers, setAnswers, showEvidence = true }: { answers: Record<string, DiagnosticAnswer>; setAnswers: (a: Record<string, DiagnosticAnswer>) => void; showEvidence?: boolean }) {
  const { lang } = usePrefs();
  const set = (questionId: string, patch: Partial<DiagnosticAnswer>) =>
    setAnswers({ ...answers, [questionId]: { questionId, score: answers[questionId]?.score ?? 0, evidence: answers[questionId]?.evidence ?? "self_report", ...patch } });
  return (
    <div className="grid gap-5">
      {GAPS.map((g, gi) => (
        <Panel key={g.key}>
          <PanelHeader eyebrow={`Gap ${gi + 1} of ${GAPS.length}`} title={lang === "ar" ? g.nameAr : g.name} actions={<span className="text-[13px] text-ink-faint">{g.questions.filter((q) => answers[q.id]).length} of 2 answered</span>} />
          <div className="grid gap-6 p-5">
            {g.questions.map((q) => (
              <fieldset key={q.id} className="grid gap-2">
                <legend className="mb-1 max-w-[70ch] text-[15px] font-medium">{q.text}</legend>
                <div className="grid gap-1.5" role="radiogroup">
                  {q.options.map((o, score) => {
                    const on = answers[q.id]?.score === score;
                    return (
                      <label key={score} className={cn("flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-[14px] transition-colors", on ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong")}>
                        <input type="radio" name={q.id} className="mt-0.5" checked={on} onChange={() => set(q.id, { score })} />
                        <span className="w-6 shrink-0 tabular text-ink-faint">{score}</span>
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
                {showEvidence && answers[q.id] && (
                  <label className="mt-1 flex items-center gap-2 text-[13px] text-ink-muted">
                    Evidence
                    <select value={answers[q.id]!.evidence} onChange={(e) => set(q.id, { evidence: e.target.value as EvidenceLevel })} className="h-9 rounded-md border border-line bg-surface-2 px-2 text-ink">
                      {EVIDENCE_LEVELS.map((l) => <option key={l} value={l}>{EVIDENCE_LABEL[l]}</option>)}
                    </select>
                  </label>
                )}
              </fieldset>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

/** Asset figure entered in billions of US dollars; empty means "not given". */
export function AumInput({ value, onChange, id = "aum" }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <label htmlFor={id} className="grid gap-1.5 text-[13px] text-ink-muted">
      Assets under management (US$ billions, optional)
      <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 650…" className="h-10 rounded-md border border-line bg-surface-2 px-3 text-[14px] text-ink" />
    </label>
  );
}
export const aumFromInput = (v: string) => (v && Number(v) > 0 ? Number(v) * 1e9 : null);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
export { download as downloadText };

const TABS = [{ key: "report", label: "Report" }, { key: "new", label: "New assessment" }, { key: "history", label: "History" }, { key: "method", label: "Method" }] as const;
type TabKey = (typeof TABS)[number]["key"];

/** The module: latest report, a new assessment, past assessments and the method. */
export function DiagnosticModule() {
  const can = useCan();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<TabKey>(TABS.find((t) => t.key === params.get("tab"))?.key ?? "report");
  const [list, setList] = useState<Assessment[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<{ assessments: Assessment[] }>("/diagnostic/assessments").then((r) => (r.ok ? setList(r.data.assessments) : setError(r.message)));
  useEffect(() => { load(); }, []);
  const open = (t: TabKey) => { setTab(t); router.replace(t === "report" ? pathname : `${pathname}?tab=${t}`, { scroll: false }); };
  const current = list?.find((a) => a.id === selected) ?? list?.[0] ?? null;

  return (
    <>
      <PageHeader nav="nav.diagnostic" description="A sovereign gap diagnostic: seven gaps, scored 0 to 4 with the evidence behind each score, the value at stake as a planning range, and the before and after TIGERIS would deliver. It is the first paid step with a buyer." />
      <div role="tablist" aria-label="Gap diagnostic" className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => open(t.key)} className={cn("-mb-px border-b-2 px-3 py-3 text-[14px] font-medium", tab === t.key ? "border-primary text-ink" : "border-transparent text-ink-faint hover:text-ink")}>{t.label}</button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 rounded-md border border-crit/40 bg-crit-soft p-3 text-crit">{error}</p>}
      {tab === "report" && (!list ? <div className="h-72 animate-pulse rounded-lg bg-surface-2" /> : current ? (
        <GapReport result={current.result} meta={{ subject: `${current.title} · ${current.subject_label}`, dataMode: current.data_mode === "synthetic" ? "Synthetic sample answers" : "Self-assessment", synthetic: current.data_mode === "synthetic", date: formatDate(current.created_at, true), by: current.created_by_label, priority: current.priority }}
          actions={can("export.create") ? <ExportButton assessment={current} /> : undefined} />
      ) : (
        <Panel className="p-6 text-[14px] text-ink-muted">No assessment yet. {can("diagnostic.run") ? <button type="button" className="tap text-accent hover:underline" onClick={() => open("new")}>Start one</button> : "Ask an analyst or executive to run one."}</Panel>
      ))}
      {tab === "new" && (can("diagnostic.run") ? <NewAssessment onSaved={(a) => { setList((l) => [a, ...(l ?? [])]); setSelected(a.id); open("report"); }} /> : (
        <Panel className="p-6 text-[14px] text-ink-muted">Your role can read diagnostics but not run one. Executives, analysts and domain experts can.</Panel>
      ))}
      {tab === "history" && <History list={list} onOpen={(id) => { setSelected(id); open("report"); }} />}
      {tab === "method" && <Method />}
    </>
  );
}

function ExportButton({ assessment }: { assessment: Assessment }) {
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setErr(null);
    const res = await fetch(`/api/diagnostic/assessments/${assessment.id}/report`, { credentials: "same-origin" });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b.message ?? "Export refused."); return; }
    download(`${assessment.title.replace(/[^\w-]+/g, "-").toLowerCase()}.md`, await res.text());
  }
  return (
    <span className="grid justify-items-end gap-1">
      <Button size="sm" variant="secondary" onClick={run}><Download />Export report</Button>
      {err && <span role="alert" className="text-[13px] text-crit">{err}</span>}
    </span>
  );
}

function NewAssessment({ onSaved }: { onSaved: (a: Assessment) => void }) {
  const [title, setTitle] = useState("Gap diagnostic");
  const [subject, setSubject] = useState("Whole institution");
  const [aum, setAum] = useState("");
  const [priority, setPriority] = useState("");
  const [answers, setAnswers] = useState<Record<string, DiagnosticAnswer>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => assess(Object.values(answers), { aumUsd: aumFromInput(aum) }), [answers, aum]);
  const answered = Object.keys(answers).length;
  async function save() {
    setBusy(true); setError(null);
    const r = await api<Assessment>("/diagnostic/assessments", { json: { title, subjectLabel: subject, priority: priority.trim() || undefined, aumUsd: aumFromInput(aum), answers: Object.values(answers) } });
    setBusy(false);
    if (r.ok) onSaved(r.data); else setError(r.message);
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid gap-5">
        <Panel className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="grid gap-1.5 text-[13px] text-ink-muted">Title<input autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-md border border-line bg-surface-2 px-3 text-[14px] text-ink" /></label>
          <label className="grid gap-1.5 text-[13px] text-ink-muted">What is assessed<input autoComplete="off" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 rounded-md border border-line bg-surface-2 px-3 text-[14px] text-ink" /></label>
          <AumInput value={aum} onChange={setAum} />
          <label className="grid gap-1.5 text-[13px] text-ink-muted sm:col-span-3">
            What strategic priority, decision challenge or intelligence gap should the briefing explore?
            <textarea value={priority} onChange={(e) => setPriority(e.target.value)} rows={2} maxLength={500} autoComplete="off" placeholder="e.g. Our exposure if a key shipping corridor closes for a month…" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[14px] text-ink" />
          </label>
        </Panel>
        <GapQuestionnaire answers={answers} setAnswers={setAnswers} />
      </div>
      <Panel className="grid gap-3 p-5 lg:sticky lg:top-[72px]">
        <div className="eyebrow text-ink-faint">Live preview</div>
        <div className="text-[13px] text-ink-muted">{answered} of {QUESTION_COUNT} questions answered</div>
        <div className="text-[30px] font-medium tabular leading-tight">{preview.readinessPct === null ? "–" : `${preview.readinessPct}%`}<span className="ms-2 text-[14px] text-ink-faint">readiness</span></div>
        <div className="text-[14px]">Value at stake: {preview.valueAtStake.lowUsd !== null ? `${formatUsd(preview.valueAtStake.lowUsd)} to ${formatUsd(preview.valueAtStake.highUsd!)}` : `${preview.valueAtStake.bpLow} to ${preview.valueAtStake.bpHigh} bp`} a year <Badge tone="warn" className="ms-1">Planning range</Badge></div>
        <p className="text-[13px] text-ink-faint">The server recomputes everything when you save; the saved assessment and its inputs go on the audit trail.</p>
        {error && <p role="alert" className="text-[13px] text-crit">{error}</p>}
        <Button variant="primary" disabled={busy || answered === 0 || title.trim().length < 3 || subject.trim().length < 2} onClick={save}><ClipboardList />{busy ? "Saving…" : "Save and see the report"}</Button>
      </Panel>
    </div>
  );
}

function History({ list, onOpen }: { list: Assessment[] | null; onOpen: (id: string) => void }) {
  if (!list) return <div className="h-48 animate-pulse rounded-lg bg-surface-2" />;
  return (
    <Panel>
      <PanelHeader eyebrow="Saved assessments, newest first" title="History" actions={<Badge>{list.length}</Badge>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead><tr className="border-b border-line text-ink-faint">{["Assessment", "Data", "Readiness", "Value at stake a year", "By", "When"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3"><button type="button" className="tap text-start font-medium hover:underline" onClick={() => onOpen(a.id)}>{a.title}</button><div className="text-ink-faint">{a.subject_label}</div></td>
                <td className="px-4 py-3"><Badge tone={a.data_mode === "synthetic" ? "gold" : "neutral"}>{a.data_mode === "synthetic" ? "Synthetic" : "Self-assessment"}</Badge></td>
                <td className="px-4 py-3 tabular">{a.result.readinessPct ?? "–"}%</td>
                <td className="px-4 py-3 tabular">{a.result.valueAtStake.lowUsd !== null ? `${formatUsd(a.result.valueAtStake.lowUsd)} to ${formatUsd(a.result.valueAtStake.highUsd!)}` : `${a.result.valueAtStake.bpLow} to ${a.result.valueAtStake.bpHigh} bp`}</td>
                <td className="px-4 py-3 text-ink-muted">{a.created_by_label}</td>
                <td className="px-4 py-3 text-ink-muted">{formatDate(a.created_at, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Method() {
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader eyebrow="Like a car diagnostic: what is wrong, how bad, what it costs, what fixes it" title="The seven gaps" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Gap", "The question", "Headline metric", "TIGERIS remedy", "Most value if closed"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {GAPS.map((g) => (
                <tr key={g.key} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{g.asks}</td>
                  <td className="px-4 py-3">{g.metric}</td>
                  <td className="px-4 py-3"><Link href={g.remedy.href} className="tap text-accent hover:underline">{g.remedy.label}</Link></td>
                  <td className="px-4 py-3 tabular">{g.maxBp} bp a year <Badge tone="warn" className="ms-1">Assumed</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="grid gap-3 p-5 text-[14px]">
        <h2 className="text-[16px] font-medium">Scoring and evidence</h2>
        <p className="max-w-[64ch] text-ink-muted">Each question is answered 0 (worst) to 4 (best); a gap's score is the mean of its two answers. Severity: under 1.5 critical, under 2.5 major, under 3.5 moderate, otherwise minor. Every answer records its evidence: self-reported, from interviews, or measured. A gap, and the whole report, is only as strong as its weakest evidence.</p>
        <p className="max-w-[64ch] text-ink-muted">Three steps raise the evidence: the public readiness check (self-report), the executive briefing (interviews), and the paid diagnostic (measured samples: timestamps, logs, retrieval tests).</p>
        <p className="text-ink-muted">Public readiness check for a buyer's website: <Link href="/readiness" className="tap text-accent hover:underline">/readiness</Link></p>
      </Panel>
    </div>
  );
}

/**
 * Command Centre panel: the three boardroom figures Tiger's site promises, filled from the latest gap
 * diagnostic, each traceable to the assessment it came from (rule 7).
 */
export function ReadinessPanel() {
  const [a, setA] = useState<Assessment | null | undefined>(undefined);
  useEffect(() => { api<{ assessments: Assessment[] }>("/diagnostic/assessments").then((r) => setA(r.ok ? r.data.assessments[0] ?? null : null)); }, []);
  const r = a?.result;
  return (
    <Panel>
      <PanelHeader eyebrow="From the latest gap diagnostic" title="Sovereign readiness" actions={<Link href="/diagnostic" className="tap text-[13px] text-accent">Open</Link>} />
      {a === undefined && <div className="m-4 h-24 animate-pulse rounded bg-surface-2" />}
      {a === null && <p className="p-4 text-[13px] text-ink-muted">No diagnostic yet. <Link href="/diagnostic?tab=new" className="tap text-accent hover:underline">Run one</Link> to see readiness, governance confidence and value at stake.</p>}
      {r && (
        <>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            {[
              { label: "Value realization potential", value: r.valueAtStake.lowUsd !== null ? `${formatUsd(r.valueAtStake.lowUsd)}–${formatUsd(r.valueAtStake.highUsd!)}` : `${r.valueAtStake.bpLow}–${r.valueAtStake.bpHigh} bp`, note: "A year, planning range" },
              { label: "National capability readiness", value: `${r.readinessPct ?? "–"}%`, note: `${r.answered} of ${r.questions} questions` },
              { label: "Governance confidence", value: `${r.governanceConfidencePct ?? "–"}%`, note: "Velocity, drift, control" },
            ].map((k) => (
              <Link key={k.label} href="/diagnostic" className="block bg-surface p-4 hover:bg-surface-2">
                <div className="text-[13px] text-ink-muted">{k.label}</div>
                <div className="mt-1 whitespace-nowrap text-[20px] font-medium tabular leading-tight">{k.value}</div>
                <div className="text-[13px] text-ink-faint">{k.note}</div>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">
            <Badge tone={a.data_mode === "synthetic" ? "gold" : "neutral"}>{a.data_mode === "synthetic" ? "Synthetic sample" : "Self-assessment"}</Badge>
            {r.priorities[0] && <span>Top gap: <span className="text-ink">{gapDef(r.priorities[0]).name}</span></span>}
          </div>
        </>
      )}
    </Panel>
  );
}
