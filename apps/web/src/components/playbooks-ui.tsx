"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpenCheck, ChevronRight, FolderPlus, Scale, ShieldCheck } from "lucide-react";
import { COUNCIL_PROMOTION_THRESHOLD, GAPS, LOOP_STAGES, PLAYBOOKS, SPECIALISTS, type GapKey, type Playbook } from "@tigeris/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { LOOP_AR, PLAYBOOKS_AR, SPECIALISTS_AR } from "@/lib/playbooks-ar";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { usePrefs } from "./prefs";

/**
 * Sovereign playbooks (Tiger Capital's thirteen worked scenarios). Each shows the six-stage governed loop, the
 * specialist hand-off, the recommended path against its counterfactual, and how value and memory are kept.
 * "Start a case" opens a real case from the playbook; nothing executes.
 */
const gapName = (k: GapKey, ar: boolean) => { const g = GAPS.find((x) => x.key === k)!; return ar ? g.nameAr : g.name; };

export function PlaybooksModule() {
  const { lang } = usePrefs();
  const ar = lang === "ar";
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const gap = (params.get("gap") as GapKey | null) ?? null;
  const list = gap ? PLAYBOOKS.filter((p) => p.gaps.includes(gap)) : PLAYBOOKS;
  const selected = PLAYBOOKS.find((p) => p.key === params.get("p")) ?? list[0] ?? PLAYBOOKS[0]!;
  const go = (q: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(q)) (v ? next.set(k, v) : next.delete(k));
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <>
      <PageHeader nav="nav.playbooks" description="Thirteen governed playbooks from Tiger Capital's TIGERIS doctrine. Each runs the same six-stage loop and specialist hand-off, weighs a recommended path against its counterfactual, and says what evidence would prove the value. Start a case from any of them." />
      <Loop ar={ar} />

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by gap">
        <span className="text-[13px] text-ink-muted">{ar ? "حسب الفجوة:" : "By gap:"}</span>
        <button type="button" onClick={() => go({ gap: null })} className={cn("rounded-md border px-2.5 py-1 text-[13px]", !gap ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-muted hover:text-ink")}>{ar ? "الكل" : "All"} ({PLAYBOOKS.length})</button>
        {GAPS.map((g) => {
          const n = PLAYBOOKS.filter((p) => p.gaps.includes(g.key)).length;
          return n ? <button key={g.key} type="button" onClick={() => go({ gap: g.key, p: null })} className={cn("rounded-md border px-2.5 py-1 text-[13px]", gap === g.key ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-muted hover:text-ink")}>{ar ? g.nameAr : g.name} ({n})</button> : null;
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <Panel className="lg:sticky lg:top-[72px]">
          <PanelHeader eyebrow={ar ? "دليل التشغيل" : "Playbooks"} title={`${list.length} ${ar ? "سيناريو" : list.length === 1 ? "scenario" : "scenarios"}`} />
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.key}>
                <button type="button" onClick={() => go({ p: p.key })} aria-current={p.key === selected.key ? "true" : undefined}
                  className={cn("flex w-full items-start gap-2 px-4 py-3 text-start text-[14px] hover:bg-surface-2", p.key === selected.key && "bg-surface-2")}>
                  <BookOpenCheck className={cn("mt-0.5 size-4 shrink-0", p.key === selected.key ? "text-accent" : "text-ink-faint")} />
                  <span className="min-w-0 flex-1"><span className="block font-medium">{ar ? PLAYBOOKS_AR[p.key]?.title ?? p.title : p.title}</span><span className="block text-[13px] text-ink-faint">{p.gaps.map((g) => gapName(g, ar)).join(" · ")}</span></span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-faint rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <PlaybookDetail pb={selected} ar={ar} />
      </div>
    </>
  );
}

function Loop({ ar }: { ar: boolean }) {
  return (
    <Panel>
      <PanelHeader eyebrow={ar ? "ست مراحل محكومة" : "Six governed stages"} title={ar ? "من النية السيادية إلى قدرة دائمة" : "From sovereign intent to enduring capability"}
        actions={<Badge tone="gold"><Scale />{ar ? `حد الرفع إلى المجلس ${COUNCIL_PROMOTION_THRESHOLD}` : `Council promotion at ${COUNCIL_PROMOTION_THRESHOLD} confidence`}</Badge>} />
      <ol className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-6">
        {LOOP_STAGES.map((s, i) => (
          <li key={s.key} className="bg-surface p-4">
            <div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[13px] font-medium text-accent">{i + 1}</span><span className="font-medium">{ar ? LOOP_AR[s.key]?.name : s.name}</span></div>
            <p className="mt-2 text-[13px] text-ink-muted">{ar ? LOOP_AR[s.key]?.body : s.body}</p>
          </li>
        ))}
      </ol>
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-muted">{ar ? "لا يُعتمد أي إجراء تلقائياً. حتى داخل نطاق قرار معتمد مسبقاً، يحتاج كل إجراء إلى اعتماد بشري." : "Authorization is never automatic. Even inside a pre-approved decision envelope, every action needs a human authorization. “Speed with authority. Never speed instead of authority.”"}</p>
    </Panel>
  );
}

function PlaybookDetail({ pb, ar }: { pb: Playbook; ar: boolean }) {
  const can = useCan();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = ar ? PLAYBOOKS_AR[pb.key] : undefined;
  async function start() {
    setBusy(true); setError(null);
    const r = await api<{ caseKey: string }>(`/playbooks/${pb.key}/case`, { json: {} });
    setBusy(false);
    if (r.ok) router.push(`/cases/${r.data.caseKey}`); else setError(r.message);
  }
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader eyebrow={pb.gaps.map((g) => gapName(g, ar)).join(" · ")} title={<span className="text-[20px]">{t?.title ?? pb.title}</span>}
          actions={<div className="flex flex-wrap justify-end gap-2"><Badge tone="gold">{ar ? "توضيحي" : "Illustrative"}</Badge>
            {can("case.create") && <Button size="sm" variant="primary" disabled={busy} onClick={start}><FolderPlus />{busy ? (ar ? "جارٍ الفتح…" : "Opening…") : ar ? "ابدأ حالة" : "Start a case"}</Button>}</div>} />
        <div className="grid gap-4 p-5 text-[14px]">
          <p className="font-serif text-[18px] leading-snug text-accent">{t?.doctrine ?? pb.doctrine}</p>
          <dl className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <dt className="text-ink-muted">{ar ? "النية" : "Intent"}</dt><dd className="max-w-[62ch]">{t?.intent ?? pb.intent}</dd>
            <dt className="text-ink-muted">{ar ? "السيناريو" : "Scenario"}</dt><dd className="max-w-[62ch]">{pb.scenario}</dd>
            <dt className="text-ink-muted">{ar ? "القيد" : "Constraint"}</dt><dd className="max-w-[62ch]"><ShieldCheck className="me-1 inline size-4 text-ok" />{pb.constraint}</dd>
          </dl>
          {pb.frictions.length > 0 && (
            <div><div className="eyebrow mb-1 text-ink-faint">{ar ? "كيف تظهر المشكلة اليوم" : "How it shows up today"}</div>
              <ul className="grid list-disc gap-1 ps-5 text-ink-muted">{pb.frictions.map((f) => <li key={f}>{f}</li>)}</ul></div>
          )}
          {error && <p role="alert" className="text-[13px] text-crit">{error}</p>}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow={ar ? "تسليم بين المتخصصين" : "Specialist hand-off"} title={ar ? "من الرصد إلى الحوكمة" : "Sentinel to Governance"} />
        <ol className="grid gap-0 p-5">
          {SPECIALISTS.slice(0, -1).map((s, i) => (
            <li key={s} className="grid grid-cols-[150px_1fr] gap-3 border-s border-line-strong pb-4 ps-4 last:pb-0 sm:grid-cols-[190px_1fr]">
              <span className="relative text-[13px] font-medium"><span className="absolute -start-[21px] top-1 size-2.5 rounded-full bg-primary" />{ar ? SPECIALISTS_AR[s] : s} <ArrowRight className="inline size-3.5 text-ink-faint rtl:rotate-180" /> {ar ? SPECIALISTS_AR[SPECIALISTS[i + 1]!] : SPECIALISTS[i + 1]}</span>
              <span className="text-[14px] text-ink-muted">{pb.handoffs[i]}</span>
            </li>
          ))}
        </ol>
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-muted"><span className="text-ink">{ar ? "الرسم: " : "Graph: "}</span>{pb.graph}</p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel className="border-primary/50 p-5">
          <div className="eyebrow text-accent">{ar ? "المسار الموصى به" : "Recommended path"}</div>
          <p className="mt-2 text-[15px]">{t?.recommended ?? pb.recommended}</p>
          <p className="mt-3 text-[13px] text-ink-muted">{pb.outcome}</p>
        </Panel>
        <Panel className="p-5">
          <div className="eyebrow text-ink-faint">{ar ? "البديل" : "Counterfactual"}</div>
          <p className="mt-2 text-[15px]">{t?.counterfactual ?? pb.counterfactual}</p>
          <p className="mt-3 text-[13px] text-ink-muted"><span className="text-ink">{ar ? "المفاضلة: " : "Trade-off: "}</span>{pb.tradeoff}</p>
        </Panel>
      </div>

      <Panel className="grid gap-px bg-line md:grid-cols-2">
        <div className="bg-surface p-5 text-[14px]"><div className="eyebrow mb-1 text-ink-faint">{ar ? "قبل احتساب القيمة" : "Before claiming value"}</div><p className="text-ink-muted">{pb.validate}</p></div>
        <div className="bg-surface p-5 text-[14px]"><div className="eyebrow mb-1 text-ink-faint">{ar ? "ما تحفظه الذاكرة" : "What memory keeps"}</div><p className="text-ink-muted">{pb.memory}</p></div>
      </Panel>
      <p className="text-[13px] text-ink-faint">
        {ar ? "سيناريو توضيحي من عقيدة تايغر كابيتال؛ لا أدلة متصلة ولا معاملات حية ولا قيمة مقاسة." : "Illustrative scenario from Tiger Capital's TIGERIS doctrine: no connected evidence, live transactions or measured value. A case started from it begins at “detected” and needs the institution's own evidence."}
        {pb.inOs && <> <Link href={pb.inOs.href} className="tap text-accent hover:underline">{ar ? "انظره في النظام" : `See the pattern in the OS: ${pb.inOs.label.toLowerCase()}`}</Link></>}
      </p>
    </div>
  );
}

/** Small list for the gap diagnostic: the playbooks that close one gap. */
export function PlaybookLinks({ gap }: { gap: GapKey }) {
  const items = PLAYBOOKS.filter((p) => p.gaps.includes(gap));
  if (!items.length) return null;
  return (
    <span className="text-[13px] text-ink-faint">
      Playbooks: {items.map((p, i) => <span key={p.key}>{i ? ", " : ""}<Link href={`/playbooks?gap=${gap}&p=${p.key}`} className="tap text-accent hover:underline">{p.title}</Link></span>)}
    </span>
  );
}
