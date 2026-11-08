"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, FlaskConical, Printer, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useCan, useSession } from "./session-context";

interface Reports {
  briefs: Array<{ id: string; version: number; classification: string; content_hash: string; created_at: string; created_by_label: string; case_key: string; title: string; state: string; versions: number }>;
  backtests: Array<{ id: string; status: string; metrics: { episodes: number; mae_pp: number; loo_mae_pp: number; prior_mae_pp: number }; fitted: { response_pct_per_pct: number }; run_by_label: string; adopted_by_label: string | null; created_at: string }>;
  governance: { policy: { version: number; rules: number; tests: number; approvals: number; audiences: string[] }; audit30: Array<{ action: string; n: number }>; refusals30: number; decisions: Array<{ status: string; n: number }>; exports: Array<{ audience: string; n: number; redactions: number }>; models: Array<{ provider: string; outcome: string; n: number }> };
}

/** Reports (Q044): case briefs, back-test reports and the governance report, each with its classification. */
export function ReportsModule() {
  const can = useCan();
  const s = useSession();
  const [d, setD] = useState<Reports | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Reports>("/reports").then((r) => (r.ok ? setD(r.data) : setErr(r.message))); }, []);
  async function download(caseKey: string, audience: string) {
    const res = await fetch(`/api/cases/${caseKey}/brief.pdf?audience=${audience}`, { credentials: "same-origin" });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).message ?? "Export refused."); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(await res.blob()); a.download = `${caseKey}-${audience}.pdf`; a.click();
  }
  return (
    <>
      <PageHeader nav="nav.reports" description="Case briefs, back-test results and the governance report. Each carries its classification; exports are checked against the active policy and recorded on the audit trail." />
      {err && <Panel role="alert" className="mb-4 border-crit/40 bg-crit-soft p-3 text-[13px] text-crit">{err}</Panel>}
      {!d ? <div className="h-60 animate-pulse rounded-lg bg-surface-2" /> : (
        <div className="grid gap-5">
          <Panel>
            <PanelHeader eyebrow="Executive briefs" title="Latest brief per case" actions={<Badge className="tabular">{d.briefs.length}</Badge>} />
            {!d.briefs.length ? <p className="geo-pattern p-8 text-center text-ink-muted">No briefs yet. A brief is written each time the agent analysis runs on a case.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-[13px]">
                  <thead><tr className="border-b border-line text-ink-faint">{["Case", "Version", "Classification", "Written", "Export"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
                  <tbody>{d.briefs.map((b) => (
                    <tr key={b.id} className="border-b border-line/60">
                      <td className="px-4 py-2"><Link href={`/cases/${b.case_key}?tab=Options`} className="font-mono text-[12px] text-accent hover:underline">{b.case_key}</Link><div className="text-ink-muted">{b.title}</div></td>
                      <td className="px-4 py-2 tabular">v{b.version} of {b.versions}<div className="font-mono text-[11px] text-ink-faint">{b.content_hash.slice(0, 12)}</div></td>
                      <td className="px-4 py-2"><Badge tone="warn">{b.classification}</Badge></td>
                      <td className="px-4 py-2 text-ink-muted">{formatDate(b.created_at, true)}</td>
                      <td className="px-4 py-2">{can("export.create") ? <div className="flex flex-wrap gap-1">{["internal", "board", ...(s.principal.role === "executive" ? ["partner"] : [])].map((a) => <Button key={a} size="sm" variant="ghost" onClick={() => download(b.case_key, a)}><Download />{a}</Button>)}</div> : <span className="text-[12px] text-ink-faint">Needs export permission</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelHeader eyebrow="Back-testing" title="Calibration reports" actions={<FlaskConical className="size-4 text-accent" />} />
              <ul className="grid gap-2 p-4 text-[13px]">
                {!d.backtests.length && <li className="text-ink-muted">No back-test yet. Run one from Scenarios &amp; Foresight.</li>}
                {d.backtests.map((b) => (
                  <li key={b.id} className="grid gap-0.5 rounded-md border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium tabular">{b.fitted.response_pct_per_pct.toFixed(2)}% per 1% of supply</span><Badge tone={b.status === "adopted" ? "ok" : b.status === "proposed" ? "warn" : "neutral"}>{b.status}</Badge></div>
                    <div className="text-[12.5px] text-ink-muted tabular">{b.metrics.episodes} episodes · error {b.metrics.mae_pp.toFixed(1)} pp (assumption {b.metrics.prior_mae_pp.toFixed(1)} pp) · leave-one-out {b.metrics.loo_mae_pp.toFixed(1)} pp</div>
                    <div className="text-[12px] text-ink-faint">Run by {b.run_by_label}{b.adopted_by_label ? ` · adopted by ${b.adopted_by_label}` : ""} · {formatDate(b.created_at, true)}</div>
                  </li>
                ))}
                <li><Link href="/scenarios" className="text-[12.5px] text-accent hover:underline">Open the back-test with its chart and lineage</Link></li>
              </ul>
            </Panel>
            <Panel className="print:border-0">
              <PanelHeader eyebrow="Governance report" title={`Policy v${d.governance.policy.version} · last 30 days`} actions={<Button size="sm" variant="ghost" onClick={() => window.print()}><Printer />Print</Button>} />
              <div className="grid gap-3 p-4 text-[13px]">
                <p className="flex items-center gap-2"><ShieldCheck className="size-4 text-ok" />{d.governance.policy.rules} rules, {d.governance.policy.tests} tests, {d.governance.policy.approvals} approval requirements; export versions: {d.governance.policy.audiences.join(", ")}.</p>
                <dl className="grid grid-cols-3 gap-3 tabular">
                  <div><dt className="text-[12px] text-ink-faint">Refused or blocked</dt><dd className="text-[20px] font-semibold">{d.governance.refusals30}</dd></div>
                  <div><dt className="text-[12px] text-ink-faint">Decisions</dt><dd className="text-[20px] font-semibold">{d.governance.decisions.reduce((a, x) => a + x.n, 0)}</dd><dd className="text-[11.5px] text-ink-faint">{d.governance.decisions.map((x) => `${x.n} ${x.status}`).join(" · ") || "none"}</dd></div>
                  <div><dt className="text-[12px] text-ink-faint">Exports</dt><dd className="text-[20px] font-semibold">{d.governance.exports.reduce((a, x) => a + x.n, 0)}</dd><dd className="text-[11.5px] text-ink-faint">{d.governance.exports.map((x) => `${x.n} ${x.audience} (${x.redactions} withheld)`).join(" · ") || "none"}</dd></div>
                </dl>
                <div><div className="mb-1 text-[12px] text-ink-faint">Model calls by provider and outcome</div><p className="text-[12.5px] text-ink-muted">{d.governance.models.map((m) => `${m.provider} ${m.outcome}: ${m.n}`).join(" · ") || "none"}</p></div>
                <div><div className="mb-1 text-[12px] text-ink-faint">Audit events by action</div>
                  <ul className="grid grid-cols-2 gap-x-4 text-[12px]">{d.governance.audit30.map((a) => <li key={a.action} className="flex justify-between gap-2"><span className="truncate font-mono text-ink-muted">{a.action}</span><span className="tabular">{a.n}</span></li>)}</ul>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

interface Stats { sources: number; evidence: number; facts: number; entities: number; relationships: number; signals: number; cases: number; scenarioRuns: number; agentRuns: number; decisions: number; precedents: number; auditEvents: number; agents: number; policyVersion: number; policyRules: number; foreignModels: boolean; outbound: boolean }

/** Investor architecture page (Q057): how the system is built and what is running right now. */
export function ArchitecturePage() {
  const [st, setSt] = useState<Stats | null>(null);
  useEffect(() => { api<Stats>("/architecture/stats").then((r) => r.ok && setSt(r.data)); }, []);
  const n = (v: number | undefined) => (v === undefined ? "…" : v.toLocaleString("en-GB"));
  const layers: Array<{ x: number; title: string; lines: string[] }> = [
    { x: 20, title: "Collect", lines: ["Public sources", "Signed air-gap", "packages", `${n(st?.sources)} sources`] },
    { x: 160, title: "Validate", lines: ["Signature, hash,", "purpose, injection", "screen; vault", `${n(st?.evidence)} objects`] },
    { x: 300, title: "Know", lines: ["Facts with lineage", "Intelligence graph", `${n(st?.facts)} facts`, `${n(st?.entities)} entities`] },
    { x: 440, title: "Reason", lines: ["Scenario engine", "Monte Carlo", "Back-test", `${n(st?.scenarioRuns)} runs`] },
    { x: 580, title: "Agents", lines: [`${n(st?.agents)} bounded agents`, "Model gateway", "Citation check", `${n(st?.agentRuns)} runs`] },
    { x: 720, title: "Decide", lines: [`Policy v${st?.policyVersion ?? "…"}`, `${n(st?.policyRules)} rules`, "Named decisions", `${n(st?.decisions)} decisions`] },
    { x: 860, title: "Remember", lines: ["Precedents", "Hybrid search", "Approved entries", `${n(st?.precedents)} entries`] },
  ];
  return (
    <>
      <PageHeader nav="nav.architecture" description="How TIGERIS is built, with live figures from this deployment. Everything shown runs inside the institution's boundary; foreign models are optional and off by default." />
      <Panel className="p-4">
        <svg viewBox="0 0 1000 300" className="w-full" role="img" aria-label="Data flows from collection through validation, knowledge, reasoning and bounded agents to governed decisions and memory. An append-only audit chain and the sovereignty boundary span every stage.">
          <rect x="6" y="6" width="988" height="288" rx="10" fill="none" stroke="var(--accent)" strokeDasharray="6 5" />
          <text x="18" y="24" fontSize="11" fill="var(--accent)" letterSpacing="0.1em">INSTITUTION BOUNDARY · DATA, MODELS AND AUDIT STAY INSIDE</text>
          {layers.map((l, i) => (
            <g key={l.title}>
              <rect x={l.x} y={44} width={124} height={160} rx={8} fill="var(--surface-2)" stroke="var(--line-strong)" />
              <text x={l.x + 12} y={68} fontSize="14" fontWeight="600" fill="var(--ink)">{l.title}</text>
              {l.lines.map((t, j) => <text key={j} x={l.x + 12} y={92 + j * 20} fontSize="11.5" fill={j === l.lines.length - 1 ? "var(--accent)" : "var(--ink-muted)"} className="tabular">{t}</text>)}
              {i < layers.length - 1 && <path d={`M${l.x + 126},124 L${l.x + 138},124`} stroke="var(--ink-faint)" strokeWidth="1.5" markerEnd="url(#arrow)" />}
            </g>
          ))}
          <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--ink-faint)" /></marker></defs>
          <rect x="20" y="220" width="964" height="30" rx="6" fill="var(--primary-soft)" stroke="var(--primary)" />
          <text x="32" y="240" fontSize="12" fill="var(--ink)">Append-only, hash-chained audit trail across every stage · {n(st?.auditEvents)} events · row-level isolation per institution</text>
          <text x="20" y="276" fontSize="11.5" fill="var(--ink-muted)">Foreign models: {st ? (st.foreignModels ? "allowed by policy" : "cut") : "…"} · Outbound access: {st ? (st.outbound ? "allowed" : "off") : "…"} · Local model and embeddings run on this host</text>
        </svg>
      </Panel>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel className="p-4 text-[13px]">
          <h3 className="mb-2 font-semibold">Built on</h3>
          <ul className="grid gap-1 text-ink-muted">
            <li>TypeScript core (Fastify) and web app (Next.js, React)</li>
            <li>Python reasoning service: scenarios, Monte Carlo, back-test</li>
            <li>PostgreSQL with forced row-level security and pgvector</li>
            <li>Local open-weight model and embeddings (llama.cpp)</li>
            <li>Policy as code (YAML, tested before activation)</li>
            <li>One Docker package for laptop, VM and on-premise</li>
          </ul>
        </Panel>
        <Panel className="p-4 text-[13px]">
          <h3 className="mb-2 font-semibold">Deployment</h3>
          <ul className="grid gap-1 text-ink-muted">
            <li><b className="text-ink">Laptop:</b> offline package, no outbound access needed</li>
            <li><b className="text-ink">Hosted demo VM:</b> same package behind a TLS proxy</li>
            <li><b className="text-ink">Pilot:</b> on the institution&apos;s own infrastructure, its identity provider, encrypted storage</li>
            <li>Data enters only as signed packages or approved uploads</li>
          </ul>
        </Panel>
        <Panel className="p-4 text-[13px]">
          <h3 className="mb-2 font-semibold">Roadmap</h3>
          <ol className="grid gap-1 text-ink-muted">
            <li><b className="text-ink">Demo (8 weeks):</b> this build, public and synthetic data</li>
            <li><b className="text-ink">Week 12:</b> client terminology, first institutional data</li>
            <li><b className="text-ink">Week 24:</b> on-premise pilot with live feeds and the institution&apos;s identity provider</li>
            <li><b className="text-ink">Week 36:</b> production hardening, certification, scale-out</li>
          </ol>
          <p className="mt-2 text-[12px] text-ink-faint">For sovereign wealth funds, national energy and infrastructure holders, central banks and ministries.</p>
        </Panel>
      </div>
    </>
  );
}
