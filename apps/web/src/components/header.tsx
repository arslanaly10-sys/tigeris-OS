"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Bell, Check, ChevronDown, Database, Landmark, LogOut, Menu, RotateCcw, Search, Server, UserRound, Users } from "lucide-react";
import { ROLE_LABELS } from "@tigeris/shared";
import { MODULES } from "@/lib/modules";
import { api } from "@/lib/api";
import { usePrefs } from "./prefs";
import { useSession } from "./session-context";
import { PrefToggles } from "./pref-toggles";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const menuItem = "flex cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { t, lang } = usePrefs();
  const s = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return MODULES.filter((m) => t(m.nav).toLowerCase().includes(n)).slice(0, 3);
  }, [q, t]);
  const [found, setFound] = useState<{ signals: { id: string; title: string }[]; cases: { case_key: string; title: string }[]; entities: { key: string; name: string; type: string }[]; evidence: { id: string; title: string }[] } | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const h = setTimeout(() => api<NonNullable<typeof found>>(`/search?q=${encodeURIComponent(q.trim())}`).then((r) => r.ok && setFound(r.data)), 200);
    return () => clearTimeout(h);
  }, [q]);
  const results = [
    ...(found?.cases ?? []).map((c) => ({ href: `/cases/${c.case_key}`, title: c.title, sub: `Case · ${c.case_key}` })),
    ...(found?.signals ?? []).map((x) => ({ href: `/signals?focus=${x.id}`, title: x.title, sub: "Signal" })),
    ...(found?.entities ?? []).map((e) => ({ href: `/graph?focus=${encodeURIComponent(e.key)}`, title: e.name, sub: `Entity · ${e.type.replace("_", " ")}` })),
    ...(found?.evidence ?? []).map((e) => ({ href: `/sources`, title: e.title, sub: "Evidence" })),
    ...hits.map((m) => ({ href: `/${m.slug}`, title: t(m.nav), sub: "Module" })),
  ];
  const [notes, setNotes] = useState<{ unread: number; notifications: { id: string; title: string; body: string; link: string; created_at: string; read_at: string | null }[] } | null>(null);
  useEffect(() => {
    const load = () => api<NonNullable<typeof notes>>("/notifications").then((r) => r.ok && setNotes(r.data));
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [s.principal.id]);

  async function switchTo(id: string) {
    const r = await api("/auth/switch-role", { json: { principalId: id } });
    if (r.ok) router.refresh();
  }
  async function signOut() {
    await api("/auth/sign-out", { json: {} });
    router.replace("/sign-in");
    router.refresh();
  }
  async function reset(e: Event) {
    if (!armed) {
      e.preventDefault();
      setArmed(true);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    await api("/demo/reset", { json: {} });
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu /></Button>

      <Popover.Root open={results.length > 0}>
        <Popover.Anchor asChild>
          <label className="relative flex h-9 min-w-0 max-w-[420px] flex-1 items-center">
            <Search className="pointer-events-none absolute start-3 size-4 text-ink-faint" />
            <input
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && results[0]) { router.push(results[0].href); setQ(""); } }}
              placeholder={t("header.search")}
              aria-label={t("header.search")}
              className="h-9 w-full rounded-md border border-line bg-surface-2 ps-9 pe-3 text-[13px] text-ink placeholder:text-ink-faint"
            />
          </label>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} onOpenAutoFocus={(e) => e.preventDefault()} className="z-50 w-[min(420px,90vw)] rounded-lg border border-line bg-surface p-1.5 shadow-xl">
            {results.slice(0, 12).map((r, i) => (
              <Link key={i} href={r.href} onClick={() => setQ("")} className="block rounded px-2.5 py-2 hover:bg-surface-2">
                <div className="line-clamp-1 text-[13px] font-medium">{r.title}</div>
                <div className="text-[11.5px] text-ink-muted">{r.sub}</div>
              </Link>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <div className="ms-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 xl:flex">
          <Badge tone="info" title="Deployment profile"><Server />{t("header.environment")}</Badge>
          <Badge tone="neutral" title="Data mode"><Database />{t("header.dataMode")}</Badge>
        </div>
        <Badge tone="gold" className="hidden sm:inline-flex">{t("header.demo")}</Badge>
        {lang === "ar" && <Badge tone="info" className="hidden md:inline-flex">{t("arabicDraft")}</Badge>}

        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={`${t("header.notifications")}${notes?.unread ? ` (${notes.unread} unread)` : ""}`}>
              <Bell />{notes?.unread ? <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-semibold text-white tabular">{notes.unread}</span> : null}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} className="z-50 w-80 rounded-lg border border-line bg-surface p-2 shadow-xl">
              <div className="flex items-center justify-between px-2 py-1.5"><span className="font-semibold">{t("header.notifications")}</span>
                {notes?.unread ? <button type="button" className="text-[12px] text-accent hover:underline" onClick={async () => { await api("/notifications/read", { json: {} }); setNotes((n) => n && { ...n, unread: 0, notifications: n.notifications.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) }); }}>Mark all read</button> : null}
              </div>
              {!notes?.notifications.length && <p className="px-2 pb-2 text-[13px] text-ink-muted">{t("header.noNotifications")}</p>}
              <ul className="max-h-96 overflow-y-auto">
                {notes?.notifications.map((n) => (
                  <li key={n.id}><Link href={n.link} className="block rounded px-2 py-2 hover:bg-surface-2"><div className={`text-[13px] ${n.read_at ? "text-ink-muted" : "font-medium"}`}>{n.title}</div><div className="line-clamp-2 text-[12px] text-ink-faint">{n.body}</div></Link></li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <PrefToggles />

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button type="button" className="flex items-center gap-2.5 rounded-md border border-line bg-surface-2 py-1 ps-1.5 pe-2.5 text-start hover:border-line-strong">
              <span className="grid size-7 place-items-center rounded bg-primary-soft text-accent"><UserRound className="size-4" /></span>
              <span className="hidden min-w-0 md:block">
                <span className="block max-w-[180px] truncate text-[12.5px] font-medium leading-tight">{s.principal.name}</span>
                <span className="block max-w-[180px] truncate text-[11px] leading-tight text-ink-muted">{ROLE_LABELS[s.principal.role]} · {s.institution.shortName}</span>
              </span>
              <ChevronDown className="size-3.5 text-ink-faint" />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={6} className="z-50 w-72 rounded-lg border border-line bg-surface p-1.5 shadow-xl">
              <div className="px-2.5 py-2">
                <div className="font-semibold">{s.principal.name}</div>
                <div className="text-[12px] text-ink-muted">{s.principal.title}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted"><Landmark className="size-3.5 text-accent" />{s.institution.name}</div>
                <div className="text-[11.5px] text-ink-faint">{s.institution.residency}</div>
              </div>
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <Dropdown.Label className="eyebrow px-2.5 py-1 text-ink-faint">{t("header.switchRole")}</Dropdown.Label>
              {s.roleSwitch.map((p) => (
                <Dropdown.Item key={p.id} className={menuItem} onSelect={() => p.id !== s.principal.id && switchTo(p.id)}>
                  <span className="grid size-4 place-items-center">{p.id === s.principal.id && <Check className="size-4 text-accent" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{ROLE_LABELS[p.role]}</span>
                    <span className="block truncate text-[11.5px] text-ink-muted">{p.name}</span>
                  </span>
                </Dropdown.Item>
              ))}
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <Dropdown.Item className={menuItem} onSelect={signOut}><Users className="size-4 text-ink-faint" />{t("header.switchInstitution")}</Dropdown.Item>
              <Dropdown.Item className={menuItem} onSelect={reset}>
                <RotateCcw className="size-4 text-warn" />
                <span className={armed ? "text-warn" : undefined}>{armed ? t("header.resetConfirm") : t("header.resetDemo")}</span>
              </Dropdown.Item>
              <Dropdown.Item className={menuItem} onSelect={signOut}><LogOut className="size-4 text-ink-faint" />{t("header.signOut")}</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}
