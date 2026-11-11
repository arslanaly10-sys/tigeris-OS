"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DOCTRINES } from "@/content/sovereign";
import { DOCTRINE } from "@/content/client-copy";
import { usePrefs } from "./prefs";

/**
 * Sign-in hero: the opening line, then Doctrine 01–04 in turn (about 7 s each). Pauses on hover or focus;
 * under reduced motion it stays on the opening line and lists the doctrines below it, without movement.
 */
export function DoctrineRotator() {
  const { lang } = usePrefs();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const slides = [{ n: "", text: DOCTRINE, ar: DOCTRINE }, ...DOCTRINES];
  useEffect(() => {
    if (reduce || hold) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [reduce, hold, slides.length]);
  const s = slides[i]!;
  return (
    <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)} className="min-h-[190px]" aria-live="off">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 200, damping: 26 }}>
          {s.n && <p className="eyebrow mb-2">Our doctrine · {s.n}</p>}
          <p className={s.n ? "max-w-[30ch] font-serif text-[28px] leading-[1.25] text-ink" : "statement text-[52px] text-ink"}>{lang === "ar" && s.n ? s.ar : s.text}</p>
        </motion.div>
      </AnimatePresence>
      {!reduce && (
        <div className="mt-4 flex gap-1.5" role="group" aria-label="Doctrine">
          {slides.map((x, k) => <button key={k} type="button" onClick={() => setI(k)} aria-label={x.n ? `Doctrine ${x.n}` : "Opening line"} aria-pressed={k === i} className="tap grid h-6 w-7 place-items-center"><span className={`block h-1 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-3 bg-line-strong"}`} /></button>)}
        </div>
      )}
      {reduce && <ol className="mt-4 grid gap-2 text-[14px] text-ink-muted">{DOCTRINES.map((d) => <li key={d.n}><span className="eyebrow me-2">{d.n}</span>{d.text}</li>)}</ol>}
    </div>
  );
}
