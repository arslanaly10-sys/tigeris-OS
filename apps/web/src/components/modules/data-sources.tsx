"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, PackageCheck, PackageOpen, RefreshCw, ShieldAlert, Ship } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes, formatDate, formatValue } from "@/lib/format";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Drawer, Field } from "../drawer";
import { CheckIcon, ClaimBadge, SourceStatusBadge, ValidationBadge } from "../labels";
import { FactValue } from "../lineage";
import { useCan } from "../session-context";
import { cn } from "@/lib/cn";

const COUNTRY: Record<string, string> = { SAU: "Saudi Arabia", ARE: "United Arab Emirates", QAT: "Qatar", KWT: "Kuwait", OMN: "Oman", BHR: "Bahrain" };
const TABS = [
  { key: "indicators", label: "Public indicators" },
  { key: "registry", label: "Source registry" },
  { key: "imports", label: "Imports and uploads" },
  { key: "evidence", label: "Evidence" },
  { key: "review", label: "Figures to review" },
] as const;
type Tab = (typeof TABS)[number]["key"];

interface IndicatorRow { id: string; subject: string; value_num: number; unit: string; period: string; qualifier: string | null; source_name: string; validation_state: string; conflict: boolean }
interface Indicators { countries: string[]; columns: { key: string; label: string; rows: IndicatorRow[] }[]; hormuz: { id: string; subject_label: string; predicate_label: string; value_num: number; unit: string; period: string; excerpt: string; source_name: string }[]; sanctions: { source_name: string; vessels: number }[] }
interface Source { id: string; key: string; name: string; publisher: string; source_class: string; country: string | null; access_method: string; licence: string; owner_label: string; allowed_purposes: string[]; cadence: string; freshness_limit_hours: number; status: string; status_note: string | null; last_retrieved_at: string | null; evidence_count: number; quarantined_count: number; fact_count: number; freshness: "fresh" | "stale" | "no_data" }
interface Job { id: string; kind: string; status: string; label: string; attempts: number; error: string | null; created_by_label: string; created_at: string; finished_at: string | null; result: { summary: string; files: { name: string; title: string; outcome: string; facts: number; evidenceId?: string; reasons: string[] }[]; signer?: string } | null }
interface Evidence { id: string; title: string; media_type: string; size_bytes: number; retrieved_at: string; data_class: string; validation_state: string; source_name: string; fact_count: number; duplicate_of: string | null }

export function DataSources() {
  const [tab, setTab] = useState<Tab>("indicators");
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <>
      <PageHeader nav="nav.sources" description="Every source, what it may be used for, when it was last collected and what came in. Public data arrives as a signed package collected outside the institution's boundary; the platform itself makes no outbound calls." />
      <div role="tablist" aria-label="Data and sources views" className="mb-5 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-[13.5px] transition-colors", tab === t.key ? "border-primary font-medium text-ink" : "border-transparent text-ink-muted hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "indicators" && <IndicatorsView key={version} />}
      {tab === "registry" && <RegistryView key={version} />}
      {tab === "imports" && <ImportsView onChanged={refresh} onOpenEvidence={setEvidenceId} />}
      {tab === "evidence" && <EvidenceView key={version} onOpen={setEvidenceId} />}
      {tab === "review" && <ReviewView key={version} />}
      <EvidenceDrawer id={evidenceId} onClose={() => setEvidenceId(null)} />
    </>
  );
}

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api<T>(path);
    if (r.ok) setData(r.data);
    else setError(r.message);
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

const Loading = () => <div className="h-48 animate-pulse rounded-lg bg-surface-2" />;
const ErrorNote = ({ message }: { message: string }) => <Panel role="alert" className="flex gap-3 border-crit/40 bg-crit-soft p-4 text-[13px] text-crit"><ShieldAlert className="size-5 shrink-0" />{message}</Panel>;

function IndicatorsView() {
  const { data, error } = useLoad<Indicators>("/indicators");
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;
  const cell = (col: Indicators["columns"][number], iso: string) => col.rows.find((r) => r.subject === iso);
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader eyebrow="Latest available value per source" title="GCC macro and energy baseline"
          actions={<><ClaimBadge claim="observed" /><Badge>Click any number for its lineage</Badge></>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink-faint">
                <th className="px-4 py-2 text-start font-medium">Country</th>
                {data.columns.map((c) => <th key={c.key} className="px-3 py-2 text-end font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.countries.map((iso) => (
                <tr key={iso} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{COUNTRY[iso]}</td>
                  {data.columns.map((c) => {
                    const r = cell(c, iso);
                    return (
                      <td key={c.key} className="px-3 py-1.5 text-end">
                        {r ? (
                          <div className="flex flex-col items-end">
                            <FactValue id={r.id} value={r.value_num} unit={r.unit} qualifier={r.qualifier} />
                            <span className={cn("text-[13px] tabular", r.conflict ? "text-warn" : "text-ink-faint")}>{r.period}{r.conflict ? " · conflict" : ""}</span>
                          </div>
                        ) : <span className="text-ink-faint" title="No value in the snapshot">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">Sources: World Bank WDI, IMF World Economic Outlook, JODI Oil World Database. Values marked conflict disagree with another source beyond tolerance; open them to see both.</p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader eyebrow="U.S. Energy Information Administration" title="Strait of Hormuz" actions={<ClaimBadge claim="sourced" />} />
          <ul className="divide-y divide-line">
            {data.hormuz.map((h) => (
              <li key={h.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{h.predicate_label}</div>
                  <div className="text-[13px] text-ink-muted">{h.subject_label} · {h.period}</div>
                </div>
                <FactValue id={h.id} value={h.value_num} unit={h.unit} className="text-[15px] font-medium" />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Sanctions screening" title="Designated vessels" />
          <ul className="grid gap-3 p-4">
            {data.sanctions.map((s) => (
              <li key={s.source_name} className="flex items-center gap-3">
                <Ship className="size-5 text-accent" />
                <div className="min-w-0 flex-1 text-[13px]">{s.source_name}</div>
                <span className="font-serif text-[22px] tabular">{s.vessels.toLocaleString("en-GB")}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">Dated public references, not legal determinations. Vessel matching against ship tracks arrives with the map in week 4.</p>
        </Panel>
      </div>
    </div>
  );
}

function RegistryView() {
  const { data, error } = useLoad<{ sources: Source[]; signers: { name: string; fingerprint: string; status: string }[] }>("/sources");
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-5">
      <Panel>
        <PanelHeader eyebrow="Registry" title="Sources" actions={<Badge className="tabular">{data.sources.filter((s) => s.status === "approved").length} approved of {data.sources.length}</Badge>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Source", "Status", "Licence and purpose", "Cadence", "Last collected", "Contents"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3"><div className="font-medium">{s.name}</div><div className="text-[13px] text-ink-muted">{s.publisher}{s.country ? ` · ${s.country}` : ""}</div><div className="text-[13px] text-ink-faint">Owner: {s.owner_label}</div></td>
                  <td className="px-4 py-3"><SourceStatusBadge status={s.status} />{s.status_note && <p className="mt-1 max-w-[260px] text-[13px] text-ink-muted">{s.status_note}</p>}</td>
                  <td className="px-4 py-3"><div>{s.licence}</div><div className="mt-1 flex flex-wrap gap-1">{s.allowed_purposes.map((p) => <Badge key={p}>{p.replace(/_/g, " ")}</Badge>)}</div></td>
                  <td className="px-4 py-3 text-ink-muted">{s.cadence}<div className="text-[13px] text-ink-faint">Fresh for {Math.round(s.freshness_limit_hours / 24)} days</div></td>
                  <td className="px-4 py-3">{s.last_retrieved_at ? <><div className="tabular">{formatDate(s.last_retrieved_at, true)}</div><Badge tone={s.freshness === "fresh" ? "ok" : "warn"}>{s.freshness === "fresh" ? "Fresh" : "Stale"}</Badge></> : <span className="text-ink-faint">Not collected</span>}</td>
                  <td className="px-4 py-3 tabular text-ink-muted">{s.evidence_count} files · {s.fact_count.toLocaleString("en-GB")} facts{s.quarantined_count ? <div className="text-crit">{s.quarantined_count} quarantined</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <PanelHeader eyebrow="Air-gap transfer" title="Trusted package signers" />
        <ul className="grid gap-2 p-4 text-[13px]">
          {data.signers.map((s) => <li key={s.fingerprint} className="flex flex-wrap items-center gap-2"><PackageCheck className="size-4 text-ok" />{s.name}<span translate="no" className="font-mono text-[13px] text-ink-faint">{s.fingerprint}</span><Badge tone="ok">{s.status}</Badge></li>)}
        </ul>
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">Packages signed by any other key are refused before any file is opened.</p>
      </Panel>
    </div>
  );
}

function ImportsView({ onChanged, onOpenEvidence }: { onChanged: () => void; onOpenEvidence: (id: string) => void }) {
  const can = useCan();
  const { data, error, reload } = useLoad<{ jobs: Job[] }>("/jobs");
  const docs = useLoad<{ documents: string[] }>("/evidence/demo-documents");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "crit" | "info"; text: string } | null>(null);
  const pkgInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  const waitFor = useCallback(async (id: string) => {
    for (let i = 0; i < 60; i++) {
      const r = await api<Job>(`/jobs/${id}`);
      if (r.ok && (r.data.status === "succeeded" || r.data.status === "failed")) return r.data;
      await new Promise((res) => setTimeout(res, 700));
    }
    return undefined;
  }, []);

  async function run(label: string, start: () => Promise<{ ok: boolean; data?: { id: string; duplicate: boolean }; message?: string }>) {
    setBusy(label);
    setNote({ tone: "info", text: `${label}: checking and importing…` });
    const r = await start();
    if (!r.ok || !r.data) { setBusy(null); setNote({ tone: "crit", text: r.message ?? "The request failed." }); return; }
    const job = await waitFor(r.data.id);
    setBusy(null);
    await reload();
    onChanged();
    if (!job) return setNote({ tone: "info", text: "Still processing. The list updates when it finishes." });
    if (r.data.duplicate) return setNote({ tone: "info", text: `Already imported earlier: ${job.result?.summary ?? job.status}. Nothing was duplicated.` });
    setNote(job.status === "failed" ? { tone: "crit", text: job.error ?? "Import failed." } : { tone: job.result?.files.some((f) => f.outcome === "quarantined" || f.outcome === "rejected") ? "crit" : "ok", text: job.result?.summary ?? "Done." });
  }

  const sendFile = (url: string, file: File) => async () => {
    const res = await fetch(`/api${url}`, { method: "POST", headers: { "content-type": url.includes("packages") ? "application/octet-stream" : "application/pdf", "x-file-name": encodeURIComponent(file.name) }, body: file });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: body } : { ok: false, message: body.message };
  };
  const post = (url: string) => async () => {
    const r = await api<{ id: string; duplicate: boolean }>(url, { json: {} });
    return r.ok ? { ok: true, data: r.data } : { ok: false, message: r.message };
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Air-gap pattern" title="Import a signed package" />
          <div className="grid gap-3 p-4 text-[13px]">
            <p className="text-ink-muted">The collector fetches public sources outside the boundary and signs a package. Import checks the signature, then the hash of every file, before anything is opened.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" disabled={!can("source.manage") || busy !== null} onClick={() => run("Bundled snapshot", post("/sources/packages/bundled"))}><PackageOpen />Import bundled snapshot</Button>
              <Button size="sm" disabled={!can("source.manage") || busy !== null} onClick={() => pkgInput.current?.click()}><FileUp />Choose package file</Button>
              <input ref={pkgInput} id="pkg-file" aria-label="Transfer package file" type="file" accept=".tigpkg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f.name, sendFile("/sources/packages", f)); e.target.value = ""; }} />
            </div>
            {!can("source.manage") && <p className="text-[13px] text-ink-faint">Importing packages needs the Administrator role.</p>}
          </div>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Live evidence" title="Upload a document" />
          <div className="grid gap-3 p-4 text-[13px]">
            <p className="text-ink-muted">PDFs are screened for hidden text and instructions aimed at AI systems before any figure is extracted. Extracted figures wait for analyst review.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!can("evidence.upload") || busy !== null} onClick={() => pdfInput.current?.click()}><FileUp />Choose PDF</Button>
              <input ref={pdfInput} id="pdf-file" aria-label="PDF document" type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f.name, sendFile("/evidence/documents", f)); e.target.value = ""; }} />
              {docs.data?.documents.map((d) => (
                <Button key={d} size="sm" variant={d.includes("poisoned") ? "danger" : "secondary"} disabled={!can("evidence.upload") || busy !== null} onClick={() => run(d, post(`/evidence/demo-documents/${d}`))}>
                  {d.includes("poisoned") ? <ShieldAlert /> : <FileUp />}{d.includes("poisoned") ? "Try the poisoned document" : "Try the sample advisory"}
                </Button>
              ))}
            </div>
            {!can("evidence.upload") && <p className="text-[13px] text-ink-faint">Uploading needs the Analyst, Domain Expert or Administrator role.</p>}
          </div>
        </Panel>
      </div>

      {note && (
        <div role="status" className={cn("flex items-start gap-2 rounded-md border p-3 text-[13px]", note.tone === "ok" && "border-ok/40 bg-ok-soft text-ok", note.tone === "crit" && "border-crit/40 bg-crit-soft text-crit", note.tone === "info" && "border-info/40 bg-info-soft text-info")}>
          {busy && <Loader2 className="size-4 shrink-0 animate-spin" />}{note.text}
        </div>
      )}

      <Panel>
        <PanelHeader eyebrow="Job queue" title="Recent imports" actions={<Button variant="ghost" size="sm" onClick={reload}><RefreshCw />Refresh</Button>} />
        {error && <p className="p-4 text-crit">{error}</p>}
        {!data && !error && <Loading />}
        <ul className="divide-y divide-line">
          {data?.jobs.map((j) => (
            <li key={j.id} className="grid gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={j.status === "succeeded" ? "ok" : j.status === "failed" ? "crit" : "info"}>{j.status}</Badge>
                <span className="font-medium">{j.label}</span>
                <span className="text-[13px] text-ink-faint">{j.kind === "package_import" ? "Package" : "Document"} · {j.created_by_label} · {formatDate(j.created_at, true)}</span>
              </div>
              {j.error && <p className="text-[13px] text-crit">{j.error}</p>}
              {j.result && <p className="text-[13px] text-ink-muted">{j.result.summary}</p>}
              {j.result && j.result.files.some((f) => f.outcome !== "accepted") && (
                <ul className="grid gap-1">
                  {j.result.files.filter((f) => f.outcome !== "accepted").map((f) => (
                    <li key={f.name} className="flex flex-wrap items-center gap-2 text-[13px]">
                      <ValidationBadge state={f.outcome} />
                      <button type="button" className="tap text-ink underline-offset-2 hover:underline" onClick={() => f.evidenceId && onOpenEvidence(f.evidenceId)}>{f.title}</button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function EvidenceView({ onOpen }: { onOpen: (id: string) => void }) {
  const [state, setState] = useState<string>("");
  const { data, error } = useLoad<{ evidence: Evidence[] }>(`/evidence${state ? `?state=${state}` : ""}`);
  return (
    <Panel>
      <PanelHeader eyebrow="Evidence vault" title="Evidence records" actions={
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">Show
          <select id="evidence-filter" value={state} onChange={(e) => setState(e.target.value)} className="h-8 rounded-md border border-line bg-surface-2 px-2 text-ink">
            <option value="">All</option><option value="accepted">Accepted</option><option value="warning">With warnings</option><option value="quarantined">Quarantined</option><option value="rejected">Rejected</option>
          </select>
        </label>} />
      {error && <p className="p-4 text-crit">{error}</p>}
      {!data && !error && <Loading />}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="border-b border-line text-ink-faint">{["Title", "Source", "State", "Class", "Facts", "Collected"].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {data.evidence.map((e) => (
                <tr key={e.id} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2" onClick={() => onOpen(e.id)}>
                  <td className="px-4 py-2.5"><button type="button" className="tap text-start font-medium hover:underline">{e.title}</button><div className="text-[13px] text-ink-faint">{e.media_type} · {formatBytes(e.size_bytes)}{e.duplicate_of ? " · duplicate" : ""}</div></td>
                  <td className="px-4 py-2.5 text-ink-muted">{e.source_name}</td>
                  <td className="px-4 py-2.5"><ValidationBadge state={e.validation_state} /></td>
                  <td className="px-4 py-2.5"><ClaimBadge claim={e.data_class === "public" ? "observed" : e.data_class} /></td>
                  <td className="px-4 py-2.5 tabular">{e.fact_count.toLocaleString("en-GB")}</td>
                  <td className="px-4 py-2.5 tabular text-ink-muted">{formatDate(e.retrieved_at, true)}</td>
                </tr>
              ))}
              {data.evidence.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">No evidence in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ReviewView() {
  const can = useCan();
  const { data, error, reload } = useLoad<{ facts: { id: string; value_num: number | null; value_text: string | null; unit: string | null; locator: string; claim_class: string; evidence_title: string }[] }>("/facts/review");
  async function decide(id: string, decision: "accepted" | "rejected") {
    await api(`/facts/${id}/review`, { json: { decision } });
    reload();
  }
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;
  return (
    <Panel>
      <PanelHeader eyebrow="Candidate figures" title="Figures waiting for review" actions={<Badge className="tabular">{data.facts.length}</Badge>} />
      {data.facts.length === 0 && <p className="px-4 py-8 text-center text-ink-muted">Nothing to review. Upload the sample advisory from Imports and uploads to see this step.</p>}
      <ul className="divide-y divide-line">
        {data.facts.map((f) => (
          <li key={f.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-faint"><ClaimBadge claim={f.claim_class} />{f.evidence_title} · {f.locator}</div>
              <p className="mt-1 text-[13.5px]">{f.value_text}</p>
              {f.value_num !== null && <p className="text-[13px] text-ink-muted">Figure found: <span className="tabular">{formatValue(f.value_num, f.unit)}</span></p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={!can("evidence.dispose")} onClick={() => decide(f.id, "accepted")}>Accept</Button>
              <Button size="sm" disabled={!can("evidence.dispose")} onClick={() => decide(f.id, "rejected")}>Reject</Button>
            </div>
          </li>
        ))}
      </ul>
      {!can("evidence.dispose") && <p className="border-t border-line px-4 py-3 text-[13px] text-ink-faint">Reviewing figures needs the Analyst or Domain Expert role.</p>}
    </Panel>
  );
}

function EvidenceDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [d, setD] = useState<{ evidence: Record<string, any>; validations: { rule_set_version: string; checks: { rule: string; label: string; result: string; detail: string }[]; outcome: string }[]; facts: { id: string; subject_label: string; predicate_label: string; value_num: number | null; value_text: string | null; unit: string | null; period: string | null; qualifier: string | null; claim_class: string }[] } | null>(null);
  useEffect(() => {
    if (!id) return;
    setD(null);
    api<NonNullable<typeof d>>(`/evidence/${id}`).then((r) => r.ok && setD(r.data));
  }, [id]);
  return (
    <Drawer open={!!id} onClose={onClose} eyebrow="Evidence record" title={d?.evidence.title ?? "Loading"}>
      {!d ? <Loading /> : (
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2"><ValidationBadge state={d.evidence.validation_state} /><ClaimBadge claim={d.evidence.data_class === "public" ? "observed" : d.evidence.data_class} /><Badge>{d.evidence.classification}</Badge></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label="Source">{d.evidence.source_name}</Field>
            <Field label="Publisher">{d.evidence.publisher}</Field>
            <Field label="Collected">{formatDate(d.evidence.retrieved_at, true)}</Field>
            <Field label="Imported by">{d.evidence.created_by_label}</Field>
          </dl>
          <p className="break-all font-mono text-[13px] text-ink-faint">SHA-256 {d.evidence.sha256}</p>
          {d.validations.map((v, i) => (
            <div key={i}>
              <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">Checks <span translate="no" className="font-mono text-[13px] font-normal text-ink-faint">{v.rule_set_version}</span></div>
              <ul className="grid gap-1.5">{v.checks.map((c, j) => <li key={j} className="flex gap-2 text-[13px]"><CheckIcon result={c.result} /><span><span className="text-ink">{c.label}.</span> <span className="text-ink-muted">{c.detail}</span></span></li>)}</ul>
            </div>
          ))}
          {(d.evidence.validation_state === "quarantined" || d.evidence.validation_state === "rejected") ? (
            <p className="rounded-md border border-crit/40 bg-crit-soft p-3 text-[13px] text-crit">No facts were taken from this record. It is kept, with its checks, for the audit trail and can be reviewed by the source owner.</p>
          ) : (
            <div>
              <div className="mb-1.5 text-[13px] font-medium">Facts ({d.facts.length}{d.facts.length === 100 ? "+" : ""})</div>
              <ul className="divide-y divide-line rounded-md border border-line">
                {d.facts.slice(0, 40).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate">{f.subject_label} · {f.predicate_label}{f.period ? ` · ${f.period}` : ""}</span>
                    {f.value_num !== null ? <FactValue id={f.id} value={f.value_num} unit={f.unit} qualifier={f.qualifier} /> : <span className="max-w-[200px] truncate text-ink-muted">{f.value_text}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
