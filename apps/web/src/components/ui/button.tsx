import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-[14px] font-medium disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink hover:bg-[color-mix(in_oklab,var(--primary)_86%,var(--ink))]",
        secondary: "border border-line-strong bg-surface-2 text-ink hover:border-ink-faint hover:bg-surface-3",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        danger: "border border-crit/45 bg-crit-soft text-crit hover:border-crit",
      },
      size: { sm: "h-9 px-3 text-[13px]", md: "h-10 px-4", lg: "h-11 px-6 text-[15px]", icon: "size-10" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
