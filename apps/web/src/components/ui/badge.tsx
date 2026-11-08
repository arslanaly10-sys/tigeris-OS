import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/** Status always carries text, never colour alone (FD accessibility). */
export const badgeVariants = cva("inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[3px] text-[11.5px] font-medium leading-none tracking-[0.01em] whitespace-nowrap [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "border-line-strong/70 bg-surface-2 text-ink-muted",
      gold: "border-primary/35 bg-primary-soft text-accent",
      ok: "border-ok/35 bg-ok-soft text-ok",
      warn: "border-warn/35 bg-warn-soft text-warn",
      crit: "border-crit/35 bg-crit-soft text-crit",
      info: "border-info/35 bg-info-soft text-info",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
