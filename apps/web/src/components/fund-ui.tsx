"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileText, FolderPlus, XCircle } from "lucide-react";
import { DEALS, FUND_DATA_LABEL, MANDATE, boardReport, fundSummary, icMemo, screenDeal, usd, type Verdict } from "@tigeris/shared";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan } from "./session-context";
import { usePrefs } from "./prefs";
import { downloadText } from "./diagnostic-ui";

/**
 * Fund applications on synthetic data (critical review, section 6): deal screening, IC memo preparation,
 * portfolio monitoring and board/LP reports. Every figure is computed in @tigeris/shared from the records;
 * no model computes anything. Taking a deal to committee opens an ordinary, audited case.
 */
type Tab = "screen" | "memo" | "monitor" | "report";
const TABS: Array<{ key: Tab; en: string; ar: string }> = [
  { key: "screen", en: "Deal screening", ar: "فرز الصفقات" },
  { key: "memo", en: "IC memo", ar: "مذكرة لجنة الاستثمار" },
  { key: "monitor", en: "Portfolio monitoring", ar: "مراقبة المحفظة" },
  { key: "report", en: "Board and LP report", ar: "تقرير المجلس والمستثمرين" },
];
const QUARTER = "Q3 2026";
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

function VerdictBadge({ v, label }: { v: Verdict | "advance" | "review" | "decline"; label?: string }) {
  const tone = v === "pass" || v === "advance" ? "ok" : v === "watch" || v === "review" ? "warn" : "crit";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : XCircle;
  const word = label ?? (v === "fail" ? "breach" : v === "pass" ? "pass" : v);
  return <Badge tone={tone}><Icon />{word}</Badge>;
}

export function FundModule() {
  const { lang } = usePrefs();
  const ar = lang === "ar";
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "screen") as Tab;
  const dealKey = DEALS.find((d) => d.key === params.get("deal"))?.key ?? DEALS[0]!.key;
  const go = (q: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(q)) next.set(k, v);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  return (
    <>
      <PageHeader nav="nav.fund" description="Four applications a fund team can use in week one: screen deals against the mandate, draft the IC memo, monitor the portfolio and prepare the board and LP report. All companies and figures here are synthetic; every number is computed from the records, and taking a deal to committee opens an audited case." />
      <p className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted"><Badge>synthetic</Badge>{ar ? "شركات وأرقام خيالية للعرض" : FUND_DATA_LABEL}. {ar ? "التفويض:" : "Mandate:"} {MANDATE.name}</p>
      <div role="tablist" aria-label={ar ? "تطبيقات الصندوق" : "Fund apps"} className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go({ tab: t.key })} className={cn("-mb-px border-b-2 px-3 py-3 text-[14px] font-medium", tab === t.key ? "border-primary text-ink" : "border-transparent text-ink-faint hover:text-ink")}>{ar ? t.ar : t.en}</button>
        ))}
      </div>
      {tab === "screen" && <Screening selected={dealKey} onSelect={(k) => go({ deal: k })} onMemo={(k) => go({ tab: "memo", deal: k })} />}
      {tab === "memo" && <Memo dealKey={dealKey} onSelect={(k) => go({ deal: k })} />}
      {tab === "monitor" && <Monitoring />}
      {tab === "report" && <BoardReport />}
    </>
  );
}

function Screening({ selected, onSelect, onMemo }: { selected: string; onSelect: (k: string) => void; onMemo: (k: string) => void }) {
  const screens = DEALS.map((d) => screenDeal(d));
  const s = screens.find((x) => x.deal.key === selected)!;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Panel>
        <PanelHeader eyebrow="Pipeline" title={`${DEALS.length} deals screened against the mandate`} />
        <ul className="grid">
          {screens.map((x) => (
            <li key={x.deal.key}>
              <button type="button" onClick={() => onSelect(x.deal.key)} aria-current={x.deal.key === selected} className={cn("grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-3 text-start text-[13px] hover:bg-surface-2", x.deal.key === selected && "bg-primary-soft/30")}>
                <span><span className="text-[14px] font-medium">{x.deal.name}</span><br /><span className="text-ink-muted">{x.deal.key} · {x.deal.sector} · {x.deal.geography} · <span className="tabular">{usd(x.deal.ticketUsd)}</span></span></span>
                <VerdictBadge v={x.result} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <PanelHeader eyebrow={`${s.deal.key} · ${s.deal.stage}`} title={s.deal.name} actions={<VerdictBadge v={s.result} />} />
        <div className="grid gap-4 p-4 text-[13px]">
          <p className="text-[14px]">{s.deal.thesis}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {[["Ticket", `${usd(s.deal.ticketUsd)} for ${pct(s.deal.ownership, 0)}`], ["Implied EV", usd(s.impliedEvUsd)], ["EV / EBITDA", `${s.evToEbitda.toFixed(1)}x`], ["Net debt / EBITDA", `${s.leverage.toFixed(1)}x`]].map(([k, v]) => (
              <div key={k}><dt className="text-ink-faint">{k}</dt><dd className="tabular text-[15px]">{v}</dd></div>
            ))}
          </dl>
          <table className="w-full">
            <thead><tr className="border-b border-line text-ink-faint"><th className="py-1.5 text-start font-medium">Mandate check</th><th className="py-1.5 text-start font-medium">Result</th><th className="py-1.5 text-start font-medium">Why</th></tr></thead>
            <tbody>{s.criteria.map((c) => (
              <tr key={c.key} className="border-b border-line/60 align-top"><td className="py-2 pe-3">{c.label}</td><td className="py-2 pe-3"><VerdictBadge v={c.verdict} label={c.verdict === "fail" ? "fail" : undefined} /></td><td className="py-2 text-ink-muted">{c.detail}</td></tr>
            ))}</tbody>
          </table>
          <p className="text-ink-faint">Source: {s.deal.source}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => onMemo(s.deal.key)}><FileText />Draft the IC memo</Button>
            <ToCommittee dealKey={s.deal.key} declined={s.result === "decline"} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ToCommittee({ dealKey, declined }: { dealKey: string; declined: boolean }) {
  const can = useCan();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!can("case.create")) return <span className="self-center text-[13px] text-ink-faint">Analysts open committee cases.</span>;
  if (declined) return <span className="self-center text-[13px] text-ink-faint">A mandate limit fails; it cannot go to committee without a mandate change.</span>;
  async function open() {
    setBusy(true);
    const r = await api<{ caseKey: string }>(`/fund/deals/${dealKey}/case`, { method: "POST" });
    setBusy(false);
    if (r.ok) router.push(`/cases/${r.data.caseKey}`); else setMsg(r.message);
  }
  return <><Button size="sm" variant="primary" disabled={busy} onClick={open}><FolderPlus />{busy ? "Opening…" : "Take to committee as a case"}</Button>{msg && <span role="alert" className="self-center text-[13px] text-warn">{msg}</span>}</>;
}

function Memo({ dealKey, onSelect }: { dealKey: string; onSelect: (k: string) => void }) {
  const s = screenDeal(DEALS.find((d) => d.key === dealKey)!);
  const text = icMemo(s);
  return (
    <Panel>
      <PanelHeader eyebrow="IC memo, first draft" title={s.deal.name} actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[13px] text-ink-muted"><span className="sr-only">Deal</span>
            <select value={dealKey} onChange={(e) => onSelect(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink">{DEALS.map((d) => <option key={d.key} value={d.key}>{d.key} · {d.name}</option>)}</select></label>
          <Button size="sm" variant="ghost" onClick={() => downloadText(`IC-memo-${s.deal.key}.md`, text)}><Download />Download</Button>
        </div>} />
      <p className="px-4 pt-3 text-[13px] text-ink-muted">Assembled from the deal record and the mandate screen only; no model wrote it. A named analyst reviews every line before committee.</p>
      <pre className="m-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-4 font-mono text-[13px] leading-relaxed">{text}</pre>
    </Panel>
  );
}

function Monitoring() {
  const f = fundSummary();
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Portfolio value", usd(f.value), `${f.qoq >= 0 ? "+" : ""}${pct(f.qoq)} this quarter`], ["Invested", usd(f.invested), `${f.moic.toFixed(2)}x multiple on invested capital`], ["In breach", String(f.breaches.length), f.breaches.map((x) => x.holding.name).join(", ") || "none"], ["On watch", String(f.watch.length), f.watch.map((x) => x.holding.name).join(", ") || "none"]].map(([k, v, sub]) => (
          <Panel key={k} className="p-4"><div className="text-[13px] text-ink-faint">{k}</div><div className="tabular text-[24px] font-medium">{v}</div><div className="text-[13px] text-ink-muted">{sub}</div></Panel>
        ))}
      </div>
      <Panel>
        <PanelHeader eyebrow={`Holdings · ${QUARTER}`} title="Covenants, plan, value and runway" actions={<Badge>synthetic</Badge>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Holding", "Status", "Value", "Quarter", "Covenant", "Plan", "Runway", "Note"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{f.monitored.map((x) => {
              const c = (k: string) => x.checks.find((y) => y.key === k)!;
              return (
                <tr key={x.holding.key} className="border-b border-line/60 align-top">
                  <td className="px-4 py-2"><span className="font-medium">{x.holding.name}</span><div className="text-ink-faint">{x.holding.sector}</div></td>
                  <td className="px-4 py-2"><VerdictBadge v={x.status} label={x.status === "fail" ? "breach" : x.status === "watch" ? "watch" : "on track"} /></td>
                  <td className="whitespace-nowrap px-4 py-2 tabular">{usd(x.holding.valueUsd)}</td>
                  <td className="whitespace-nowrap px-4 py-2 tabular">{x.qoq >= 0 ? "+" : ""}{pct(x.qoq)}</td>
                  {(["covenant", "plan", "runway"] as const).map((k) => <td key={k} className="px-4 py-2"><span className="flex items-start gap-1.5"><VerdictIcon v={c(k).verdict} /><span className="text-ink-muted">{c(k).detail}</span></span></td>)}
                  <td className="px-4 py-2 text-ink-muted">{x.holding.note}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
function VerdictIcon({ v }: { v: Verdict }) {
  return v === "pass" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" aria-label="pass" /> : v === "watch" ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-label="watch" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-crit" aria-label="breach" />;
}

function BoardReport() {
  const text = boardReport(QUARTER);
  return (
    <Panel>
      <PanelHeader eyebrow={`Board and LP report · ${QUARTER}`} title="Computed from the holding records" actions={<Button size="sm" variant="ghost" onClick={() => downloadText(`board-LP-report-${QUARTER.replace(" ", "-")}.md`, text)}><Download />Download</Button>} />
      <p className="px-4 pt-3 text-[13px] text-ink-muted">Every figure is arithmetic on the synthetic holding records. Exports of real reports go through Reports, with the policy's redaction for each audience.</p>
      <pre className="m-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-4 font-mono text-[13px] leading-relaxed">{text}</pre>
    </Panel>
  );
}
