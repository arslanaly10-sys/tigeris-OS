"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "./motion-kit";
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
      <Icons.TreePalm strokeWidth={1.6} className="size-7 shrink-0 text-primary" aria-hidden />
      <span className="grid leading-none">
        <span className="font-serif text-[16px] tracking-[0.04em] text-heading">TIGERIS AI OS</span>
        <span className="mt-1 max-w-[170px] text-[8px] uppercase leading-[1.4] tracking-[0.16em] text-ink-muted">{t("header.tagline")}</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const { t } = usePrefs();
  const s = useSession();
  const path = usePathname();
  const navId = useId();
  const sector = sectorByIndustry(s.principal.industry);
  // Collapsible groups; the group holding the current page always stays open. Remembered per browser.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setClosed(JSON.parse(localStorage.getItem("tg.nav.closed") ?? "{}")); } catch { /* storage unavailable */ } }, []);
  const toggle = (k: string) => setClosed((c) => { const n = { ...c, [k]: !c[k] }; try { localStorage.setItem("tg.nav.closed", JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const link = (m: (typeof MODULES)[number]) => {
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[m.icon] ?? Icons.Circle;
    const active = path === `/${m.slug}` || path.startsWith(`/${m.slug}/`);
    return (
      <li key={m.slug}>
        <Link
          href={`/${m.slug}`}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] transition-colors",
            active ? "font-semibold text-primary-ink" : "text-ink hover:bg-[color-mix(in_oklab,var(--primary)_7%,transparent)]",
          )}
        >
          {active && <motion.span layoutId={`nav-active-${navId}`} aria-hidden className="absolute inset-0 -z-0 rounded-md bg-primary" transition={spring} />}
          <Icon strokeWidth={1.6} className={cn("relative size-4 shrink-0", active ? "text-primary-ink" : "text-primary")} />
          <span className="relative truncate">{t(m.nav)}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Main" className="relative flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-e border-line bg-surface-2">
      <div className="flex h-[64px] shrink-0 items-center px-4"><Brand /></div>
      <div className="relative z-[1] flex-1 overflow-y-auto px-2.5 pb-4">
        {GROUPS.map((g) => {
          const items = MODULES.filter((m) => m.group === g.key);
          const holdsCurrent = items.some((m) => path === `/${m.slug}` || path.startsWith(`/${m.slug}/`));
          const open = holdsCurrent || !closed[g.key];
          return (
            <div key={g.key} className="mt-2">
              <button type="button" onClick={() => toggle(g.key)} aria-expanded={open} disabled={holdsCurrent}
                className="eyebrow flex w-full items-center justify-between rounded px-2.5 py-1 text-[10px] disabled:cursor-default">
                <span>{t(g.label)}</span>
                {!holdsCurrent && <Icons.ChevronDown aria-hidden className={cn("size-3.5 transition-transform duration-300 motion-reduce:transition-none", open ? "" : "-rotate-90 rtl:rotate-90")} />}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul key="items" className="grid gap-px overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ...spring, opacity: { duration: 0.18 } }}>
                    {items.map(link)}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        <ul className="mt-2 grid gap-px border-t border-line pt-2">{MODULES.filter((m) => m.group === "meta").map(link)}</ul>
      </div>
      {sector && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sector.side} alt={`Illustrative ${sector.label.toLowerCase()} landscape`} width={220} height={300} aria-hidden
          className="pointer-events-none h-[110px] w-full shrink-0 object-cover object-bottom opacity-80 [filter:saturate(.65)_contrast(.95)_sepia(.1)] [mask-image:linear-gradient(to_bottom,transparent,#000_45%)]" />
      )}
    </nav>
  );
}
