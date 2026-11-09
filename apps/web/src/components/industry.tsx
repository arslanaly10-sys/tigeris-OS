"use client";
import { Banknote, Building2, Container, Factory, Flame, HeartPulse, Landmark, Plane, RadioTower, Shield, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { industryOf, type Industry } from "@tigeris/shared";

const ICONS: Record<string, LucideIcon> = { Landmark, Flame, Banknote, Container, Zap, Factory, Building2, ShieldCheck, Shield, HeartPulse, RadioTower, Plane };

export function IndustryIcon({ industry, className }: { industry: string | Industry | null | undefined; className?: string }) {
  const i = typeof industry === "string" || !industry ? industryOf(industry as string) : industry;
  const Icon = (i && ICONS[i.icon]) || Landmark;
  return <Icon className={className} aria-hidden />;
}

export const industryName = (key: string | null | undefined, lang: "en" | "ar" = "en") => {
  const i = industryOf(key);
  return i ? (lang === "ar" ? i.nameAr : i.name) : key ?? "";
};

/** Splits a list by the industry lens: the person's industry first, the rest one click away. */
export function splitByIndustry<T>(items: T[], inIndustry: (t: T) => boolean | undefined): { mine: T[]; others: T[] } {
  const mine: T[] = [];
  const others: T[] = [];
  for (const i of items) (inIndustry(i) ? mine : others).push(i);
  return { mine, others };
}

/** The one-click toggle for items outside the lens. */
export function OthersToggle({ count, open, onToggle, className }: { count: number; open: boolean; onToggle: () => void; className?: string }) {
  if (!count) return null;
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className={`flex w-full items-center justify-center gap-2 border-t border-line px-4 py-2.5 text-[13px] text-accent hover:bg-surface-2 ${className ?? ""}`}>
      {open ? "Hide other industries" : `Show other industries (${count})`}
    </button>
  );
}

/** A small "In your industry" heading row. */
export function LensHeading({ industry, count, lang }: { industry: string; count: number; lang: "en" | "ar" }) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2 text-[13px] text-ink-muted">
      <IndustryIcon industry={industry} className="size-4 text-accent" />
      <span>{lang === "ar" ? "في قطاعك" : "In your industry"}: <span className="text-ink">{industryName(industry, lang)}</span></span>
      <span className="ms-auto tabular text-ink-faint">{count}</span>
    </div>
  );
}
