"use client";
import { usePrefs } from "./prefs";
import { Badge } from "./ui/badge";
import { AR_DESCRIPTIONS, type I18nKey } from "@/lib/i18n";

export function PageHeader({ nav, description, actions }: { nav: I18nKey; description: string; actions?: React.ReactNode }) {
  const { t, lang } = usePrefs();
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0 max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 key={nav} className="enter-mask text-[34px] leading-[1.1]"><span className="enter-line">{t(nav)}</span></h1>
          {lang === "ar" && <Badge tone="info">{t("arabicDraft")}</Badge>}
        </div>
        <p key={`${nav}-d`} className="enter-follow mt-3 max-w-[62ch] text-[16px] leading-relaxed text-ink-muted">{lang === "ar" ? AR_DESCRIPTIONS[nav] ?? description : description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
