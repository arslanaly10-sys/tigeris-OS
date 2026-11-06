"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { ArrowDown, ExternalLink, FileText, Fingerprint, Package, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes, formatDate, formatValue } from "@/lib/format";
import { Drawer, Field } from "./drawer";
import { CheckIcon, ClaimBadge, SourceStatusBadge, ValidationBadge } from "./labels";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/cn";

interface Check { rule: string; label: string; result: string; detail: string }
interface Lineage {
  fact: { id: string; subject_label: string; predicate_label: string; value_num: number | null; value_text: string | null; unit: string | null; period: string | null; qualifier: string | null; claim_class: string; review_state: string; locator: string | null; excerpt: string | null; extraction_method: string; extraction_version: string; created_at: string };
  evidence: { id: string; title: string; original_url: string | null; media_type: string; size_bytes: number; sha256: string; event_time: string | null; retrieved_at: string; source_version: string | null; data_class: string; classification: string; rights: string; transformations: { step: string; detail: string; rowsBefore?: number; rowsAfter?: number }[]; validation_state: string; job_kind: string; job_label: string; created_by_label: string; imported_at: string; signer: string | null; package_id: string | null };
  source: { key: string; name: string; publisher: string; source_class: string; licence: string; url: string; cadence: string; owner_label: string; status: string };
  validations: { rule_set_version: string; checks: Check[]; outcome: string; created_at: string }[];
  otherSources: { id: string; value_num: number | null; unit: string | null; qualifier: string | null; source_name: string }[];
}

const Ctx = createContext<(factId: string) => void>(() => {});
export const useLineage = () => useContext(Ctx);

export function LineageProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Lineage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback(async (id: string) => {
    setOpen(true);
    setData(null);
    setError(null);
    const r = await api<Lineage>(`/facts/${id}/lineage`);
    if (r.ok) setData(r.data);
    else setError(r.message);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <Drawer open={open} onClose={() => setOpen(false)} eyebrow="Lineage" title={data ? `${data.fact.predicate_label} · ${data.fact.subject_label}` : "Loading lineage"}>
        {error && <p role="alert" className="text-crit">{error}</p>}
        {!data && !error && <div className="h-64 animate-pulse rounded bg-surface-2" />}
        {data && <LineageBody d={data} />}
      </Drawer>
    </Ctx.Provider>
  );
}

function Step({ icon, title, children, last }: { icon: React.ReactNode; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span className="grid size-7 place-items-center rounded-full border border-line bg-surface-2 text-accent [&_svg]:size-3.5">{icon}</span>
        {!last && <span className="mt-1 w-px flex-1 bg-line" />}
      </div>
      <div className={cn("min-w-0", !last && "pb-5")}>
        <div className="mb-2 text-[13px] font-semibold">{title}</div>
        {children}
      </div>
    </li>
  );
}

function LineageBody({ d }: { d: Lineage }) {
  const f = d.fact;
  const e = d.evidence;
  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ClaimBadge claim={f.claim_class} />
          {f.qualifier && <Badge tone="warn">{f.qualifier}</Badge>}
          {f.review_state !== "accepted" && <Badge tone="warn">{f.review_state === "needs_review" ? "Needs review" : "Rejected"}</Badge>}
        </div>
        <div className="mt-2 font-serif text-[28px] leading-tight tabular">{f.value_num !== null ? formatValue(f.value_num, f.unit) : f.value_text}</div>
        <div className="text-[13px] text-ink-muted">{f.subject_label} · {f.predicate_label}{f.period ? ` · ${f.period}` : ""}</div>
        {f.excerpt && <blockquote className="mt-3 border-s-2 border-primary ps-3 text-[13px] text-ink">&ldquo;{f.excerpt}&rdquo;</blockquote>}
      </div>

      <ol>
        <Step icon={<Scale />} title="Source">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label="Publisher">{d.source.publisher}</Field>
            <Field label="Dataset">{d.source.name}</Field>
            <Field label="Licence">{d.source.licence}</Field>
            <Field label="Status"><SourceStatusBadge status={d.source.status} /></Field>
            <Field label="Owner in this institution">{d.source.owner_label}</Field>
            <Field label="Cadence">{d.source.cadence}</Field>
          </dl>
        </Step>
        <Step icon={<Package />} title={e.job_kind === "package_import" ? "Transfer package" : "Upload"}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label={e.job_kind === "package_import" ? "Package file" : "File"}>{e.job_label}</Field>
            <Field label="Imported by">{e.created_by_label}</Field>
            <Field label="Imported">{formatDate(e.imported_at, true)}</Field>
            {e.signer && <Field label="Signature verified">{e.signer}</Field>}
          </dl>
        </Step>
        <Step icon={<FileText />} title="Evidence record">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label="Title">{e.title}</Field>
            <Field label="Retrieved from source">{formatDate(e.retrieved_at, true)}</Field>
            <Field label="Source as-of">{formatDate(e.event_time)}</Field>
            <Field label="Version">{e.source_version ?? "—"}</Field>
            <Field label="Data class">{e.data_class.replace("_", " ")}</Field>
            <Field label="Size">{formatBytes(e.size_bytes)} · {e.media_type}</Field>
          </dl>
          <p className="mt-2 break-all font-mono text-[11px] text-ink-faint" title="SHA-256 of the stored original"><Fingerprint className="me-1 inline size-3" />{e.sha256}</p>
          {e.original_url && (
            <a href={e.original_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
              Original location <ExternalLink className="size-3" />
            </a>
          )}
          {e.transformations.length > 0 && (
            <div className="mt-3 rounded-md border border-line p-2.5 text-[12px]">
              <div className="mb-1 font-medium">Changes made by the collector before signing</div>
              {e.transformations.map((t, i) => (
                <p key={i} className="text-ink-muted">{t.detail}{t.rowsBefore !== undefined ? ` (${t.rowsBefore.toLocaleString("en-GB")} → ${t.rowsAfter?.toLocaleString("en-GB")} rows)` : ""}</p>
              ))}
            </div>
          )}
        </Step>
        <Step icon={<ArrowDown />} title="Validation">
          {d.validations.map((v, i) => (
            <div key={i} className="mb-3">
              <div className="mb-1.5 flex items-center gap-2"><ValidationBadge state={v.outcome} /><span className="font-mono text-[11px] text-ink-faint">{v.rule_set_version}</span></div>
              <ul className="grid gap-1">
                {v.checks.map((c, j) => (
                  <li key={j} className="flex gap-2 text-[12.5px]"><CheckIcon result={c.result} /><span><span className="text-ink">{c.label}.</span> <span className="text-ink-muted">{c.detail}</span></span></li>
                ))}
              </ul>
            </div>
          ))}
        </Step>
        <Step icon={<FileText />} title="Extraction" last>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label="Method">{f.extraction_method} (deterministic)</Field>
            <Field label="Location in file">{f.locator ?? "—"}</Field>
          </dl>
        </Step>
      </ol>

      {d.otherSources.length > 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-[13px]">
          <div className="font-medium text-warn">Other sources for the same measure</div>
          <ul className="mt-1 grid gap-0.5">
            {d.otherSources.map((o) => (
              <li key={o.id} className="text-ink">{o.source_name}: <span className="tabular">{formatValue(o.value_num, o.unit)}</span>{o.qualifier ? ` (${o.qualifier})` : ""}</li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-ink-muted">Both values are kept. Neither overwrites the other.</p>
        </div>
      )}
    </div>
  );
}

/** A number that always opens its lineage (CLAUDE.md rule 7). */
export function FactValue({ id, value, unit, qualifier, className }: { id: string; value: number | null; unit?: string | null; qualifier?: string | null; className?: string }) {
  const open = useLineage();
  return (
    <button type="button" onClick={() => open(id)} title="Show where this number comes from"
      className={cn("whitespace-nowrap rounded px-1 py-0.5 text-start tabular underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-surface-2 hover:decoration-accent", className)}>
      {formatValue(value, unit)}
      {qualifier ? <span className="ms-1 text-[10px] text-warn" title={qualifier}>{/projection/i.test(qualifier) ? "proj." : "caution"}</span> : null}
    </button>
  );
}
