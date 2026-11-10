"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DATA_SPRING } from "@/lib/motion/tokens";
import { FLOW, MONO, SANS, Scene, type Run } from "./kit";
import type { SceneProps } from "./primitives";

/**
 * Scene 10 · Decision ledger. DRAFT: no plate was supplied; drawn from the written brief in the scenes' style.
 * A live, append-only log. New entries enter at the bottom; the row flashes once in its flow colour, the timeline
 * extends to the new node and the hash types in character by character. No ambient motion: the ledger is still.
 * The scene animates only the difference between old and new `entries`; entries never reorder or disappear (when the
 * log is longer than the panel, earlier rows move up out of view, they are not removed from the data).
 */
export type LedgerFlow = "policy" | "risk" | "transfer" | "energy" | "compute" | "gold" | "signal";
export interface LedgerEntry { id: string; at: string; actor: string; role: string; action: string; flow: LedgerFlow; hash: string }

export const SAMPLE_LEDGER: LedgerEntry[] = [
  { id: "l1", at: "09:02", actor: "Analyst", role: "Analyst", action: "Decision brief generated from engine facts", flow: "compute", hash: "9f2c41ab07e3d815" },
  { id: "l2", at: "09:06", actor: "Analyst", role: "Analyst", action: "Decision package created: rebalance within envelope", flow: "gold", hash: "3be0a7c9124fd06e" },
  { id: "l3", at: "09:11", actor: "Executive", role: "Executive", action: "Approval refused: authority below threshold", flow: "risk", hash: "c71d2e05a9b84f30" },
  { id: "l4", at: "09:24", actor: "Governance Officer", role: "Approver", action: "Package approved by the named authority", flow: "policy", hash: "e4a90b3d6c17f258" },
  { id: "l5", at: "09:25", actor: "Governance Officer", role: "Approver", action: "Four owners named from the 72-hour plan", flow: "transfer", hash: "58d13f7a0e2bc946" },
];
const VISIBLE = 7, ROW = 88, TOP = 296, X = 236;

function TypedHash({ hash, fresh, run, delay }: { hash: string; fresh: boolean; run: Run; delay: number }) {
  const [n, setN] = useState(fresh && run.entry ? 0 : hash.length);
  useEffect(() => {
    if (!fresh || !run.entry) { setN(hash.length); return; }
    let i = 0;
    const start = setTimeout(() => {
      const iv = setInterval(() => { i += 1; setN(i); if (i >= hash.length) clearInterval(iv); }, 38 / run.speed);
    }, (delay * 1000) / run.speed);
    return () => clearTimeout(start);
  }, [hash, fresh, run.entry, run.speed, delay]);
  return <>{hash.slice(0, n)}<tspan fillOpacity="0.35">{"·".repeat(hash.length - n)}</tspan></>;
}

function Body({ run, entries }: { run: Run; entries: LedgerEntry[] }) {
  const seen = useRef<Set<string> | null>(null);
  const first = seen.current === null;
  if (first) seen.current = new Set();
  const fresh = new Set(entries.filter((e) => !seen.current!.has(e.id)).map((e) => e.id));
  useEffect(() => { for (const e of entries) seen.current!.add(e.id); }, [entries]);
  const shift = Math.max(0, entries.length - VISIBLE);
  const lastY = TOP + (Math.min(entries.length, VISIBLE) - 1) * ROW;
  return (
    <>
      <rect x="150" y="196" width="1700" height="740" fill="var(--surface)" stroke="var(--line)" />
      <text x="190" y="236" fill="var(--primary)" style={{ ...MONO, fontSize: 11, letterSpacing: "0.22em" }}>Decision ledger · append-only · hash-chained</text>
      <text x="1810" y="236" textAnchor="end" fill="var(--ink-faint)" style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.16em" }}>{entries.length} entries · synthetic</text>
      <clipPath id={`${run.uid}-clip`}><rect x="150" y="256" width="1700" height="672" /></clipPath>
      <g clipPath={`url(#${run.uid}-clip)`}>
        {/* Timeline extends to the newest node */}
        <motion.line x1={X} x2={X} y1={TOP - 20} initial={run.from({ y2: TOP - 20 })} animate={{ y2: lastY }} transition={{ ...DATA_SPRING }} stroke="var(--primary)" strokeOpacity="0.35" strokeWidth="1.4" />
        <AnimatePresence initial={run.entry}>
          {entries.map((e, i) => {
            const y = TOP + (i - shift) * ROW, c = FLOW[e.flow], isNew = fresh.has(e.id);
            const delay = first ? 0.3 + i * 0.12 : 0;
            return (
              <motion.g key={e.id} initial={run.from({ opacity: 0, y: y + 14 })} animate={{ opacity: 1, y }} transition={{ opacity: run.t(0.5, delay), y: first ? run.t(0.6, delay) : DATA_SPRING }}>
                {isNew && !first && <motion.rect x="200" y="-30" width="1610" height={ROW - 12} fill={c} initial={{ opacity: 0.16 }} animate={{ opacity: 0 }} transition={{ duration: 1.2 / run.speed, ease: "easeOut" }} />}
                <line x1="200" x2="1810" y1={ROW - 42} y2={ROW - 42} stroke="var(--line)" />
                <circle cx={X} cy="0" r="9" fill="var(--bg)" stroke={c} strokeWidth="1.4" />
                <circle cx={X} cy="0" r="3.6" fill={c} />
                <text x="270" y="6" fill="var(--ink-muted)" style={{ ...MONO, fontSize: 13, letterSpacing: "0.1em" }}>{e.at}</text>
                <text x="370" y="6" fill="var(--ink)" style={{ ...SANS, fontSize: 19 }}>{e.action}</text>
                <text x="370" y="32" fill="var(--ink-muted)" style={{ ...SANS, fontSize: 14 }}>{e.actor} · {e.role}</text>
                <text x="1810" y="6" textAnchor="end" fill={c} style={{ ...MONO, fontSize: 13, letterSpacing: "0.08em" }}>
                  <TypedHash hash={e.hash} fresh={isNew} run={run} delay={first ? 0.5 + i * 0.12 : 0.3} />
                </text>
                <text x="1810" y="32" textAnchor="end" fill="var(--ink-faint)" style={{ ...MONO, fontSize: 10.5, letterSpacing: "0.14em" }}>sha-256 · prev linked</text>
              </motion.g>
            );
          })}
        </AnimatePresence>
      </g>
    </>
  );
}

export function LedgerScene({ entries = SAMPLE_LEDGER, ...props }: SceneProps & { entries?: LedgerEntry[] }) {
  return (
    <Scene n="10" section={["Governance", "Decision Ledger"]} pill="Append-only" fig="Fig. 10 — Decision ledger (draft, no plate)" entryMs={2400}
      aria={`Decision ledger with ${entries.length} append-only entries. Latest: ${entries.at(-1)?.action ?? "none"}.`} {...props}>
      {(run) => <Body run={run} entries={entries} />}
    </Scene>
  );
}
