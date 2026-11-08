"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, X } from "lucide-react";
import { ROLE_LABELS, type Role } from "@tigeris/shared";
import { cn } from "@/lib/cn";
import { usePrefs } from "./prefs";
import { Button } from "./ui/button";

/**
 * Light guided mode (Q118 follow-up: light guidance). A docked panel with the demo story; it never
 * blocks the screen and never clicks for the presenter. Progress is a per-browser convenience.
 */
interface Step { href: string; role: Role; en: [string, string]; ar: [string, string] }
const STEPS: Step[] = [
  { href: "/command-centre", role: "analyst", en: ["Start where attention is needed", "The queue shows the Hormuz signal and why it surfaced. The map shows simulated traffic around the strait."], ar: ["ابدأ حيث يلزم الانتباه", "تُظهر القائمة إشارة هرمز وسبب ظهورها، وتُظهر الخريطة حركة تجريبية حول المضيق."] },
  { href: "/signals", role: "analyst", en: ["Read a signal honestly", "Open the tanker-transit signal: confidence is a band with four parts, and simulated data is labelled as such."], ar: ["اقرأ الإشارة بأمانة", "افتح إشارة عبور الناقلات: الثقة نطاق من أربعة مكونات، والبيانات التجريبية معلنة."] },
  { href: "/cases/GSF-2026-0001", role: "analyst", en: ["Open the case", "Situation, evidence and the impact graph: how a strait reaches ports, cities and the institution's own holdings."], ar: ["افتح الملف", "الوضع والأدلة ومسار الأثر: كيف يصل أثر المضيق إلى الموانئ والمدن وأصول المؤسسة."] },
  { href: "/cases/GSF-2026-0001?tab=Scenarios", role: "analyst", en: ["Run scenarios", "Baseline and two alternatives across four horizons. Click any number for its formula, facts and assumptions."], ar: ["شغّل السيناريوهات", "خط أساس وبديلان عبر أربعة آفاق زمنية. انقر أي رقم لترى معادلته وحقائقه وافتراضاته."] },
  { href: "/scenarios", role: "domain_expert", en: ["Show the back-test", "Real Brent prices around four past disruptions calibrate the price response; an expert adopts it."], ar: ["اعرض المعايرة التاريخية", "أسعار برنت الفعلية حول أربع أزمات سابقة تعاير استجابة السعر، ويعتمدها خبير."] },
  { href: "/cases/GSF-2026-0001?tab=Agents", role: "analyst", en: ["Let the agents work", "Ten bounded agents on the local model. Watch them challenge each other; every sentence is checked for its source."], ar: ["دع الوكلاء يعملون", "عشرة وكلاء مقيّدين على النموذج المحلي. شاهدهم يعترضون على بعضهم، وكل جملة تُفحص لمصدرها."] },
  { href: "/cases/GSF-2026-0001?tab=Options", role: "analyst", en: ["Compare options", "Each option is measured with the engine, with confidence parts, policy checks and who must decide."], ar: ["قارن الخيارات", "كل خيار مقاس بالمحرك، مع مكونات الثقة وفحوص السياسة ومن يملك القرار."] },
  { href: "/cases/GSF-2026-0001?tab=Decision%20and%20memory", role: "approver", en: ["Decide, with two people", "Switch to the Approver, record a decision; the Executive gives the second approval. Then replay it."], ar: ["قرّر بشخصين", "انتقل إلى دور المعتمِد وسجّل القرار، ثم يمنح التنفيذي الموافقة الثانية. بعدها أعد تشغيل القرار."] },
  { href: "/governance", role: "administrator", en: ["Show sovereignty and policy", "The foreign-model switch, the policy editor with its tests, and the live security posture."], ar: ["اعرض السيادة والسياسات", "مفتاح النماذج الأجنبية، ومحرر السياسات واختباراته، وفحوص الأمان الحية."] },
  { href: "/memory", role: "approver", en: ["Close the loop in memory", "Search precedents by meaning; approve the case's own entry so the next team finds it."], ar: ["أغلق الحلقة في الذاكرة", "ابحث في السوابق بالمعنى، واعتمد سجل الملف ليجده الفريق التالي."] },
];

const KEY = "tigeris.guide";
function load(): { open: boolean; step: number } {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "{}"); return { open: !!v.open, step: Math.min(STEPS.length - 1, Math.max(0, Number(v.step) || 0)) }; } catch { return { open: false, step: 0 }; }
}

export function Guide() {
  const { t, lang } = usePrefs();
  const path = usePathname();
  const [st, setSt] = useState<{ open: boolean; step: number }>({ open: false, step: 0 });
  useEffect(() => { setSt(load()); }, []);
  const save = (v: { open: boolean; step: number }) => { setSt(v); try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };
  const s = STEPS[st.step]!;
  const [title, body] = lang === "ar" ? s.ar : s.en;
  const here = path === s.href.split("?")[0];
  if (!st.open) return (
    <button type="button" onClick={() => save({ ...st, open: true })} className="fixed bottom-5 end-5 z-30 flex items-center gap-2 rounded-full border border-primary/50 bg-surface px-4 py-2 text-[13px] font-medium text-ink shadow-[var(--overlay-shadow)] hover:border-primary print:hidden">
      <Compass className="size-4 text-accent" />{t("guide.button")}
    </button>
  );
  return (
    <aside aria-label={t("guide.title")} className="fixed bottom-5 end-5 z-30 w-[min(360px,calc(100vw-2.5rem))] rounded-lg border border-primary/50 bg-surface p-4 shadow-[var(--overlay-shadow)] print:hidden">
      <div className="flex items-center gap-2">
        <Compass className="size-4 text-accent" />
        <span className="eyebrow text-ink-faint">{t("guide.step")} {st.step + 1} {t("guide.of")} {STEPS.length}</span>
        <button type="button" onClick={() => save({ ...st, open: false })} aria-label={t("guide.close")} className="ms-auto text-ink-faint hover:text-ink"><X className="size-4" /></button>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= st.step ? "bg-primary" : "bg-surface-3")} />)}</div>
      <h2 className="mt-3 text-[16px] font-semibold">{title}</h2>
      <p className="mt-1 text-[13px] text-ink-muted">{body}</p>
      <p className="mt-2 text-[12px] text-ink-faint">{t("guide.role")}: {ROLE_LABELS[s.role]}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!here && <Button asChild size="sm" variant="primary"><Link href={s.href}>{t("guide.go")}</Link></Button>}
        <Button size="sm" variant="secondary" disabled={st.step === 0} onClick={() => save({ ...st, step: st.step - 1 })}>{t("guide.back")}</Button>
        {st.step < STEPS.length - 1
          ? <Button size="sm" variant={here ? "primary" : "secondary"} onClick={() => save({ ...st, step: st.step + 1 })}>{t("guide.next")}</Button>
          : <Button size="sm" variant="secondary" onClick={() => save({ open: true, step: 0 })}>{t("guide.restart")}</Button>}
      </div>
    </aside>
  );
}
