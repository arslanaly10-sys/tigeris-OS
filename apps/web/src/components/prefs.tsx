"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { translator, type I18nKey } from "@/lib/i18n";
import { LANG_COOKIE, THEME_COOKIE, setPrefCookie, type Lang, type Theme } from "@/lib/prefs";

interface Prefs {
  theme: Theme;
  lang: Lang;
  t: (k: I18nKey) => string;
  toggleTheme: () => void;
  toggleLang: () => void;
}
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ initialTheme, initialLang, children }: { initialTheme: Theme; initialLang: Lang; children: React.ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);
  const [lang, setLang] = useState(initialLang);
  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setPrefCookie(THEME_COOKIE, next);
    setTheme(next);
  }, [theme]);
  const toggleLang = useCallback(() => {
    const next: Lang = lang === "en" ? "ar" : "en";
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    setPrefCookie(LANG_COOKIE, next);
    setLang(next);
  }, [lang]);
  const value = useMemo(() => ({ theme, lang, t: translator(lang), toggleTheme, toggleLang }), [theme, lang, toggleTheme, toggleLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs outside PrefsProvider");
  return v;
}
