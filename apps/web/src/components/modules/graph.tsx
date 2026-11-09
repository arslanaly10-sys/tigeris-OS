"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, GitBranch, Search, Waypoints } from "lucide-react";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { PageHeader } from "../page-header";
import { GraphAsk } from "../agents";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ClaimBadge } from "../labels";
import { FactValue } from "../lineage";
import { EdgeLegend, GraphCanvas, type GEdge, type GNode } from "../graph-canvas";
import { cn } from "@/lib/cn";

const TYPE_LABEL: Record<string, string> = { chokepoint: "Chokepoint", country: "Country", port: "Port", terminal: "Terminal", refinery: "Refinery", pipeline: "Pipeline", field: "Field", facility: "Processing facility", desalination: "Desalination plant", power_plant: "Power plant", city: "City", airport: "Airport", holding: "Holding", institution: "Institution", mandate: "Mandate", market: "Market", route: "Route", commodity: "Commodity", vessel: "Vessel", sanctions_regime: "Sanctions regime" };
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t;

interface Stats { byType: { type: string; claim_class: string; n: number }[]; byClass: { relationship_class: string; n: number }[]; snapshot: { entity_count: number; relationship_count: number; content_hash: string; created_at: string } | null }
interface EntityDetail { entity: { key: string; name: string; type: string; country: string | null; claim_class: string; location_quality: string | null; attributes: Record<string, unknown>; evidence_title: string | null; source_name: string | null; lat: number | null; lon: number | null }; edges: { id: string; predicate_label: string; relationship_class: string; impact_weight: number | null; direction: "in" | "out"; other_key: string; other_name: string; other_type: string; evidence: { title: string; source: string; note: string | null; factId: string | null }[] | null }[] }
export interface Paths { origin: { key: string; name: string }; maxDepth: number; truncated: boolean; hops: { depth: number; entity: { key: string; name: string; type: string; claim_class: string }; via: { label: string; direction: string; class: string; weight: number | null; evidenceCount: number; fromKey: string }; cumulativeWeight: number; path: string[] }[]; alternatives: { entity: { key: string; name: string }; label: string; class: string }[] }

export function GraphModule() {
  const params = useSearchParams();
  const router = useRouter();
  const focus = params.get("focus") ?? "chokepoint:hormuz";
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [list, setList] = useState<{ key: string; name: string; type: string; degree: number; claim_class: string }[]>([]);
  const [hood, setHood] = useState<{ nodes: GNode[]; edges: GEdge[]; origin: string } | null>(null);
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [paths, setPaths] = useState<Paths | null>(null);
  const [depth, setDepth] = useState(1);
  const [view, setView] = useState<"detail" | "paths">("detail");

  useEffect(() => { api<Stats>("/graph/stats").then((r) => r.ok && setStats(r.data)); }, []);
  useEffect(() => {
    const t = setTimeout(() => api<{ entities: typeof list }>(`/graph/entities?limit=40${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((r) => r.ok && setList(r.data.entities)), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    api<{ nodes: GNode[]; edges: GEdge[]; origin: string }>(`/graph/neighborhood?key=${encodeURIComponent(focus)}&depth=${depth}`).then((r) => r.ok && setHood(r.data));
    api<EntityDetail>(`/graph/entity?key=${encodeURIComponent(focus)}`).then((r) => r.ok && setDetail(r.data));
    api<Paths>(`/graph/paths?from=${encodeURIComponent(focus)}&depth=3`).then((r) => r.ok && setPaths(r.data));
  }, [focus, depth]);

  const select = useCallback((key: string) => router.push(`/graph?focus=${encodeURIComponent(key)}`), [router]);
  const totals = useMemo(() => stats ? stats.byClass.map((c) => `${c.n.toLocaleString("en-GB")} ${c.relationship_class}`).join(" · ") : "", [stats]);

  return (
    <>
      <PageHeader nav="nav.graph" description="One shared map of the institution's world: places, infrastructure, routes, sanctioned vessels and the institution's own holdings. Every link says whether it is observed, sourced, inferred, assumed or synthetic, and opens its evidence." />
      {stats?.snapshot && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          <Badge tone="info" className="tabular">{stats.snapshot.entity_count.toLocaleString("en-GB")} entities</Badge>
          <Badge className="tabular">{stats.snapshot.relationship_count.toLocaleString("en-GB")} relationships</Badge>
          <span>{totals}</span>
          <span translate="no" className="font-mono text-[13px] text-ink-faint">snapshot {stats.snapshot.content_hash.slice(0, 12)}</span>
        </div>
      )}
      <div className="mb-5"><GraphAsk /></div>
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <Panel className="flex max-h-[680px] flex-col">
          <div className="border-b border-line p-3">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute start-2.5 size-4 text-ink-faint" />
              <input autoComplete="off" id="graph-search" aria-label="Find an entity in the graph" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Jebel Ali, Strait of Hormuz…" className="h-9 w-full rounded-md border border-line bg-surface-2 ps-8 pe-2 text-[13px]" />
            </label>
          </div>
          <ul className="cv-auto flex-1 overflow-y-auto p-1.5">
            {list.map((e) => (
              <li key={e.key}>
                <button type="button" onClick={() => select(e.key)} className={cn("flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-start text-[13px] hover:bg-surface-2", e.key === focus && "bg-primary-soft")}>
                  <span className="min-w-0"><span className="block truncate">{e.name}</span><span className="text-[13px] text-ink-faint">{typeLabel(e.type)}</span></span>
                  <span className="text-[13px] tabular text-ink-faint">{e.degree}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="min-w-0">
          <PanelHeader eyebrow="Neighbourhood" title={detail?.entity.name ?? "Loading"} actions={
            <div className="flex items-center gap-1" role="group" aria-label="Depth">
              {[1, 2, 3].map((d) => <Button key={d} size="sm" variant={depth === d ? "primary" : "ghost"} onClick={() => setDepth(d)} aria-pressed={depth === d}>{d} hop{d > 1 ? "s" : ""}</Button>)}
            </div>} />
          <div className="grid gap-3 p-3">
            {hood ? <GraphCanvas nodes={hood.nodes} edges={hood.edges} origin={hood.origin} onSelect={select} /> : <div className="h-[520px] animate-pulse rounded bg-surface-2" />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <EdgeLegend />
              <span className="text-[13px] text-ink-faint">{hood ? `${hood.nodes.length} entities shown · sanctioned vessels hidden here` : ""}</span>
            </div>
          </div>
        </Panel>

        <Panel className="flex max-h-[680px] flex-col">
          <div role="tablist" aria-label="Graph detail views" className="flex border-b border-line">
            {(["detail", "paths"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("-mb-px flex-1 border-b-2 px-3 py-2.5 text-[13px]", view === v ? "border-primary font-medium" : "border-transparent text-ink-muted hover:text-ink")}>
                {v === "detail" ? "Entity and links" : "Impact paths"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {view === "detail" && detail && <EntityPanel d={detail} onSelect={select} />}
            {view === "paths" && paths && <PathList paths={paths} onSelect={select} />}
          </div>
        </Panel>
      </div>
    </>
  );
}

function EntityPanel({ d, onSelect }: { d: EntityDetail; onSelect: (k: string) => void }) {
  const attrs = Object.entries(d.entity.attributes ?? {});
  return (
    <div className="grid gap-4 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{typeLabel(d.entity.type)}</Badge><ClaimBadge claim={d.entity.claim_class} />
        {d.entity.country && <Badge>{d.entity.country}</Badge>}
      </div>
      <p className="text-ink-muted">From {d.entity.source_name && !d.entity.evidence_title?.startsWith(d.entity.source_name) ? `${d.entity.source_name}: ` : ""}{d.entity.evidence_title ?? "—"}.{d.entity.location_quality ? ` Location ${d.entity.location_quality}.` : ""}</p>
      {attrs.length > 0 && (
        <dl className="grid gap-2">
          {attrs.map(([k, v]) => {
            const fact = v && typeof v === "object" && "factId" in (v as object) ? (v as { value: number; unit: string; factId: string; label?: string; period?: string; claim: string }) : null;
            if (!fact && (v === null || typeof v === "object")) return null;
            return (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-1.5">
                <dt className="text-ink-muted">{fact?.label ?? k.replace(/_/g, " ")}{fact?.period ? ` · ${fact.period}` : ""}</dt>
                <dd className="flex items-center gap-1.5">{fact ? <><FactValue id={fact.factId} value={fact.value} unit={fact.unit} /><ClaimBadge claim={fact.claim} /></> : <span>{String(v)}</span>}</dd>
              </div>
            );
          })}
        </dl>
      )}
      <div>
        <div className="mb-1.5 font-medium">Links ({d.edges.length})</div>
        <ul className="grid gap-2">
          {d.edges.slice(0, 60).map((e) => (
            <li key={e.id} className="rounded-md border border-line p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-ink-muted">{e.direction === "out" ? e.predicate_label : `${e.predicate_label} (from)`}</span>
                <button type="button" className="tap font-medium text-ink hover:underline" onClick={() => onSelect(e.other_key)}>{e.other_name}</button>
                <ClaimBadge claim={e.relationship_class} />
                {e.impact_weight !== null && <span className="text-[13px] tabular text-ink-faint" title="Impact weight: analyst assumption used by propagation">w {e.impact_weight}</span>}
              </div>
              {e.evidence?.map((ev, i) => <p key={i} className="mt-1 text-[13px] text-ink-faint">{ev.source}{ev.note ? `: ${ev.note}` : ""}</p>)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PathList({ paths, onSelect }: { paths: Paths; onSelect?: (k: string) => void }) {
  const byDepth = [1, 2, 3, 4, 5].map((d) => paths.hops.filter((h) => h.depth === d)).filter((x) => x.length);
  return (
    <div className="grid gap-4 text-[13px]">
      <p className="text-ink-muted">If <span className="font-medium text-ink">{paths.origin.name}</span> is disrupted, these are reached through the graph, strongest first. Path strength multiplies link weights, which are analyst assumptions until calibrated.</p>
      {byDepth.map((hops, i) => (
        <div key={i}>
          <div className="mb-1.5 flex items-center gap-2 font-medium"><GitBranch className="size-4 text-accent" />{i === 0 ? "Direct effects" : i === 1 ? "Second-order effects" : i === 2 ? "Third-order effects" : `Order ${i + 1}`}<Badge className="tabular">{hops.length}</Badge></div>
          <ul className="grid gap-1">
            {hops.slice(0, 15).map((h) => (
              <li key={h.entity.key} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-surface-2">
                <button type="button" onClick={() => onSelect?.(h.entity.key)} className="min-w-0 text-start">
                  <span className="block truncate">{h.entity.name}</span>
                  <span className="text-[13px] text-ink-faint">{h.via.label} · {typeLabel(h.entity.type)}</span>
                </button>
                <span className="flex shrink-0 items-center gap-1.5"><ClaimBadge claim={h.via.class} /><span className="w-10 text-end text-[13px] tabular text-ink-muted">{num(h.cumulativeWeight, 2)}</span></span>
              </li>
            ))}
            {hops.length > 15 && <li className="px-1.5 text-[13px] text-ink-faint">and {hops.length - 15} more</li>}
          </ul>
        </div>
      ))}
      {paths.alternatives.length > 0 && (
        <div className="rounded-md border border-ok/40 bg-ok-soft p-3">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-ok"><Waypoints className="size-4" />Alternatives</div>
          {paths.alternatives.map((a) => <p key={a.entity.key} className="flex items-center gap-1.5"><ArrowRight className="size-3.5 rtl:rotate-180" />{a.entity.name} <span className="text-ink-muted">({a.label.toLowerCase()})</span> <ClaimBadge claim={a.class} /></p>)}
        </div>
      )}
      {paths.truncated && <p className="text-[13px] text-ink-faint">Showing the strongest paths only.</p>}
    </div>
  );
}
