import { cn } from "@/lib/cn";

/** Panel: surface-1 with a hairline and a faint top highlight (DESIGN.md · Elevation level 1). */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  // min-w-0: inside a grid a panel may shrink to the screen, so a wide table scrolls within it instead of widening the page.
  return <section className={cn("min-w-0 rounded-lg border border-line bg-surface", className)} {...props} />;
}

export function PanelHeader({ title, eyebrow, actions, className }: { title: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-3)] px-4 py-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h2 className="panel-title text-ink">{title}</h2>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
