"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader } from "../page-header";
import { Panel, PanelHeader } from "../ui/panel";
import { Badge } from "../ui/badge";
import { BacktestPanel } from "../backtest-ui";

interface Group { group_id: string; case_key: string; title: string; created_at: string; variants: number; by: string; baseline_resilience: number | null }

export function ScenariosModule() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  useEffect(() => { api<{ groups: Group[] }>("/scenarios").then((r) => r.ok && setGroups(r.data.groups)); }, []);
  return (
    <>
      <PageHeader nav="nav.scenarios" description="Every scenario comparison across the institution's cases. Each run keeps its exact inputs, so it can be replayed and its numbers traced to facts and assumptions." />
      <Panel>
        <PanelHeader eyebrow="Saved comparisons" title="Scenario runs" actions={groups && <Badge className="tabular">{groups.length}</Badge>} />
        {!groups && <div className="m-4 h-40 animate-pulse rounded bg-surface-2" />}
        {groups?.length === 0 && <p className="p-4 text-[13px] text-ink-muted">No scenarios yet. Open a case, go to its Scenarios tab, and run a baseline with up to two alternatives.</p>}
        <ul className="divide-y divide-line">
          {groups?.map((g) => (
            <li key={g.group_id}>
              <Link href={`/cases/${g.case_key}?tab=Scenarios`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="min-w-0"><span className="block font-medium">{g.title}</span><span className="text-[12px] text-ink-faint">{g.case_key} · {g.variants} scenario{g.variants > 1 ? "s" : ""} · {g.by} · {formatDate(g.created_at, true)}</span></span>
                {g.baseline_resilience !== null && <span className="text-[12.5px] text-ink-muted">Baseline resilience <b className="tabular text-ink">{Math.round(g.baseline_resilience)}</b>/100</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
      <BacktestPanel />
    </>
  );
}
