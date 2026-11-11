"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, MinusCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ModeBadge } from "./modules/signals";

type Fit = "C" | "I" | "N";
interface Member { ref: string; kind: "signal" | "anomaly"; eventType: string; title: string; dataMode: string; at: string; detail: string; signalId?: string }
interface Finding {
  id: string; areaName: string; windowFrom: string; windowTo: string; title: string; members: Member[]; leading: string;
  hypotheses: Array<{ key: string; title: string; detail: string; consistent: number; inconsistent: number; neutral: number; rank: number; tiedWithLeader: boolean }>;
  matrix: Array<{ ref: string; fits: Record<string, Fit> }>; confidence: "low" | "medium" | "high"; confidenceBasis: string; dataModes: string[];
}
const FIT: Record<Fit, { label: string; tone: "ok" | "crit" | "neutral"; Icon: typeof CheckCircle2 }> = {
  C: { label: "consistent", tone: "ok", Icon: CheckCircle2 }, I: { label: "inconsistent", tone: "crit", Icon: XCircle }, N: { label: "neutral", tone: "neutral", Icon: MinusCircle },
};
const CONF_TONE = { low: "warn", medium: "info", high: "ok" } as const;

/** Intelligence correlation: related signals and voyage anomalies weighed against competing hypotheses. */
export function CorrelationView() {
  const [d, setD] = useState<{ findings: Finding[]; generatedAt: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api<{ findings: Finding[]; generatedAt: string }>("/correlation").then((r) => (r.ok ? setD(r.data) : setMsg(r.message))); }, []);
  async function download(f: Finding) {
    setMsg(null);
    const res = await fetch(`/api/correlation/${encodeURIComponent(f.id)}/package`, { credentials: "same-origin" });
    if (!res.ok) { setMsg("The source package could not be created. Reload this view and try again."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob()); a.download = `tigeris-source-package-${f.id}.json`; a.click();
    setMsg(`Source package downloaded. SHA-256 ${res.headers.get("x-content-sha256")?.slice(0, 16)}…; the export is on the audit trail.`);
  }
  if (!d) return msg ? <p role="alert" className="rounded-md border border-crit/40 bg-crit-soft p-3 text-crit">{msg}</p> : <div className="h-72 animate-pulse rounded-lg bg-surface-2" />;
  if (!d.findings.length) return <Panel className="p-6 text-ink-muted">No area has enough related events to correlate. A finding needs at least three events of two kinds in the same area within 72 hours.</Panel>;
  return (
    <div className="grid gap-4">
      <p className="max-w-[75ch] text-[14px] text-ink-muted">Signals and voyage anomalies in the same area and 72-hour window are weighed against competing explanations. Each item is marked consistent, inconsistent or neutral for each explanation; the one with the fewest inconsistencies ranks first (Analysis of Competing Hypotheses). Rules are fixed and listed in the source package; no model is involved and nothing is acted on.</p>
      {msg && <p role="status" className="text-[13px] text-ink-muted">{msg}</p>}
      {d.findings.map((f) => (
        <Panel key={f.id}>
          <PanelHeader eyebrow={`${f.areaName} · ${formatDate(f.windowFrom, true)} – ${formatDate(f.windowTo, true)}`} title={f.title}
            actions={<><Badge tone={CONF_TONE[f.confidence]}>Confidence: {f.confidence}</Badge>{f.dataModes.map((m) => <ModeBadge key={m} mode={m} />)}<Button size="sm" variant="primary" onClick={() => download(f)}><Download />Download source package</Button></>} />
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid content-start gap-3">
              <div className="text-[13px] text-ink-faint">Competing hypotheses, ranked{f.hypotheses.filter((x) => x.rank === 1).length > 1 ? " (a tie means more evidence is needed to tell them apart)" : ""}</div>
              <ol className="grid gap-2">
                {f.hypotheses.map((h) => (
                  <li key={h.key} className={`grid gap-1 rounded-md border p-3 text-[13px] ${h.rank === 1 ? "border-primary/60 bg-primary-soft" : "border-line"}`}>
                    <div className="flex flex-wrap items-center gap-2"><span className="tabular text-ink-faint">{h.rank}.</span><span className="font-medium text-ink">{h.title}</span>{h.rank === 1 && <Badge tone="gold">{f.hypotheses.filter((x) => x.rank === 1).length > 1 ? "Tied for first" : "Leading"}</Badge>}</div>
                    <div className="text-ink-muted">{h.detail}</div>
                    <div className="flex flex-wrap gap-2 tabular"><Badge tone="ok"><CheckCircle2 />{h.consistent} consistent</Badge><Badge tone="crit"><XCircle />{h.inconsistent} inconsistent</Badge><Badge><MinusCircle />{h.neutral} neutral</Badge></div>
                  </li>
                ))}
              </ol>
              <p className="text-[13px] text-ink-muted">{f.confidenceBasis}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead><tr className="border-b border-line text-ink-faint"><th className="px-3 py-2 text-start font-medium">Evidence ({f.members.length})</th>{f.hypotheses.map((h) => <th key={h.key} className="px-2 py-2 text-start font-medium">{h.title.split(" ").slice(0, 2).join(" ")}</th>)}</tr></thead>
                <tbody>
                  {f.members.map((m) => {
                    const fits = f.matrix.find((x) => x.ref === m.ref)?.fits ?? {};
                    return (
                      <tr key={m.ref} className="border-b border-line/60 align-top last:border-0">
                        <td className="px-3 py-2">
                          {m.signalId ? <Link href={`/signals?focus=${m.signalId}`} className="text-accent">{m.title}</Link> : <span>{m.title}</span>}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-ink-faint"><ModeBadge mode={m.dataMode} /><span>{m.kind === "anomaly" ? "voyage anomaly" : "signal"} · {formatDate(m.at, true)}</span></div>
                        </td>
                        {f.hypotheses.map((h) => { const x = FIT[fits[h.key] ?? "N"]; return <td key={h.key} className="px-2 py-2"><Badge tone={x.tone}><x.Icon />{x.label}</Badge></td>; })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}
