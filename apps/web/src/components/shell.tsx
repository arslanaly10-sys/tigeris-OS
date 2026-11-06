"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthContext } from "@/lib/api";
import { SessionProvider } from "./session-context";
import { LineageProvider } from "./lineage";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { usePrefs } from "./prefs";
import { cn } from "@/lib/cn";

export function Shell({ context, children }: { context: AuthContext; children: React.ReactNode }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <SessionProvider value={context}>
      <LineageProvider>
      <div className="flex h-full" data-density={context.density}>
        <div className="hidden lg:block"><Sidebar /></div>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close navigation" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 start-0 pt-[env(safe-area-inset-top,0px)]"><Sidebar /></div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Header onMenu={() => setOpen(true)} />
          <main className={cn("flex-1 px-4 py-6 sm:px-6", context.density === "spacious" ? "lg:px-10 lg:py-9" : "lg:px-6")}>{children}</main>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-3 text-[11.5px] text-ink-faint">
            <span>{t("footer.confidential")}</span>
            <span>TIGERIS · Sovereign Intelligence OS · Demonstration build · Fictional institutions and people</span>
          </footer>
        </div>
      </div>
      </LineageProvider>
    </SessionProvider>
  );
}
