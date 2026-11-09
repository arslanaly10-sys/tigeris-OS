"use client";
import { Languages } from "lucide-react";
import { usePrefs } from "./prefs";
import { Button } from "./ui/button";

/** Language switch. The client's brand has one theme (ivory), so there is no theme toggle. */
export function PrefToggles() {
  const { toggleLang, t } = usePrefs();
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={toggleLang} aria-label="Switch language">
        <Languages />
        <span className="text-[13px]">{t("header.language")}</span>
      </Button>
    </div>
  );
}
