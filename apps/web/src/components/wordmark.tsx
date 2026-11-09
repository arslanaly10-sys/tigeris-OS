import { cn } from "@/lib/cn";

/**
 * Typographic wordmark in the client's style (tigercapital.ai uses text, not a logo mark): "TIGERIS" in Space
 * Grotesk bold with wide tracking, and a mono descriptor. Replace with the client's SVG logo when supplied.
 */
export function Wordmark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <div className={cn("flex flex-col leading-none", className)} dir="ltr">
      <span className={cn("font-serif font-bold tracking-[0.18em] text-ink", size === "lg" ? "text-[30px]" : "text-[17px]")}>TIGERIS</span>
      <span className={cn("mt-1.5 whitespace-nowrap font-mono uppercase tracking-[0.12em] text-ink-faint", size === "lg" ? "text-[12px]" : "text-[10.5px]")}>Sovereign Intelligence OS</span>
    </div>
  );
}
