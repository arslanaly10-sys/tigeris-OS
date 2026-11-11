"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, ShieldCheck } from "lucide-react";
import { GAPS, QUESTION_COUNT, assess, reportMarkdown, type DiagnosticAnswer } from "@tigeris/shared";
import { AumInput, GapQuestionnaire, GapReport, aumFromInput, downloadText } from "@/components/diagnostic-ui";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";

/**
 * Public sovereign readiness check (commercial model, step 1). Runs entirely in the visitor's browser:
 * nothing typed here is sent anywhere or stored. It produces an indicative, self-reported report and points
 * to the paid briefing.
 */
export default function ReadinessCheck() {
  const [answers, setAnswers] = useState<Record<string, DiagnosticAnswer>>({});
  const [aum, setAum] = useState("");
  const [priority, setPriority] = useState("");
  const [done, setDone] = useState(false);
  const result = useMemo(() => assess(Object.values(answers), { aumUsd: aumFromInput(aum) }), [answers, aum]);
  const answered = Object.keys(answers).length;
  const date = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-full bg-bg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[max(16px,env(safe-area-inset-left,0px))] py-4 sm:px-8">
        <Wordmark />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">Indicative self-assessment</Badge>
          <Link href="/trust" className="tap inline-flex items-center gap-1 text-[13px] text-accent hover:underline"><ShieldCheck className="size-4" />Trust and security</Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1100px] gap-6 px-4 py-8 sm:px-8">
        <section className="grid gap-3">
          <p className="eyebrow text-accent">Sovereign readiness check</p>
          <h1 className="max-w-[24ch] text-[28px] font-medium leading-tight">More AI does not mean more sovereign capability.</h1>
          <p className="max-w-[60ch] text-[16px] text-ink-muted">Coordination debt, slow governance, lost memory and unmeasured AI spend widen the distance between sovereign intent and sovereign value. Answer {QUESTION_COUNT} questions across seven gaps to see where your institution stands and what closing the gaps could be worth. About 15 minutes.</p>
          <p className="text-[13px] text-ink-faint">Everything stays in your browser: nothing you enter is sent or stored.</p>
        </section>

        {!done ? (
          <>
            <Panel className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[13px] text-ink-muted sm:col-span-2">
                What strategic priority, decision challenge or intelligence gap would you most like to explore? (optional)
                <textarea value={priority} onChange={(e) => setPriority(e.target.value)} rows={2} maxLength={500} autoComplete="off" placeholder="e.g. Our exposure if a key shipping corridor closes for a month…" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[14px] text-ink" />
              </label>
              <AumInput value={aum} onChange={setAum} id="public-aum" />
            </Panel>
            <GapQuestionnaire answers={answers} setAnswers={setAnswers} showEvidence={false} />
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/95 py-3 backdrop-blur">
              <span className="text-[13px] text-ink-muted">{answered} of {QUESTION_COUNT} answered</span>
              <Button variant="primary" disabled={answered < GAPS.length} onClick={() => { setDone(true); window.scrollTo({ top: 0 }); }}>See my report<ArrowRight className="rtl:rotate-180" /></Button>
            </div>
          </>
        ) : (
          <>
            {priority.trim() && <Panel className="p-5 text-[14px]"><div className="eyebrow text-ink-faint">Your stated priority</div><p className="mt-1">{priority.trim()}</p></Panel>}
            <GapReport publicView result={result} meta={{ subject: "Your institution", dataMode: "Self-reported, indicative", synthetic: false, date }}
              actions={<Button size="sm" variant="secondary" onClick={() => downloadText("sovereign-readiness-check.md", (priority.trim() ? `Stated priority: ${priority.trim()}\n\n` : "") + reportMarkdown(result, { title: "Sovereign readiness check", subject: "Self-assessment", date, dataMode: "Self-reported, indicative" }))}><Download />Download report</Button>} />
            <Panel className="grid gap-3 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="text-[18px] font-medium">Turn this into an evidenced diagnostic</h2>
                <p className="mt-1 max-w-[60ch] text-[14px] text-ink-muted">An executive briefing tests these answers with your leadership, runs TIGERIS on your stated priority, and scopes a six-week diagnostic that measures each gap and builds the value case from your own data.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setDone(false)}>Change answers</Button>
                <Button variant="primary" asChild><a href="https://tigercapital.ai/" rel="noreferrer">Request an institutional briefing<ArrowRight className="rtl:rotate-180" /></a></Button>
              </div>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
