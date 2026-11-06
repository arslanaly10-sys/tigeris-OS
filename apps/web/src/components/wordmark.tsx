import { cn } from "@/lib/cn";

/** Text wordmark only until the client supplies a logo (Q013). */
export function Wordmark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <div className={cn("flex flex-col leading-none", className)} dir="ltr">
      <span className={cn("font-serif font-semibold tracking-[0.18em] text-ink", size === "lg" ? "text-[30px]" : "text-[19px]")}>TIGERIS</span>
      <span className={cn("eyebrow mt-1.5 text-accent", size === "lg" ? "text-[11.5px]" : "text-[9.5px]")}>Sovereign Intelligence OS</span>
    </div>
  );
}
