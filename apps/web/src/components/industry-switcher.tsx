"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, type IndustryKey } from "@tigeris/shared";
import { api } from "@/lib/api";
import { useSession } from "./session-context";
import { usePrefs } from "./prefs";
import { IndustryIcon } from "./industry";

/** Industry lens (sidebar): what the OS shows first. Changing it is audited; permissions do not change. */
export function IndustrySwitcher() {
  const s = useSession();
  const { t, lang } = usePrefs();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current = s.principal.industry;
  async function change(next: IndustryKey) {
    if (next === current) return;
    setBusy(true);
    const r = await api("/auth/industry", { json: { industry: next } });
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return (
    <label className="grid gap-1 border-b border-line px-5 py-3">
      <span className="text-[13px] text-ink-faint">{t("industry.lens")}</span>
      <span className="relative flex items-center">
        <IndustryIcon industry={current} className="pointer-events-none absolute start-2.5 size-4 text-accent" />
        <select
          value={current}
          disabled={busy}
          onChange={(e) => change(e.target.value as IndustryKey)}
          aria-label={t("industry.lens")}
          className="h-9 w-full appearance-none truncate rounded-md border border-line-strong bg-surface-2 ps-8 pe-7 text-[13px] text-ink disabled:opacity-60"
        >
          {INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{lang === "ar" ? i.nameAr : i.name}</option>)}
        </select>
        <span aria-hidden className="pointer-events-none absolute end-2.5 text-[13px] text-ink-faint">▾</span>
      </span>
      {s.principal.industryTitle && <span className="truncate text-[13px] text-ink-muted" title={lang === "ar" ? s.principal.industryTitleAr ?? "" : s.principal.industryTitle}>{lang === "ar" ? s.principal.industryTitleAr : s.principal.industryTitle}</span>}
    </label>
  );
}
