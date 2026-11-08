"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";

/** Side drawer on the inline-end edge; closes on Escape or the backdrop. */
export function Drawer({ open, onClose, title, eyebrow, children }: { open: boolean; onClose: () => void; title: React.ReactNode; eyebrow?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="absolute inset-y-0 end-0 flex w-[min(560px,100vw)] flex-col border-s border-line bg-surface pt-[env(safe-area-inset-top,0px)] shadow-[var(--overlay-shadow)] outline-none">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow text-ink-faint">{eyebrow}</div>}
            <h2 className="text-[18px] font-semibold leading-snug">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-faint">{label}</dt>
      <dd className="break-words text-[13px] text-ink">{children}</dd>
    </div>
  );
}
