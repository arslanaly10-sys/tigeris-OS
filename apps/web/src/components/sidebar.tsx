"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { MODULES } from "@/lib/modules";
import { sectorByIndustry } from "@/lib/command-centres";
import { usePrefs } from "./prefs";
import { useSession } from "./session-context";
import { cn } from "@/lib/cn";

const GROUPS = [
  { key: "operate", label: "group.operate" },
  { key: "know", label: "group.know" },
  { key: "control", label: "group.control" },
] as const;

/** Brand lock-up from the Command Centre mockups: palm mark, "TIGERIS AI OS", tracked tagline. */
export function Brand() {
  const { t } = usePrefs();
  return (
    <Link href="/command-centres" className="flex items-center gap-2.5" dir="ltr" aria-label="TIGERIS AI OS, Sovereign Overview">
      <Icons.TreePalm strokeWidth={1.6} className="size-9 shrink-0 text-primary" aria-hidden />
      <span className="grid leading-none">
        <span className="font-serif text-[19px] tracking-[0.04em] text-heading">TIGERIS AI OS</span>
        <span className="mt-1 max-w-[150px] text-[8.5px] uppercase leading-[1.45] tracking-[0.22em] text-ink-muted">{t("header.tagline")}</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const { t } = usePrefs();
  const s = useSession();
  const path = usePathname();
  const sector = sectorByIndustry(s.principal.industry);
  const link = (m: (typeof MODULES)[number]) => {
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[m.icon] ?? Icons.Circle;
    const active = path === `/${m.slug}` || path.startsWith(`/${m.slug}/`);
    return (
      <li key={m.slug}>
        <Link
          href={`/${m.slug}`}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-[8px] text-[13.5px] transition-colors",
            active ? "bg-primary font-semibold text-primary-ink" : "text-ink hover:bg-[color-mix(in_oklab,var(--primary)_7%,transparent)]",
          )}
        >
          <Icon strokeWidth={1.6} className={cn("size-[18px] shrink-0", active ? "text-primary-ink" : "text-primary")} />
          <span className="truncate">{t(m.nav)}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="relative flex h-full w-[236px] shrink-0 flex-col overflow-hidden border-e border-line bg-surface-2">
      <div className="flex h-[72px] shrink-0 items-center px-4"><Brand /></div>
      <div className="relative z-[1] flex-1 overflow-y-auto px-2.5 pb-4">
        {GROUPS.map((g) => (
          <div key={g.key} className="mt-3">
            <div className="eyebrow px-3 pb-1.5 text-[10.5px]">{t(g.label)}</div>
            <ul className="grid gap-0.5">{MODULES.filter((m) => m.group === g.key).map(link)}</ul>
          </div>
        ))}
        <ul className="mt-3 grid gap-0.5 border-t border-line pt-3">{MODULES.filter((m) => m.group === "meta").map(link)}</ul>
      </div>
      {sector && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sector.side} alt={`Illustrative ${sector.label.toLowerCase()} landscape`} width={236} height={300} aria-hidden
          className="pointer-events-none h-[150px] w-full shrink-0 object-cover object-bottom [mask-image:linear-gradient(to_bottom,transparent,#000_45%)]" />
      )}
    </nav>
  );
}
