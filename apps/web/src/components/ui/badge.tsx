import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/** Status always carries text, never colour alone (FD accessibility). */
export const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[12px] font-medium leading-none whitespace-nowrap [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "border-line bg-surface-2 text-ink-muted",
      gold: "border-transparent bg-warn-soft text-accent",
      ok: "border-transparent bg-ok-soft text-ok",
      warn: "border-transparent bg-warn-soft text-warn",
      crit: "border-transparent bg-crit-soft text-crit",
      info: "border-transparent bg-info-soft text-info",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
