"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, Crown, Lock, ScrollText } from "lucide-react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { DOCTRINES, LAYER_TEST, SOVEREIGN_DEFINITION, doctrine } from "@/content/sovereign";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { DataLabel } from "./data-label";
import { usePrefs } from "./prefs";
import { LAYER_STATUS } from "./modules/sovereignty";
import { CountUp, Reveal, Stagger, StaggerItem, spring } from "./motion-kit";
import { cn } from "@/lib/cn";

/**
 * The sovereign idea made visible (Doctrine 01–04): the definition page, the Doctrine page, the Boardroom panel
 * and the strip shown on every module. The Sovereign Capability Index is computed by the API from this
 * institution's records (GET /sovereignty/index) and labelled MODELLED; nothing here invents a figure.
 */
export interface SciFunction { key: string; label: string; doctrine: string; n: number; live: boolean; source: string; href: string }
export interface Sci {
  checkedAt: string; institution: string; residency: string; label: "MODELLED"; weightsStatus: string; score: number; formula: string;
  parts: Record<"control" | "convergence" | "operational", { value: number; weight: number; detail: string }>;
  functions: SciFunction[];
  layers: { key: string; name: string; status: "sovereign" | "partial" | "at_risk"; open: { label: string; status: string }[] }[];
  summary: { sovereign: number; partial: number; atRisk: number };
}

let cache: { at: number; p: Promise<Sci | null> } | null = null;
/** One request shared by every component on the page; refreshed after a minute. */
export function useSci() {
  const [d, setD] = useState<Sci | null>(null);
  useEffect(() => {
    if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), p: api<Sci>("/sovereignty/index").then((r) => (r.ok ? r.data : null)) };
    let live = true;
    cache.p.then((x) => live && setD(x));
    return () => { live = false; };
  }, []);
  return d;
}

const PART_LABEL = { control: "Control · six layers", convergence: "Convergence · Doctrine 01", operational: "Operationalisation · Doctrine 03" } as const;

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} whileInView={{ width: `${Math.round(value * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

function StatusChip({ s }: { s: "sovereign" | "partial" | "at_risk" }) {
  const st = LAYER_STATUS[s];
  return <Badge tone={st.tone}><st.Icon />{st.label}</Badge>;
}

/** The index, its formula and its three parts. */
export function SciPanel({ d, compact }: { d: Sci; compact?: boolean }) {
  return (
    <Panel>
      <PanelHeader eyebrow="Sovereign Capability Index" title="How sovereign this institution's intelligence is, today" actions={<DataLabel kind="MODELLED" />} />
      <div className={cn("grid gap-5 p-4", compact ? "" : "lg:grid-cols-[220px_minmax(0,1fr)]")}>
        <div className="grid content-start gap-1">
          <CountUp className="tabular font-serif text-[52px] leading-none text-heading" value={d.score.toFixed(1)} duration={1.6} />
          <span className="text-[12.5px] text-ink-muted">of 100 · higher is more sovereign</span>
          <span className="sys mt-2 text-[12px] text-ink-faint">{d.formula}</span>
          <span className="text-[12px] text-ink-faint">Weights {d.weightsStatus}.</span>
        </div>
        <ul className="grid gap-3">
          {(Object.keys(PART_LABEL) as (keyof typeof PART_LABEL)[]).map((k) => (
            <li key={k} className="grid gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"><span className="font-medium">{PART_LABEL[k]} <span className="text-ink-faint">× {d.parts[k].weight}</span></span><span className="tabular">{Math.round(d.parts[k].value * 100)}%</span></div>
              <Bar value={d.parts[k].value} />
              <span className="text-[12.5px] text-ink-muted">{d.parts[k].detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Doctrine 01 made concrete: the six functions, each live when this institution's records show it running. */
export function ConvergenceGrid({ d }: { d: Sci }) {
  return (
    <Stagger className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {d.functions.map((f) => (
        <StaggerItem key={f.key}>
          <Link href={f.href} className="group grid h-full gap-1 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-primary">
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{f.label}</span>
              {f.live ? <Badge tone="ok"><Check />Live</Badge> : <Badge><CircleDashed />Not yet</Badge>}
            </span>
            <span className="text-[12.5px] text-ink-muted">{f.doctrine}</span>
            <span className="sys text-[12px] text-ink-faint"><span className="tabular">{f.n.toLocaleString("en-GB")}</span> records · {f.source}</span>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** /sovereign: the definition, the test, sovereign against dependent, the index. */
export function SovereignModule() {
  const d = useSci();
  const status = (k: string) => d?.layers.find((l) => l.key === k);
  return (
    <>
      <PageHeader nav="nav.sovereign" description="What sovereign intelligence means in TIGERIS, the test each layer must pass, and how far this institution has come, computed from its own records." />
      <div className="grid gap-4">
        <Reveal>
          <section className="rounded-lg border border-line bg-surface p-5 sm:p-7">
            <p className="eyebrow mb-3 flex items-center gap-2"><Crown className="size-4" />Definition</p>
            <p className="max-w-[60ch] font-serif text-[22px] leading-snug text-heading sm:text-[26px]">{SOVEREIGN_DEFINITION.line}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <p className="text-[14px] text-ink-muted"><span className="font-medium text-ink">What it is not. </span>{SOVEREIGN_DEFINITION.not}</p>
              <p className="text-[14px] text-ink-muted"><span className="font-medium text-ink">The test. </span>{SOVEREIGN_DEFINITION.test}</p>
            </div>
          </section>
        </Reveal>

        {d ? <SciPanel d={d} /> : <div className="h-48 animate-pulse rounded-lg bg-surface-2" />}

        <Panel>
          <PanelHeader eyebrow="Doctrine 01 · Convergence" title="Six functions on one operating architecture" actions={d && <span className="sys text-ink-faint">{d.functions.filter((f) => f.live).length} of 6 live</span>} />
          <div className="p-4">{d ? <ConvergenceGrid d={d} /> : <div className="h-32 animate-pulse rounded bg-surface-2" />}</div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="The six-layer test" title="Sovereign or dependent, layer by layer" actions={<Link href="/sovereignty" className="tap inline-flex items-center gap-1 text-[13px] text-accent hover:underline">Every check, live<ArrowRight className="size-3.5 rtl:rotate-180" /></Link>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead><tr className="border-b border-line text-start text-ink-muted"><th className="px-4 py-2.5 text-start font-medium">Layer and its test</th><th className="px-4 py-2.5 text-start font-medium">Here, now</th><th className="px-4 py-2.5 text-start font-medium">Sovereign</th><th className="px-4 py-2.5 text-start font-medium">Dependent</th></tr></thead>
              <tbody>
                {LAYER_TEST.map((l) => {
                  const st = status(l.key);
                  return (
                    <tr key={l.key} className="border-b border-line/60 align-top">
                      <td className="px-4 py-3"><div className="font-medium">{l.name}</div><div className="text-ink-muted">{l.test}</div></td>
                      <td className="px-4 py-3">{st ? <div className="grid gap-1"><span><StatusChip s={st.status} /></span>{st.open.slice(0, 2).map((o) => <span key={o.label} className="text-[12px] text-ink-faint">{o.status === "planned" ? "Planned: " : "Open: "}{o.label}</span>)}</div> : "…"}</td>
                      <td className="px-4 py-3"><span className="inline-flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />{l.sovereign}</span></td>
                      <td className="px-4 py-3 text-ink-muted">{l.dependent}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Why it matters" title="The four doctrines" actions={<Link href="/doctrine" className="tap inline-flex items-center gap-1 text-[13px] text-accent hover:underline">Read the doctrine<ArrowRight className="size-3.5 rtl:rotate-180" /></Link>} />
          <Stagger className="grid gap-3 p-4 md:grid-cols-2">
            {DOCTRINES.map((x) => <StaggerItem key={x.n} className="rounded-lg border border-line p-4"><p className="eyebrow mb-2">Doctrine · {x.n} · {x.short}</p><p className="font-serif text-[16px] leading-snug text-heading">{x.text}</p></StaggerItem>)}
          </Stagger>
        </Panel>
      </div>
    </>
  );
}

const DIFF: [string, string, string][] = [
  ["Unit of value", "Throughput of one workflow", "A governed decision, from perception to capital allocation to learning"],
  ["Sovereignty", "A deployment option", "The definition: six layers checked live, planned items shown as planned"],
  ["Models", "Swap to the best model per task", "No model is the source of truth; numbers come from engines; foreign models off by default"],
  ["Scope", "One institution's back office", "Across the machinery of economic decision making: fund, ministries, central bank, regulator"],
  ["Proof", "Attestations on request", "Hash-chained Ledger, lineage on every figure, an index computed from the institution's records"],
];

/** /doctrine: the client's four doctrines verbatim, what each means in the OS, and where it is proved. */
export function DoctrineModule() {
  const { lang } = usePrefs();
  return (
    <>
      <PageHeader nav="nav.doctrine" description="The four statements TIGERIS is built on. Each one says what it means inside the OS and links to the screen that proves it." />
      <div className="grid gap-5">
        {DOCTRINES.map((x, i) => (
          <Reveal key={x.n} delay={i * 0.06}>
            <article className="grid gap-4 rounded-lg border border-line bg-surface p-5 sm:p-7 lg:grid-cols-[120px_minmax(0,1fr)]">
              <div className="flex items-start gap-3 lg:block">
                <span className="eyebrow">Doctrine</span>
                <span className="block font-serif text-[44px] leading-none text-accent lg:mt-1">{x.n}</span>
              </div>
              <div className="grid gap-3">
                <p className="max-w-[58ch] font-serif text-[22px] leading-snug text-heading sm:text-[26px]">{lang === "ar" ? x.ar : x.text}</p>
                {lang === "ar" && <p className="text-[13px] text-ink-faint">{x.text} <Badge tone="info">Arabic draft</Badge></p>}
                <p className="max-w-[80ch] text-[14px] text-ink-muted"><span className="font-medium text-ink">In the OS. </span>{x.means}</p>
                <div className="flex flex-wrap gap-2">{x.proof.map((p) => <Link key={p.href + p.label} href={p.href} className="tap inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] hover:border-primary">{p.label}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link>)}</div>
              </div>
            </article>
          </Reveal>
        ))}
        <Panel>
          <PanelHeader eyebrow="Positioning" title="A workflow OS digitises one institution. TIGERIS is the sovereign operating architecture above it." actions={<span className="sys text-ink-faint">docs/research/brain-co.md</span>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead><tr className="border-b border-line text-ink-muted"><th className="px-4 py-2.5 text-start font-medium"></th><th className="px-4 py-2.5 text-start font-medium">Vertical workflow OS</th><th className="px-4 py-2.5 text-start font-medium">TIGERIS</th></tr></thead>
              <tbody>{DIFF.map(([a, b, c]) => <tr key={a} className="border-b border-line/60 align-top"><td className="px-4 py-3 font-medium">{a}</td><td className="px-4 py-3 text-ink-muted">{b}</td><td className="px-4 py-3">{c}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

/** Boardroom: the sovereign position, what is open, and the next step to close it. */
export function BoardroomSovereign() {
  const d = useSci();
  if (!d) return <div className="h-40 animate-pulse rounded-lg bg-surface-2" />;
  const open = d.layers.flatMap((l) => l.open.filter((o) => o.status !== "planned").map((o) => ({ layer: l.name, ...o })));
  const planned = d.layers.flatMap((l) => l.open.filter((o) => o.status === "planned").map((o) => ({ layer: l.name, ...o })));
  const missing = d.functions.filter((f) => !f.live);
  const next = open[0] ? `Close "${open[0].label}" (${open[0].layer}).` : missing[0] ? `Bring ${missing[0].label.toLowerCase()} onto the record: ${missing[0].doctrine.toLowerCase()}.` : planned[0] ? `Start the pilot item "${planned[0].label}".` : "Hold the position; review at the next board.";
  return (
    <Panel>
      <PanelHeader eyebrow="Sovereign position" title={`${d.summary.sovereign} of ${d.layers.length} layers sovereign · SCI ${d.score.toFixed(1)}`} actions={<><DataLabel kind="MODELLED" /><Link href="/sovereign" className="tap text-[13px] text-accent hover:underline">How it is computed</Link></>} />
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {d.layers.map((l) => {
            const st = LAYER_STATUS[l.status];
            return (
              <StaggerItem key={l.key} className="grid gap-1.5 rounded-md border border-line p-2.5">
                <span className="text-[13px] font-medium">{l.name}</span>
                <span><Badge tone={st.tone}><st.Icon />{st.label}</Badge></span>
              </StaggerItem>
            );
          })}
        </Stagger>
        <div className="grid content-start gap-3 text-[13px]">
          <div><div className="eyebrow mb-1">Open now</div>{open.length ? <ul className="grid gap-1">{open.slice(0, 3).map((o) => <li key={o.label}><span className="text-ink-faint">{o.layer} · </span>{o.label}</li>)}</ul> : <p className="text-ink-muted">Nothing open outside the pilot plan.</p>}</div>
          <div><div className="eyebrow mb-1">Pilot plan</div><p className="text-ink-muted">{planned.length} items planned (HSM, encryption at rest, confidential computing, post-quantum); never shown as working.</p></div>
          <div className="rounded-md border border-[color-mix(in_oklab,var(--primary)_30%,var(--line))] bg-primary-soft p-3"><div className="eyebrow mb-1">Next step</div><p>{next}</p></div>
        </div>
      </div>
    </Panel>
  );
}

/** One doctrine, as a quiet band (Boardroom, Command Centre footers). */
export function DoctrineStrip({ n, className }: { n: string; className?: string }) {
  const x = doctrine(n);
  const { lang } = usePrefs();
  return (
    <Link href="/doctrine" className={cn("group flex items-start gap-3 border-y border-line py-3", className)}>
      <ScrollText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0"><span className="eyebrow me-2">Doctrine · {x.n}</span><span className="font-serif text-[15px] text-heading group-hover:underline">{lang === "ar" ? x.ar : x.text}</span></span>
    </Link>
  );
}

/** The strip on every module: what is sovereign right now, at a glance; opens the definition page. */
export function SovereignStrip() {
  const d = useSci();
  if (!d) return null;
  const st = d.summary.atRisk ? LAYER_STATUS.at_risk : d.summary.partial ? LAYER_STATUS.partial : LAYER_STATUS.sovereign;
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mb-4">
      <Link href="/sovereign" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-muted hover:border-primary">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink"><Lock className="size-3.5 text-primary" aria-hidden />Sovereign</span>
        <span className="inline-flex items-center gap-1"><st.Icon className="size-3.5" aria-hidden /><span className="tabular">{d.summary.sovereign}</span> of {d.layers.length} layers sovereign</span>
        <span>SCI <span className="tabular text-ink">{d.score.toFixed(1)}</span> · modelled</span>
        <span className="hidden sm:inline">{d.residency}</span>
        <span className="hidden md:inline"><span className="tabular">{d.functions.filter((f) => f.live).length}</span> of 6 functions live</span>
      </Link>
    </motion.div>
  );
}
