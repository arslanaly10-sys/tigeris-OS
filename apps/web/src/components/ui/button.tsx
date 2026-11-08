import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-[13.5px] font-medium tracking-[0.005em] transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-primary-hover",
        secondary: "border border-line-strong bg-surface-2 text-ink hover:bg-surface-3",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        danger: "border border-crit/45 bg-crit-soft text-crit hover:border-crit",
      },
      size: { sm: "h-8 px-3 text-[12.5px]", md: "h-9 px-3.5", lg: "h-11 px-5 text-[14.5px]", icon: "size-9" },
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
