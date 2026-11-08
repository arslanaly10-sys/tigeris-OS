"use client";
import { usePrefs } from "./prefs";
import { Badge } from "./ui/badge";
import { AR_DESCRIPTIONS, type I18nKey } from "@/lib/i18n";

export function PageHeader({ nav, description, actions }: { nav: I18nKey; description: string; actions?: React.ReactNode }) {
  const { t, lang } = usePrefs();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 className="text-[26px] font-semibold leading-tight">{t(nav)}</h1>
          {lang === "ar" && <Badge tone="info">{t("arabicDraft")}</Badge>}
        </div>
        <p className="mt-1.5 text-[14px] text-ink-muted">{lang === "ar" ? AR_DESCRIPTIONS[nav] ?? description : description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
