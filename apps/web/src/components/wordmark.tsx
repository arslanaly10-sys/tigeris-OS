import { cn } from "@/lib/cn";

/** Text wordmark only until the client supplies a logo (Q013). */
export function Wordmark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 leading-none", className)} dir="ltr">
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("shrink-0 text-primary", size === "lg" ? "size-9" : "size-[22px]")}>
        <path d="M12 1.5 14.6 9.4 22.5 12 14.6 14.6 12 22.5 9.4 14.6 1.5 12 9.4 9.4Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      </svg>
      <span className="flex flex-col">
        <span className={cn("font-serif font-semibold tracking-[0.16em] text-ink", size === "lg" ? "text-[28px]" : "text-[16px]")}>TIGERIS</span>
        <span className={cn("mt-1 font-sans font-medium uppercase tracking-[0.14em] text-ink-faint", size === "lg" ? "text-[11px]" : "text-[8.5px]")}>Sovereign Intelligence OS</span>
      </span>
    </div>
  );
}
