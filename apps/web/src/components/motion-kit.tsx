"use client";
/**
 * Motion kit: the OS's shared animation vocabulary (DESIGN.md · Motion). Expressive but governed:
 * springs for entrances, count-ups for figures, slide-ins for new rows. Every piece honours reduced motion
 * through the root <MotionConfig reducedMotion="user"> plus explicit checks where text is animated.
 * Count-ups only animate the display of a number the engine already produced; the final text is that exact value.
 */
import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react";

export const spring = { type: "spring", stiffness: 260, damping: 24, mass: 0.9 } as const;
export const springSoft = { type: "spring", stiffness: 170, damping: 22 } as const;

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
};

/** A container whose Stagger.Item children rise in one after another when it scrolls into view. */
export function Stagger({ children, className, as = "div", ...rest }: { as?: "div" | "ul" | "section" } & HTMLMotionProps<"div">) {
  const M = (as === "ul" ? motion.ul : as === "section" ? motion.section : motion.div) as typeof motion.div;
  return <M className={className} variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }} {...rest}>{children}</M>;
}
export function StaggerItem({ children, className, as = "div", ...rest }: { as?: "div" | "li" | "section" } & HTMLMotionProps<"div">) {
  const M = (as === "li" ? motion.li : as === "section" ? motion.section : motion.div) as typeof motion.div;
  return <M className={className} variants={item} {...rest}>{children}</M>;
}

/** Fade and rise once, on mount or when scrolled into view. */
export function Reveal({ children, delay = 0, y = 18, className, ...rest }: { delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.05 }} transition={{ ...spring, delay }} {...rest}>
      {children}
    </motion.div>
  );
}

const NUM = /-?\d[\d,]*(?:\.\d+)?/;

/**
 * Counts a displayed figure up to its value. Accepts the formatted string ("$2.00B", "31%", "22 days", "28.7"):
 * the first number is animated with the same decimals, prefix and suffix kept. When the value changes later
 * (75.2 → 44.1 after an approval) it counts from the old value to the new one. Screen readers get the final text.
 */
export function CountUp({ value, className, duration = 1.1, from }: { value: string | number; className?: string; duration?: number; from?: number }) {
  const text = String(value);
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(from ?? null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const m = text.match(NUM);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!m || reduce) { el.textContent = text; return; }
    if (!inView) return;
    const raw = m[0];
    const target = Number(raw.replace(/,/g, ""));
    const decimals = raw.split(".")[1]?.length ?? 0;
    const comma = raw.includes(",");
    const [pre, post] = [text.slice(0, m.index), text.slice((m.index ?? 0) + raw.length)];
    const from = prev.current ?? 0;
    prev.current = target;
    if (from === target) { el.textContent = text; return; }
    const fmt = (n: number) => { const s = n.toFixed(decimals); return comma ? Number(s).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s; };
    const c = animate(from, target, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = pre + fmt(v) + post; }, onComplete: () => { el.textContent = text; } });
    return () => c.stop();
  }, [text, inView, reduce, duration]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">{m && !reduce ? text.replace(NUM, (r) => r.replace(/\d/g, "0")) : text}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** A short highlight pulse whenever `trigger` changes (a status flipping to approved, a figure being written back). */
export function Flash({ trigger, children, className }: { trigger: unknown; children: React.ReactNode; className?: string }) {
  const first = useRef(true);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce || !ref.current) return;
    const c = animate(ref.current, { boxShadow: ["0 0 0 0 rgba(182,138,63,0)", "0 0 0 6px rgba(182,138,63,.35)", "0 0 0 0 rgba(182,138,63,0)"], scale: [1, 1.015, 1] }, { duration: 0.9, ease: "easeOut" });
    return () => c.stop();
  }, [trigger, reduce]);
  return <div ref={ref} className={className}>{children}</div>;
}
