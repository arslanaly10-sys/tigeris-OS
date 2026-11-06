"use client";
import { Languages, Moon, Sun } from "lucide-react";
import { usePrefs } from "./prefs";
import { Button } from "./ui/button";

export function PrefToggles() {
  const { theme, toggleTheme, toggleLang, t } = usePrefs();
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={toggleLang} aria-label="Switch language">
        <Languages />
        <span className="text-[13px]">{t("header.language")}</span>
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>
    </div>
  );
}
