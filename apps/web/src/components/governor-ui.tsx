"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, Gavel, Send, ShieldCheck, XCircle } from "lucide-react";
import { QUICK_PROMPTS, type DecisionBrief, type Facts } from "@tigeris/shared";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useCan, useSession } from "./session-context";
import { DataLabel } from "./data-label";
import { LayersScene } from "./scenes/LayersScene";
import { AnimatePresence, motion } from "motion/react";
import { CountUp, Flash, Stagger, StaggerItem, spring } from "./motion-kit";

/**
 * Governor question → Decision Brief → Decision Package → approval → owners → Ledger (brief v3 §6, §12; module 6–7).
 * Briefing-style, not a chat. The brief cites engine facts only and is validated before it is shown; in demo mode it
 * is cached. Approval is by the role the authority matrix names; every step appears in the Ledger with its hash.
 */
interface Pkg { id: string; question: string; recommended: string; authority_required: string; approval_threshold: string; status: string; created_by_label: string; created_at: string; decided_by_label: string | null; decided_at: string | null; decision_comment: string | null; input_hash: string; model: string; prompt_version: string; tasks: Array<{ action: string; owner_label: string; due_at: string; status: string }> }
interface Entry { seq: number; occurred_at: string; actor_label: string; actor_role: string | null; action: string; details: Record<string, unknown>; hash: string }
const DEFAULT_Q = "How do we turn the Hormuz disruption into sovereign capability within five months?";

function Claims({ title, items, facts }: { title: string; items: DecisionBrief["effects"]["first"]; facts: Facts }) {
  return (
    <div className="grid content-start gap-2"><h4 className="eyebrow">{title}</h4>
      <Stagger as="ul" className="grid gap-2">{items.map((c) => (
        <StaggerItem as="li" key={c.text} className="border-s-2 border-primary/50 ps-3 text-[14px]">{c.text}
          <div className="mt-1 flex flex-wrap gap-1 text-[12px]"><Badge tone={c.confidence === "high" ? "ok" : c.confidence === "medium" ? "warn" : "neutral"}>{c.confidence} confidence</Badge>
            {c.evidenceRefs.map((r) => <span key={r} className="sys text-ink-faint" title={Object.values(facts).find((f) => f.ref === r)?.label}>{r.split(":").slice(-1)[0]}</span>)}</div></StaggerItem>
      ))}</Stagger>
    </div>
  );
}

export function GovernorModule() {
  const can = useCan();
  const s = useSession();
  const [eid, setEid] = useState<string | null>(null);
  const [q, setQ] = useState(DEFAULT_Q);
  const [focus, setFocus] = useState<string>("Analyze this situation");
  const [b, setB] = useState<{ brief: DecisionBrief; facts: Facts } | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [coordMove, setCoordMove] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => { api<{ engagements: Array<{ id: string }> }>("/engagements").then((r) => r.ok && setEid(r.data.engagements[0]?.id ?? null)); }, []);
  const load = useCallback(() => {
    if (!eid) return;
    api<{ packages: Pkg[] }>(`/engagements/${eid}/packages`).then((r) => r.ok && setPkgs(r.data.packages));
    api<{ entries: Entry[] }>(`/engagements/${eid}/ledger`).then((r) => r.ok && setLedger(r.data.entries));
  }, [eid]);
  useEffect(() => { load(); }, [load]);

  async function ask(prompt?: string) {
    if (prompt) setFocus(prompt);
    const r = await api<{ brief: DecisionBrief; facts: Facts }>(`/engagements/${eid}/brief`, { json: { question: q } });
    if (r.ok) { setB(r.data); setMsg(null); load(); } else setMsg(r.message);
  }
  async function makePackage() {
    const r = await api<{ packageId: string }>(`/engagements/${eid}/packages`, { json: { question: q } });
    setMsg(r.ok ? "Decision package created and written to the Ledger." : r.message); load();
  }
  async function decide(id: string, decision: "approve" | "reject" | "request_changes") {
    const r = await api<{ owners: number; coordination: { from: number; to: number } | null }>(`/packages/${id}/decision`, { json: { decision, comment } });
    if (r.ok) { setMsg(decision === "approve" ? `Approved. ${r.data.owners} owners assigned; coordination debt ${r.data.coordination?.from?.toFixed(1)} → ${r.data.coordination?.to?.toFixed(1)}.` : "Recorded."); setComment(""); if (decision === "approve") { setPulse((p) => p + 1); if (r.data.coordination) setCoordMove(r.data.coordination); } }
    else setMsg(r.message);
    load();
  }
  const section = (k: string) => focus === k || focus === "Analyze this situation" || focus === "Generate executive brief";

  return (
    <>
      <PageHeader nav="nav.governor" description="Ask the leadership question. The answer is a decision brief built from the engine's facts, with first, second and third-order effects, options, the authority it needs and a 72-hour plan; it becomes a decision package for a named approver." />
      <div className="grid gap-4">
        <Panel>
          <PanelHeader eyebrow="Governor question" title="A briefing, not a chat" actions={<span className="sys text-ink-faint">demo mode · cached briefs · numbers from the engine only</span>} />
          <div className="grid gap-3 p-4">
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} aria-label="Governor question" className="w-full border border-line bg-surface p-3 font-serif text-[20px]" />
            <div className="flex flex-wrap gap-1.5">{QUICK_PROMPTS.map((p) => (
              <button key={p} type="button" onClick={() => (p === "Create decision package" ? makePackage() : ask(p))} disabled={!eid} className={`border px-2.5 py-1 text-[12.5px] font-mono uppercase tracking-[0.08em] ${focus === p ? "border-primary bg-primary-soft text-accent" : "border-line text-ink-muted hover:border-primary"}`}>{p}</button>
            ))}</div>
            <div className="flex flex-wrap items-center gap-3"><Button variant="primary" onClick={() => ask()} disabled={!eid}><Send />Brief me</Button>{msg && <span role="status" className="text-[13px] text-ink-muted">{msg}</span>}</div>
          </div>
        </Panel>

        <AnimatePresence mode="wait">
        {b && (
          <motion.div key={`${b.brief.meta.inputHash}-${focus}`} initial={{ opacity: 0, y: 28, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={spring}>
          <Panel>
            <PanelHeader eyebrow="Decision brief" title={b.brief.question} actions={<><DataLabel kind="MODELLED" /><Badge tone="ok"><ShieldCheck />numbers checked against {Object.keys(b.facts).length} facts</Badge></>} />
            <Stagger className="grid gap-4 p-4">
              <StaggerItem><p className="max-w-[90ch] font-serif text-[18px] leading-relaxed">{b.brief.situation}</p></StaggerItem>
              {(section("What happens next?") || section("Show me the risks") || section("Where is the opportunity?")) && (
                <StaggerItem className="grid gap-4 lg:grid-cols-3"><Claims title="First order · shock" items={b.brief.effects.first} facts={b.facts} /><Claims title="Second order · exposure" items={b.brief.effects.second} facts={b.facts} /><Claims title="Third order · opportunity" items={b.brief.effects.third} facts={b.facts} /></StaggerItem>
              )}
              {section("Stress-test this recommendation") && (
                <StaggerItem className="grid gap-2"><h4 className="eyebrow">Options</h4>
                  <ol className="grid gap-2 md:grid-cols-3">{b.brief.options.map((o, i) => <li key={o.title} className="border border-line p-3 text-[13.5px]"><div className="font-medium">{i + 1}. {o.title}</div><p className="text-ink-muted">{o.tradeoffs}</p><p className="sys mt-1 text-ink-faint">value {b.facts[o.valueImpactKey]?.text} · risk {b.facts[o.riskKey]?.text}</p></li>)}</ol></StaggerItem>
              )}
              <StaggerItem className="grid gap-3 border-y border-line py-4 md:grid-cols-3">
                <div><div className="eyebrow">Recommendation</div><p className="text-[14px]">{b.brief.recommendation}</p></div>
                <div><div className="eyebrow">Who has authority?</div><p className="text-[14px]">{b.brief.authorityRequired}</p></div>
                <div><div className="eyebrow">What requires approval?</div><p className="text-[14px]">{b.brief.approvalThreshold}</p></div>
              </StaggerItem>
              <StaggerItem className="grid gap-4 lg:grid-cols-2">
                <div><h4 className="eyebrow mb-2">72-hour plan</h4><ol className="grid gap-1.5 text-[14px]">{b.brief.plan72h.map((p) => <li key={p.action} className="grid grid-cols-[48px_1fr] gap-2"><span className="tabular text-accent">+{p.dueHours}h</span><span>{p.action} <span className="text-ink-faint">· {p.owner}</span></span></li>)}</ol></div>
                <div><h4 className="eyebrow mb-2">Five-year implications</h4><ul className="grid gap-1.5 text-[14px]">{b.brief.fiveYearImplications.map((x) => <li key={x}>{x}</li>)}</ul>
                  <h4 className="eyebrow mb-1 mt-4">Assumptions</h4><ul className="grid gap-1 text-[13px] text-ink-muted">{b.brief.assumptions.map((x) => <li key={x}>{x}</li>)}</ul></div>
              </StaggerItem>
              <StaggerItem className="flex flex-wrap items-center gap-3"><span className="sys text-ink-faint">model {b.brief.meta.model} · {b.brief.meta.promptVersion} · input {b.brief.meta.inputHash}</span>
                {can("diagnostic.run") && <Button variant="primary" onClick={makePackage}><FileCheck2 />Create decision package</Button>}</StaggerItem>
            </Stagger>
          </Panel>
          </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence>
          {coordMove && (
            <motion.div key="coord" initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={spring}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-[color-mix(in_oklab,var(--ok)_35%,var(--line))] bg-ok-soft px-4 py-3" role="status">
              <CheckCircle2 className="size-5 text-ok" />
              <span className="text-[13.5px] text-ink">Approved · owners named · written back into the diagnosis</span>
              <span className="flex items-baseline gap-2"><span className="eyebrow">Coordination debt</span>
                <span className="tabular font-serif text-[15px] text-ink-muted line-through">{coordMove.from.toFixed(1)}</span><span aria-hidden>→</span>
                <CountUp className="tabular font-serif text-[26px] leading-none text-ok" value={coordMove.to.toFixed(1)} from={coordMove.from} duration={1.8} /></span>
              <span className="text-[12.5px] text-ink-muted">lower is better · <DataLabel kind="MODELLED" /></span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel>
            <PanelHeader eyebrow="Decide · govern · coordinate" title="Decision packages" />
            {!pkgs.length ? <p className="p-4 text-ink-muted">No package yet. Brief the question, then create a package.</p> : (
              <ul className="grid gap-3 p-4"><AnimatePresence initial={false}>{pkgs.map((p) => (
                <motion.li key={p.id} layout initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring} className="text-[13.5px]">
                <Flash trigger={p.status} className="grid gap-2 border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2"><Gavel className="size-4 text-accent" /><span className="font-medium">{p.recommended}</span>
                    <AnimatePresence mode="popLayout" initial={false}><motion.span key={p.status} initial={{ opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} className="inline-flex">
                    <Badge tone={p.status === "approved" ? "ok" : p.status === "proposed" ? "warn" : "crit"}>{p.status === "approved" ? <CheckCircle2 /> : p.status === "proposed" ? <Gavel /> : <XCircle />}{p.status.replace("_", " ")}</Badge></motion.span></AnimatePresence></div>
                  <div className="text-ink-muted">Authority: {p.authority_required} · {p.approval_threshold}</div>
                  {p.status === "proposed" && can("decision.approve") && (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="grid min-w-[220px] flex-1 gap-1 text-[13px] text-ink-muted">Comment (required to reject)<input value={comment} onChange={(e) => setComment(e.target.value)} className="h-8 border border-line bg-surface px-2 text-ink" /></label>
                      <Button size="sm" variant="primary" onClick={() => decide(p.id, "approve")}>Approve as {s.principal.name}</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(p.id, "request_changes")}>Request changes</Button>
                      <Button size="sm" variant="danger" onClick={() => decide(p.id, "reject")}>Reject</Button>
                    </div>
                  )}
                  {p.decided_by_label && <div className="text-ink-faint">{p.status.replace("_", " ")} by {p.decided_by_label} · {formatDate(p.decided_at!, true)}{p.decision_comment ? ` · “${p.decision_comment}”` : ""}</div>}
                  {p.tasks.length > 0 && <Stagger as="ul" className="grid gap-1 border-t border-line pt-2">{p.tasks.map((t) => <StaggerItem as="li" key={t.action} className="grid grid-cols-[1fr_auto] gap-2"><span>{t.action} <span className="text-ink-faint">· owner {t.owner_label}</span></span><span className="tabular text-ink-faint">due {formatDate(t.due_at, true)}</span></StaggerItem>)}</Stagger>}
                </Flash>
                </motion.li>
              ))}</AnimatePresence></ul>
            )}
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Ledger" title="Append-only, hash-chained" actions={<Badge className="tabular"><CountUp value={ledger.length} duration={0.6} /></Badge>} />
            <ol className="grid max-h-[460px] gap-0 overflow-y-auto overflow-x-hidden"><AnimatePresence initial={false}>{ledger.map((e) => (
              <motion.li key={e.seq} layout initial={{ opacity: 0, x: 40, backgroundColor: "rgba(182,138,63,0.22)" }} animate={{ opacity: 1, x: 0, backgroundColor: "rgba(182,138,63,0)" }} transition={{ ...spring, backgroundColor: { duration: 2.2 } }} className="grid grid-cols-[56px_1fr] gap-2 border-b border-line/60 px-4 py-2 text-[13px]">
                <span className="tabular text-ink-faint">#{e.seq}</span>
                <span><span className="font-mono text-[12px] uppercase tracking-[0.06em] text-accent">{e.action}</span> · {e.actor_label}<span className="text-ink-faint"> · {formatDate(e.occurred_at, true)}</span>
                  <span className="sys block truncate text-ink-faint">hash {e.hash.slice(0, 20)}…</span></span>
              </motion.li>
            ))}</AnimatePresence></ol>
          </Panel>
        </div>
        <Panel className="overflow-hidden"><LayersScene pulseOnDecision={pulse} chrome={false} className="block h-auto w-full" /></Panel>
      </div>
    </>
  );
}
