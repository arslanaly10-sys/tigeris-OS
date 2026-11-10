"use client";
import { usePrefs } from "./prefs";

/** Language switch, as on the Command Centre mockups: "EN | العربية", the current one in bold. */
export function PrefToggles() {
  const { toggleLang, lang } = usePrefs();
  return (
    <button type="button" onClick={toggleLang} aria-label={lang === "en" ? "Switch to Arabic" : "Switch to English"} className="tap px-2 text-[13.5px] whitespace-nowrap">
      <span className={lang === "en" ? "font-bold" : "text-ink-muted"}>EN</span> | <span className={lang === "ar" ? "font-bold" : "text-ink-muted"} lang="ar">العربية</span>
    </button>
  );
}
