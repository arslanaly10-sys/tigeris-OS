import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/** Status always carries text, never colour alone (FD accessibility). */
export const badgeVariants = cva("inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "border-line bg-surface-2 text-ink-muted",
      gold: "border-primary/40 bg-primary-soft text-accent",
      ok: "border-ok/40 bg-ok-soft text-ok",
      warn: "border-warn/40 bg-warn-soft text-warn",
      crit: "border-crit/40 bg-crit-soft text-crit",
      info: "border-info/40 bg-info-soft text-info",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
