import { cn } from "@/lib/cn";

/** Panel: surface-1 with a hairline and a faint top highlight (DESIGN.md · Elevation level 1). */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[10px] border border-line bg-surface shadow-[var(--panel-highlight)]", className)} {...props} />;
}

export function PanelHeader({ title, eyebrow, actions, className }: { title: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-0.5 text-ink-faint">{eyebrow}</div>}
        <h2 className="panel-title text-ink">{title}</h2>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
