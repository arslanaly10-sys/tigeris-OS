"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Cpu, Database, KeyRound, Layers3, ShieldAlert, Users, Workflow, XCircle, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";
import { usePrefs } from "../prefs";

type CheckStatus = "pass" | "warn" | "fail" | "planned";
type LayerStatus = "sovereign" | "partial" | "at_risk";
interface Layer { key: string; name: string; question: string; status: LayerStatus; checks: { label: string; status: CheckStatus; evidence: string }[] }
interface KeyRow { name: string; algorithm: string; purpose: string; custody: string; fingerprint: string | null; quantumSafe: boolean }
interface Planned { name: string; what: string; needs: string[] }
export interface Sovereignty { checkedAt: string; institution: string; residency: string; framework: string; summary: { sovereign: number; partial: number; atRisk: number }; layers: Layer[]; keys: KeyRow[]; planned: Planned[] }

const LAYER_ICON: Record<string, LucideIcon> = { compute: Cpu, data: Database, models: Layers3, keys: KeyRound, applications: Workflow, people: Users };
const LAYER_AR: Record<string, string> = { compute: "الحوسبة والاستضافة", data: "البيانات", models: "النماذج", keys: "المفاتيح والتشفير", applications: "التطبيقات والقرارات", people: "الأشخاص والرقابة" };
export const LAYER_STATUS: Record<LayerStatus, { label: string; ar: string; tone: "ok" | "warn" | "crit"; Icon: LucideIcon }> = {
  sovereign: { label: "Sovereign", ar: "سيادي", tone: "ok", Icon: CheckCircle2 },
  partial: { label: "Partly sovereign", ar: "سيادي جزئياً", tone: "warn", Icon: AlertTriangle },
  at_risk: { label: "At risk", ar: "معرّض للخطر", tone: "crit", Icon: ShieldAlert },
};
const CHECK: Record<CheckStatus, { label: string; tone: "ok" | "warn" | "crit" | "neutral"; Icon: LucideIcon }> = {
  pass: { label: "pass", tone: "ok", Icon: CheckCircle2 }, warn: { label: "warn", tone: "warn", Icon: AlertTriangle }, fail: { label: "fail", tone: "crit", Icon: XCircle }, planned: { label: "planned", tone: "neutral", Icon: Clock3 },
};
const TABS = [{ key: "stack", en: "Sovereignty stack", ar: "طبقات السيادة" }, { key: "keys", en: "Data and keys", ar: "البيانات والمفاتيح" }] as const;

export function SovereigntyModule() {
  const { lang } = usePrefs();
  const ar = lang === "ar";
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<"stack" | "keys">(params.get("tab") === "keys" ? "keys" : "stack");
  const [d, setD] = useState<Sovereignty | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Sovereignty>("/sovereignty").then((r) => (r.ok ? setD(r.data) : setError(r.message))); }, []);
  const open = (t: "stack" | "keys") => { setTab(t); router.replace(t === "stack" ? pathname : `${pathname}?tab=${t}`, { scroll: false }); };

  return (
    <>
      <PageHeader nav="nav.sovereignty" description="What TIGERIS keeps inside the institution's control, layer by layer: where it runs, where the data lives, which models run, who holds the keys, who decides and who oversees. Every line is checked live; capabilities this build does not have are shown as planned, never as working." />
      <div role="tablist" aria-label="Sovereignty" className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => open(t.key)} className={cn("-mb-px border-b-2 px-3 py-3 text-[14px] font-medium", tab === t.key ? "border-primary text-ink" : "border-transparent text-ink-faint hover:text-ink")}>
            {ar ? t.ar : t.en}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-md border border-crit/40 bg-crit-soft p-3 text-crit">{error}</p>}
      {!d && !error && <div className="h-72 animate-pulse rounded-lg bg-surface-2" />}
      {d && tab === "stack" && <Stack d={d} ar={ar} />}
      {d && tab === "keys" && <Keys d={d} />}
      {d && <p className="mt-5 text-[13px] text-ink-faint">Checked {formatDate(d.checkedAt, true)} for {d.institution}. Framework: {d.framework}.</p>}
    </>
  );
}

function Stack({ d, ar }: { d: Sovereignty; ar: boolean }) {
  return (
    <div className="grid gap-5">
      <Panel className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div><div className="text-[13px] text-ink-muted">Layers fully sovereign</div><div className="text-[34px] font-medium tabular leading-tight">{d.summary.sovereign} <span className="text-[18px] text-ink-faint">of {d.layers.length}</span></div></div>
        <div className="flex flex-wrap gap-2">
          {d.summary.partial > 0 && <Badge tone="warn"><AlertTriangle />{d.summary.partial} partly sovereign</Badge>}
          {d.summary.atRisk > 0 && <Badge tone="crit"><ShieldAlert />{d.summary.atRisk} at risk</Badge>}
          <Badge tone="info">{d.residency}</Badge>
        </div>
        <p className="max-w-[60ch] text-[14px] text-ink-muted">A layer is sovereign when every check passes. Planned items keep a layer partly sovereign until the pilot delivers them.</p>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        {d.layers.map((l, i) => {
          const Icon = LAYER_ICON[l.key] ?? Layers3;
          const st = LAYER_STATUS[l.status];
          return (
            <Panel key={l.key} id={`layer-${l.key}`}>
              <PanelHeader eyebrow={`Layer ${i + 1}`} title={<span className="flex items-center gap-2"><Icon className="size-4 text-accent" />{ar ? LAYER_AR[l.key] ?? l.name : l.name}</span>} actions={<Badge tone={st.tone}><st.Icon />{ar ? st.ar : st.label}</Badge>} />
              <p className="px-5 pt-4 text-[14px] text-ink-muted">{l.question}</p>
              <ul className="grid gap-3 p-5">
                {l.checks.map((c) => {
                  const k = CHECK[c.status];
                  return (
                    <li key={c.label} className="grid grid-cols-[84px_1fr] gap-3 text-[13px]">
                      <span><Badge tone={k.tone}><k.Icon />{k.label}</Badge></span>
                      <span><span className="block font-medium text-ink">{c.label}</span><span className="block text-ink-muted">{c.evidence}</span></span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Keys({ d }: { d: Sovereignty }) {
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader eyebrow="In use now, checked live" title="Keys and cryptography inventory" actions={<Badge>{d.keys.length} items</Badge>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Item", "Algorithm", "Purpose", "Custody", "Fingerprint", "Quantum"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {d.keys.map((k) => (
                <tr key={k.name} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3 font-medium">{k.name}</td>
                  <td className="px-4 py-3">{k.algorithm}</td>
                  <td className="px-4 py-3 text-ink-muted">{k.purpose}</td>
                  <td className="px-4 py-3 text-ink-muted">{k.custody}</td>
                  <td className="px-4 py-3">{k.fingerprint ? <span translate="no" className="font-mono text-[13px] text-ink-faint" title={k.fingerprint}>{k.fingerprint.slice(0, 16)}…</span> : <span className="text-ink-faint">—</span>}</td>
                  <td className="px-4 py-3">{k.quantumSafe ? <Badge tone="ok"><CheckCircle2 />resistant</Badge> : <Badge tone="warn"><AlertTriangle />migrate</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">Hashes (SHA-256) stay sound against quantum computers at their current length. The Ed25519 package signature is the one item to migrate; the plan is below.</p>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        {d.planned.map((p) => (
          <Panel key={p.name}>
            <PanelHeader eyebrow="Planned for the pilot" title={p.name} actions={<Badge><Clock3 />planned</Badge>} />
            <div className="grid gap-3 p-5 text-[13px]">
              <p className="text-[14px] text-ink-muted">{p.what}</p>
              <div><div className="mb-1 text-ink-faint">What it needs</div><ul className="list-disc ps-5 text-ink">{p.needs.map((n) => <li key={n}>{n}</li>)}</ul></div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/** Command Centre panel: the six layers at a glance. */
export function SovereigntyPanel() {
  const { lang } = usePrefs();
  const [d, setD] = useState<Sovereignty | null>(null);
  useEffect(() => { api<Sovereignty>("/sovereignty").then((r) => r.ok && setD(r.data)); }, []);
  return (
    <Panel>
      <PanelHeader eyebrow="Sovereignty" title={d ? `${d.summary.sovereign} of ${d.layers.length} layers fully sovereign` : "Sovereignty stack"} actions={<Link href="/sovereignty" className="text-[13px] text-accent">Open</Link>} />
      {!d && <div className="m-4 h-32 animate-pulse rounded bg-surface-2" />}
      {d && (
        <ul className="divide-y divide-line">
          {d.layers.map((l) => {
            const Icon = LAYER_ICON[l.key] ?? Layers3;
            const st = LAYER_STATUS[l.status];
            return (
              <li key={l.key}>
                <Link href={`/sovereignty#layer-${l.key}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-2">
                  <Icon className="size-4 shrink-0 text-accent" />
                  <span className="flex-1">{lang === "ar" ? LAYER_AR[l.key] ?? l.name : l.name}</span>
                  <Badge tone={st.tone}><st.Icon />{lang === "ar" ? st.ar : st.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
