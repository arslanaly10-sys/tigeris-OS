"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { PACKS, assess, packByKey, type Pack } from "@/content/packs";
import { LAYER_TEST } from "@/content/sovereign";
import { api } from "@/lib/api";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { DataLabel } from "./data-label";
import { useCan } from "./session-context";
import { usePrefs } from "./prefs";
import { Stagger, StaggerItem, spring } from "./motion-kit";
import { useSci } from "./sovereign-ui";
import { LAYER_STATUS } from "./modules/sovereignty";
import { cn } from "@/lib/cn";

/**
 * Sovereign OS Packs (docs/research/brain-co.md): four domains, six workflows each, on one sovereign kernel.
 * The worked queue is synthetic; its verdicts come only from the deterministic rules in content/packs.ts, and
 * any item can be opened as a case for a named person to decide. Nothing executes.
 */
const icon = (n: string) => (Icons as unknown as Record<string, Icons.LucideIcon>)[n] ?? Icons.Circle;
const layerName = (k: string) => LAYER_TEST.find((l) => l.key === k)?.name ?? k;

export function PacksModule() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const pack = packByKey(params.get("pack")) ?? PACKS[0]!;
  const { lang } = usePrefs();
  const go = (k: string) => router.replace(`${path}?pack=${k}`, { scroll: false });
  return (
    <>
      <PageHeader nav="nav.packs" description="Four sovereign packs on one kernel: finance, health, insurance and government. Begin with one workflow, fit it to the institution's rules and authority, and add the next on the same record." />
      <div role="tablist" aria-label="Packs" className="mb-4 flex flex-wrap gap-2">
        {PACKS.map((p) => {
          const I = icon(p.icon);
          const on = p.key === pack.key;
          return (
            <button key={p.key} role="tab" aria-selected={on} onClick={() => go(p.key)} className={cn("relative inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[13.5px]", on ? "border-primary text-primary-ink" : "border-line bg-surface hover:border-primary")}>
              {on && <motion.span layoutId="pack-tab" className="absolute inset-0 rounded-md bg-primary" transition={spring} aria-hidden />}
              <I className="relative size-4" aria-hidden /><span className="relative">{lang === "ar" ? p.nameAr : p.name}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={pack.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
          <PackView p={pack} />
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function PackView({ p }: { p: Pack }) {
  const sci = useSci();
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-line bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="eyebrow mb-1.5">Sovereign OS pack</p>
          <h2 className="font-serif text-[24px] leading-tight">{p.name}</h2>
          <p className="mt-1.5 max-w-[80ch] font-serif text-[15px] text-ink">{p.line}</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">For: {p.who}</p>
        </div>
        <ol className="grid content-start gap-1.5 text-[13px] lg:w-[300px]">
          {["Begin with one workflow where speed, accuracy and control matter most", "Fit it to the institution's rules, data, authority matrix and review standard", "Add the next workflow on the same record, Ledger and memory"].map((s, i) => (
            <li key={s} className="grid grid-cols-[22px_1fr] gap-2"><span className="grid size-[22px] place-items-center rounded-full border border-primary text-[11px] text-primary">{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
      </section>

      <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {p.workflows.map((w) => (
          <StaggerItem key={w.name} className="h-full" whileHover={{ y: -3, transition: spring }}>
            <article className="grid h-full content-start gap-2 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-[16px] font-normal text-heading">{w.name}</h3>
                {w.href ? <Link href={w.href} className="tap shrink-0"><Badge tone="ok"><Icons.Check />In the OS</Badge></Link> : <Badge><Icons.PenLine />Pack design</Badge>}
              </div>
              <p className="text-[13px]">{w.does}</p>
              <dl className="grid gap-1 text-[12.5px]">
                <div className="grid grid-cols-[70px_1fr] gap-2"><dt className="text-ink-faint">Reads</dt><dd className="text-ink-muted">{w.reads}</dd></div>
                <div className="grid grid-cols-[70px_1fr] gap-2"><dt className="text-ink-faint">Checks</dt><dd className="text-ink-muted">{w.checks}</dd></div>
                <div className="grid grid-cols-[70px_1fr] gap-2"><dt className="text-ink-faint">Decides</dt><dd className="font-medium">{w.decides}</dd></div>
                <div className="grid grid-cols-[70px_1fr] gap-2"><dt className="text-ink-faint">Sovereign</dt><dd className="text-ink-muted">{layerName(w.layer)} layer{sci ? ` · ${LAYER_STATUS[sci.layers.find((l) => l.key === w.layer)?.status ?? "partial"].label.toLowerCase()} here` : ""}</dd></div>
              </dl>
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      <QueueView p={p} />

      {sci && (
        <Panel>
          <PanelHeader eyebrow="Beneath every pack" title="One sovereign kernel, checked live" actions={<Link href="/sovereign" className="tap text-[13px] text-accent hover:underline">What sovereign means</Link>} />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {sci.layers.map((l) => { const st = LAYER_STATUS[l.status]; return <div key={l.key} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-[13px]"><span>{l.name}</span><Badge tone={st.tone}><st.Icon />{st.label}</Badge></div>; })}
          </div>
          <p className="px-4 pb-4 text-[12.5px] text-ink-muted">Every pack runs in the institution's deployment, with its data under forced row-level security, local models with foreign models off by default, signed packages and a hash-chained Ledger, and a named person for every decision.</p>
        </Panel>
      )}
    </div>
  );
}

function QueueView({ p }: { p: Pack }) {
  const q = p.queue;
  const can = useCan();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const counts = q.items.reduce((a, it) => { const v = assess(q, it); a[v.label] = (a[v.label] ?? 0) + 1; return a; }, {} as Record<string, number>);
  async function open(id: string, title: string) {
    const it = q.items.find((i) => i.id === id)!;
    const v = assess(q, it);
    setBusy(id);
    const r = await api<{ caseKey: string }>(`/packs/${p.key}/cases`, { json: { itemId: id, title, workflow: q.name, verdict: v.label, failed: v.failed.map((f) => f.label) } });
    setBusy(null);
    if (r.ok) { setMsg(`Case ${r.data.caseKey} opened for ${id}.`); router.push(`/cases/${r.data.caseKey}`); } else setMsg(r.message);
  }
  return (
    <Panel>
      <PanelHeader eyebrow="Worked queue" title={q.name} actions={<><DataLabel kind="SYNTHETIC" /><span className="sys text-ink-faint">decided by {q.decider}</span></>} />
      <div className="grid gap-3 p-4">
        <p className="max-w-[100ch] text-[13px] text-ink-muted">{q.intro} The recommendation comes from these rules alone, with no model involved; a named person decides.</p>
        <div className="flex flex-wrap gap-2 text-[12.5px]">
          <Badge tone="ok"><Icons.CircleCheck />{counts["Ready for decision"] ?? 0} ready for decision</Badge>
          <Badge tone="warn"><Icons.CircleHelp />{counts["Needs information"] ?? 0} need information</Badge>
          <Badge tone="crit"><Icons.OctagonX />{counts["Hold"] ?? 0} on hold</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-muted"><th className="px-3 py-2 text-start font-medium">Item</th>{q.columns.map((c) => <th key={c.key} className="px-3 py-2 text-start font-medium">{c.label}</th>)}<th className="px-3 py-2 text-start font-medium">Rules</th><th className="px-3 py-2 text-start font-medium">Recommendation</th><th className="px-3 py-2" /></tr></thead>
              <tbody>
                {q.items.map((it) => {
                  const v = assess(q, it);
                  const VI = v.tone === "ok" ? Icons.CircleCheck : v.tone === "warn" ? Icons.CircleHelp : Icons.OctagonX;
                  return (
                    <motion.tr key={it.id} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={spring} className="border-b border-line/60 align-top">
                      <td className="px-3 py-2.5"><div className="font-medium">{it.title}</div><div className="sys text-[12px] text-ink-faint">{it.id}</div></td>
                      {q.columns.map((c) => <td key={c.key} className="px-3 py-2.5 tabular">{c.fmt ? c.fmt(it.f[c.key]) : String(it.f[c.key])}</td>)}
                      <td className="px-3 py-2.5">
                        <span className="tabular">{v.passed} of {v.total}</span>
                        <ul className="mt-1 grid gap-0.5 text-[12px]">{q.rules.map((r) => { const ok = r.test(it.f); return <li key={r.key} className={ok ? "text-ink-faint" : r.blocking ? "text-crit" : "text-warn"}>{ok ? "✓" : "✗"} {r.label}{ok ? "" : ` (${r.show(it.f)})`}</li>; })}</ul>
                      </td>
                      <td className="px-3 py-2.5"><Badge tone={v.tone}><VI />{v.label}</Badge></td>
                      <td className="px-3 py-2.5 text-end">{can("case.create") && <Button size="sm" variant="secondary" disabled={busy === it.id} onClick={() => open(it.id, it.title)}>Open as case</Button>}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
          </table>
        </div>
        {msg && <p role="status" className="text-[13px] text-ink-muted">{msg}</p>}
      </div>
    </Panel>
  );
}
