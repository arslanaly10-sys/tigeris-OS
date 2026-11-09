"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "../page-header";
import { Panel } from "../ui/panel";
import { Badge } from "../ui/badge";
import { typeLabel } from "./graph";
import { useSession } from "../session-context";
import { IndustryIcon } from "../industry";
import { cn } from "@/lib/cn";

interface Domain { key: string; name: string; description: string; status: "active" | "configured" | "planned"; entity_types: string[]; entities: number; cases: number }
const TONE = { active: "ok", configured: "info", planned: "neutral" } as const;

export function DomainsModule() {
  const [rows, setRows] = useState<Domain[] | null>(null);
  const lens = useSession().principal.industry;
  useEffect(() => { api<{ domains: Domain[] }>("/domains").then((r) => r.ok && setRows(r.data.domains)); }, []);
  return (
    <>
      <PageHeader nav="nav.domains" description="Twelve industry packs extend one shared graph, case workflow and governance layer: the eight original packs and four added for defence, healthcare, telecoms and transport. None is a separate product or dashboard. Your industry lens is listed first." />
      {!rows && <div className="h-64 animate-pulse rounded-lg bg-surface-2" />}
      <div className="grid gap-4 md:grid-cols-2">
        {rows && [...rows].sort((a, b) => Number(b.key === lens) - Number(a.key === lens)).map((d) => (
          <Panel key={d.key} className={cn("grid gap-3 p-5", d.key === lens && "border-primary/60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-accent"><IndustryIcon industry={d.key} className="size-[18px]" /></span>
                <div><div className="eyebrow text-ink-faint">{d.key === lens ? "Your industry lens" : `Pack ${rows.findIndex((r) => r.key === d.key) + 1}`}</div><h2 className="text-[18px] font-medium">{d.name}</h2></div>
              </div>
              <Badge tone={TONE[d.status]}>{d.status}</Badge>
            </div>
            <p className="text-[13.5px] text-ink-muted">{d.description}</p>
            <div className="flex flex-wrap gap-1.5">{d.entity_types.map((t) => <Link key={t} href={`/graph?focus=`} className="pointer-events-none"><Badge>{typeLabel(t)}</Badge></Link>)}</div>
            <div className="flex gap-4 text-[13px] text-ink-muted tabular"><span>{d.entities.toLocaleString("en-GB")} entities</span><span>{d.cases} cases</span></div>
          </Panel>
        ))}
      </div>
    </>
  );
}
