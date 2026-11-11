"use client";
import { usePrefs } from "./prefs";
import { Badge } from "./ui/badge";
import { AR_DESCRIPTIONS, type I18nKey } from "@/lib/i18n";
import { MODULES } from "@/lib/modules";

/**
 * Page header in the client's site language: a numbered mono eyebrow with a hairline rule ("04 · Operate ·
 * Decision Authority"), the title in Space Grotesk, one line of description.
 */
export function PageHeader({ nav, description, actions }: { nav: I18nKey; description: string; actions?: React.ReactNode }) {
  const { t, lang } = usePrefs();
  const i = MODULES.findIndex((m) => m.nav === nav);
  const m = MODULES[i];
  const num = String(i + 1).padStart(2, "0");
  const group = m && m.group !== "meta" ? t(`group.${m.group}` as I18nKey) : null;
  return (
    <div className="mb-4">
      <div className="eyebrow mb-2 flex items-center gap-3" aria-hidden="true">
        <span className="tabular">{num}</span><span>·</span>{group && <><span>{group}</span><span>·</span></>}<span>{t(nav)}</span>
        
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex items-center gap-2">
            <h1 key={nav} className="enter-mask text-[30px] leading-[1.1]"><span className="enter-line">{t(nav)}</span></h1>
            {lang === "ar" && <Badge tone="info">{t("arabicDraft")}</Badge>}
          </div>
          <p key={`${nav}-d`} className="enter-follow mt-1.5 max-w-[88ch] font-serif text-[14.5px] leading-normal text-ink">{lang === "ar" ? AR_DESCRIPTIONS[nav] ?? description : description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
