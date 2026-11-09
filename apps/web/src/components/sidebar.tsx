"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { MODULES } from "@/lib/modules";
import { usePrefs } from "./prefs";
import { Wordmark } from "./wordmark";
import { IndustrySwitcher } from "./industry-switcher";
import { cn } from "@/lib/cn";

const GROUPS = [
  { key: "operate", label: "group.operate" },
  { key: "know", label: "group.know" },
  { key: "control", label: "group.control" },
] as const;

export function Sidebar() {
  const { t } = usePrefs();
  const path = usePathname();
  const link = (m: (typeof MODULES)[number]) => {
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[m.icon] ?? Icons.Circle;
    const active = path === `/${m.slug}` || path.startsWith(`/${m.slug}/`);
    return (
      <li key={m.slug}>
        <Link
          href={`/${m.slug}`}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-[2px] px-2.5 py-[7px] text-[13.5px] transition-colors",
            active ? "bg-surface-3 font-medium text-ink shadow-[inset_2px_0_0_var(--primary)] rtl:shadow-[inset_-2px_0_0_var(--primary)]" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Icon strokeWidth={1.75} className={cn("size-4 shrink-0", active ? "text-primary" : "text-ink-faint")} />
          <span className="truncate">{t(m.nav)}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="flex h-full w-[244px] shrink-0 flex-col border-e border-line bg-bg">
      <div className="flex h-[52px] items-center border-b border-line px-5"><Wordmark /></div>
      <IndustrySwitcher />
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.key} className="mt-4">
            <div className="eyebrow px-2.5 pb-1.5 text-[13px] text-ink-faint">{t(g.label)}</div>
            <ul className="grid gap-0.5">{MODULES.filter((m) => m.group === g.key).map(link)}</ul>
          </div>
        ))}
      </div>
      <ul className="grid gap-0.5 border-t border-line px-3 py-3">{MODULES.filter((m) => m.group === "meta").map(link)}</ul>
    </nav>
  );
}
