"use client";
import { CalendarClock } from "lucide-react";
import { moduleBySlug } from "@/lib/modules";
import { PageHeader } from "./page-header";
import { Badge } from "./ui/badge";

/** Designed empty state for modules not built yet: says exactly what arrives and when. */
export function ModulePlaceholder({ slug }: { slug: string }) {
  const m = moduleBySlug(slug)!;
  return (
    <>
      <PageHeader nav={m.nav} description={m.purpose} />
      <div className="geo-pattern grid gap-6 rounded-lg border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <CalendarClock className="size-5 text-accent" />
          <h2 className="text-[19px] font-semibold">What this module will do</h2>
        </div>
        {m.arrives.length === 0 && <p className="text-ink-muted">Nothing scheduled.</p>}
        <ol className="grid gap-4">
          {m.arrives.map((a) => (
            <li key={a.week} className="grid gap-2 sm:grid-cols-[96px_1fr]">
              <div><Badge tone="gold" className="tabular">Week {a.week}</Badge></div>
              <ul className="grid gap-1.5">
                {a.items.map((i) => <li key={i} className="text-[14px] text-ink">{i}</li>)}
              </ul>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-4 text-[12px] text-ink-faint">
          Requirements:
          {m.requirements.map((r) => <Badge key={r} className="font-mono">{r}</Badge>)}
        </div>
      </div>
    </>
  );
}
