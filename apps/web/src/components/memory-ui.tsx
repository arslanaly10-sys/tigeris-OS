"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookMarked, Search } from "lucide-react";
import { api } from "@/lib/api";
import { requireText, clearInvalid } from "@/lib/forms";
import { formatDate, num } from "@/lib/format";
import { PageHeader } from "./page-header";
import { Panel, PanelHeader } from "./ui/panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Drawer } from "./drawer";
import { useCan } from "./session-context";

export interface Hit { id: string; key: string; title: string; summary: string; domain: string; region: string; period: string; outcome: string; lessons: string[]; claim_class: string; source_label: string; case_id: string | null; matchedBy: string[]; keywordRank: number | null; similarity: number | null }
const CLAIM_TONE: Record<string, "info" | "neutral" | "ok" | "gold"> = { illustrative: "neutral", synthetic: "info", observed: "ok", sourced: "ok" };
const DOMAIN_LABEL: Record<string, string> = { energy: "Energy", supply_chain: "Supply chain", food: "Food security", banking: "Banking", sovereign_capital: "Sovereign capital", infrastructure: "Infrastructure", insurance: "Insurance & sanctions" };

export function PrecedentList({ hits, semantic, empty, onOpen }: { hits: Hit[]; semantic: boolean; empty: string; onOpen?: (id: string) => void }) {
  if (!hits.length) return <p className="text-[13px] text-ink-muted">{empty}{!semantic && " Meaning-based search is unavailable because the local embedding model is not loaded; keyword search still runs."}</p>;
  return (
    <ul className="grid gap-2">
      {hits.map((h) => (
        <li key={h.id} className="grid gap-1 rounded-md border border-line p-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            {onOpen ? <button type="button" onClick={() => onOpen(h.id)} className="text-start font-medium hover:underline">{h.title}</button> : <span className="font-medium">{h.title}</span>}
            <Badge tone={CLAIM_TONE[h.claim_class] ?? "neutral"} title={h.source_label}>{h.claim_class}</Badge>
            <span className="ms-auto flex gap-1">{h.matchedBy.map((m) => <Badge key={m} tone={m === "meaning" ? "gold" : "neutral"} title={m === "meaning" ? `Similarity ${h.similarity}` : `Keyword rank ${h.keywordRank}`}>{m === "meaning" ? `meaning ${num(h.similarity ?? 0, 2)}` : "keyword"}</Badge>)}</span>
          </div>
          <p className="text-[13px] text-ink-faint">{DOMAIN_LABEL[h.domain] ?? h.domain} · {h.region} · {h.period}</p>
          <p className="line-clamp-2 text-[13px] text-ink-muted">{h.summary}</p>
          {h.lessons[0] && <p className="text-[13px]"><span className="text-ink-faint">Lesson:</span> {h.lessons[0]}</p>}
        </li>
      ))}
    </ul>
  );
}

interface Detail extends Hit { tags: string[]; event_type: string; status: string; proposed_by_label: string; approved_by_label: string | null; approved_at: string | null; embedding_model: string | null; case_key: string | null }
interface Proposed { id: string; title: string; summary: string; outcome: string; lessons: string[]; domain: string; proposed_by_label: string; created_at: string; case_key: string | null }

export function MemoryModule() {
  const can = useCan();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [domain, setDomain] = useState("");
  const [res, setRes] = useState<{ hits: Hit[]; semantic: boolean } | null>(null);
  const [overview, setOverview] = useState<{ stats: Array<{ domain: string; claim_class: string; n: number }>; proposed: Proposed[]; recent: Array<{ id: string; title: string; case_key: string; approved_by_label: string; approved_at: string }>; embeddings: { model: string; embedded: number } } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => api<typeof overview>("/memory").then((r) => r.ok && setOverview(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const initial = params.get("q"); if (initial) search(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function search(text: string) {
    if (text.trim().length < 2) { setMsg("Type at least 2 characters to search, for example “grain export ban”."); document.querySelector<HTMLInputElement>('input[aria-label="Search memory"]')?.focus(); return; }
    setMsg(null);
    router.replace(`/memory?q=${encodeURIComponent(text.trim())}`, { scroll: false });
    const r = await api<{ hits: Hit[]; semantic: boolean }>(`/memory/search?q=${encodeURIComponent(text)}${domain ? `&domain=${domain}` : ""}`);
    if (r.ok) setRes(r.data);
  }
  async function review(id: string, approve: boolean) {
    const bad = requireText(reason, 3, `review-${id}`, "The reason");
    if (bad) { setMsg(bad); return; }
    clearInvalid(`review-${id}`);
    const r = await api<{ status: string }>(`/memory/${id}/review`, { json: { approve, reason } });
    setMsg(r.ok ? `Entry ${r.data.status}.` : r.message);
    if (r.ok) { setReason(""); load(); }
  }
  const total = overview?.stats.reduce((s, x) => s + x.n, 0) ?? 0;
  const domains = [...new Set(overview?.stats.map((s) => s.domain) ?? [])];
  return (
    <>
      <PageHeader nav="nav.memory" description="Precedents and the institution's own approved case records, searchable by keyword and by meaning. Meaning search uses a small embedding model on this machine; nothing leaves it. Every entry says whether it is an illustrative summary, a synthetic record or the institution's own." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-5">
          <Panel className="p-4">
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); search(q); }}>
              <div className="relative min-w-[260px] flex-1"><Search className="absolute start-2.5 top-2.5 size-4 text-ink-faint" /><input autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search memory" placeholder="e.g. What happened when tankers were attacked near the strait?…" className="h-9 w-full rounded-md border border-line bg-surface-2 ps-8 pe-3 text-[13.5px]" /></div>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domain" className="h-9 rounded-md border border-line bg-surface-2 px-2 text-[13px]"><option value="">All domains</option>{domains.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d] ?? d}</option>)}</select>
              <Button type="submit" variant="primary">Search</Button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">{["tankers attacked near the strait", "grain export ban", "bank funding stress", "desalination outage", "oil price falls for years"].map((x) => <button key={x} type="button" onClick={() => { setQ(x); search(x); }} className="rounded-full border border-line px-2.5 py-1 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink">{x}</button>)}</div>
          </Panel>
          {res && <Panel className="p-4"><PrecedentList hits={res.hits} semantic={res.semantic} empty="Nothing in memory matches." onOpen={async (id) => { const r = await api<Detail>(`/memory/${id}`); if (r.ok) setDetail(r.data); }} /></Panel>}
        </div>
        <div className="grid content-start gap-5">
          <Panel>
            <PanelHeader eyebrow="Library" title={`${total} approved entries`} />
            <ul className="grid gap-1 p-4 text-[13px]">
              {domains.map((d) => <li key={d} className="flex justify-between"><span className="text-ink-muted">{DOMAIN_LABEL[d] ?? d}</span><span className="tabular">{overview!.stats.filter((s) => s.domain === d).map((s) => `${s.n} ${s.claim_class}`).join(" · ")}</span></li>)}
              {overview && <li className="mt-2 text-ink-faint">{overview.embeddings.embedded} entries embedded with {overview.embeddings.model}.</li>}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Waiting for approval" title="Proposed entries" actions={<Badge className="tabular">{overview?.proposed.length ?? 0}</Badge>} />
            <div className="grid gap-3 p-4 text-[13px]">
              {!overview?.proposed.length && <p className="text-ink-muted">Nothing waiting. Analysts propose entries from a case's Decision and memory tab.</p>}
              {overview?.proposed.map((x) => (
                <div key={x.id} className="grid gap-1 rounded-md border border-line p-3">
                  <div className="font-medium">{x.title}</div>
                  <div className="text-ink-faint">{x.case_key && <Link href={`/cases/${x.case_key}`} className="text-accent hover:underline">{x.case_key}</Link>} · proposed by {x.proposed_by_label} · {formatDate(x.created_at, true)}</div>
                  <p className="text-ink-muted">{x.summary}</p>
                  {can("decision.approve") && <div className="mt-1 flex flex-wrap gap-2"><input autoComplete="off" id={`review-${x.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Accurate record of the case…" aria-label="Reason" className="h-8 flex-1 rounded-md border border-line bg-surface-2 px-2" /><Button size="sm" variant="primary" aria-label="Approve memory entry" onClick={() => review(x.id, true)}>Approve</Button><Button size="sm" variant="ghost" onClick={() => review(x.id, false)}>Reject</Button></div>}
                </div>
              ))}
              {msg && <p role="status" className="text-ink-muted">{msg}</p>}
            </div>
          </Panel>
          {!!overview?.recent.length && (
            <Panel>
              <PanelHeader eyebrow="From our cases" title="Recently approved" />
              <ul className="grid gap-1 p-4 text-[13px]">{overview.recent.map((r) => <li key={r.id}><BookMarked className="me-1 inline size-3.5 text-accent" />{r.title} <span className="text-ink-faint">· {r.case_key} · {r.approved_by_label}</span></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
      <Drawer open={!!detail} onClose={() => setDetail(null)} eyebrow="Precedent" title={detail?.title ?? ""}>
        {detail && (
          <div className="grid gap-3 p-5 text-[13px]">
            <div className="flex flex-wrap gap-2"><Badge tone={CLAIM_TONE[detail.claim_class] ?? "neutral"}>{detail.claim_class}</Badge><Badge>{DOMAIN_LABEL[detail.domain] ?? detail.domain}</Badge><Badge>{detail.region}</Badge><Badge>{detail.period}</Badge></div>
            <p className="text-[13px] text-ink-faint">{detail.source_label}{detail.case_key ? ` · case ${detail.case_key}` : ""}</p>
            <p>{detail.summary}</p>
            <p><span className="text-ink-faint">Outcome:</span> {detail.outcome}</p>
            <div><div className="mb-1 text-ink-faint">Lessons</div><ul className="list-disc ps-5">{detail.lessons.map((l) => <li key={l}>{l}</li>)}</ul></div>
            <p className="text-[13px] text-ink-faint">Approved by {detail.approved_by_label ?? "—"}{detail.approved_at ? ` · ${formatDate(detail.approved_at, true)}` : ""} · {detail.embedding_model ?? "not embedded"}</p>
          </div>
        )}
      </Drawer>
    </>
  );
}
