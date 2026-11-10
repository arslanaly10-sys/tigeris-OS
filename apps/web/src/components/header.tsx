"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { Bell, Check, Globe2, Lock, ChevronDown, Landmark, LogOut, Menu, RotateCcw, Search, UserRound, Users } from "lucide-react";
import { INDUSTRIES, ROLE_LABELS, type IndustryKey } from "@tigeris/shared";
import { sectorByIndustry } from "@/lib/command-centres";
import { IndustryIcon } from "./industry";
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

  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    const load = () => api<{ counts: { decisionsPending: number } }>("/attention").then((r) => r.ok && setPending(r.data.counts.decisionsPending));
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [s.principal.id]);

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex min-h-[72px] items-center gap-3 border-b border-line bg-bg px-4 py-2.5 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu /></Button>

      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button type="button" className="hidden min-h-[46px] items-center gap-2.5 rounded-md border border-line bg-surface px-3.5 text-start xl:flex">
            <Landmark className="size-[18px] text-primary" strokeWidth={1.6} />
            <span className="grid leading-tight"><span className="text-[10.5px] text-ink-muted">{t("header.institution")}</span><span className="max-w-[170px] truncate text-[13.5px]">{s.institution.shortName}</span></span>
            <ChevronDown className="size-3.5 text-ink-faint" />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content align="start" sideOffset={6} className="z-50 w-72 rounded-lg border border-line bg-surface p-1.5 shadow-[var(--overlay-shadow)]">
            <div className="px-2.5 py-2"><div className="font-medium">{s.institution.name}</div><div className="text-[13px] text-ink-faint">{s.institution.residency}</div></div>
            <Dropdown.Separator className="my-1 h-px bg-line" />
            <Dropdown.Item className={menuItem} onSelect={signOut}><Users className="size-4 text-ink-faint" />{t("header.switchInstitution")}</Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
      <SectorSelect />

      <Popover.Root open={results.length > 0}>
        <Popover.Anchor asChild>
          <label className="relative flex h-10 min-w-0 max-w-[340px] flex-1 items-center sm:min-w-[110px]">
            <Search className="pointer-events-none absolute start-3 size-4 text-ink-faint" />
            <input autoComplete="off"
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && results[0]) { router.push(results[0].href); setQ(""); } }}
              placeholder={t("header.search")}
              aria-label={t("header.search")}
              className="h-10 w-full rounded-md border border-line bg-surface ps-9 pe-3 text-[13px] text-ink placeholder:text-ink-faint"
            />
          </label>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} onOpenAutoFocus={(e) => e.preventDefault()} className="z-50 w-[min(420px,90vw)] rounded-lg border border-line bg-surface p-1.5 shadow-[var(--overlay-shadow)]">
            {results.slice(0, 12).map((r, i) => (
              <Link key={i} href={r.href} onClick={() => setQ("")} className="block rounded px-2.5 py-2 hover:bg-surface-2">
                <div className="line-clamp-1 text-[13px] font-medium">{r.title}</div>
                <div className="text-[13px] text-ink-muted">{r.sub}</div>
              </Link>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <div className="ms-auto flex items-center gap-2">
        <ModelBadge />
        <Badge tone="gold" className="hidden 2xl:inline-flex" title={t("header.demo")}>{t("header.demo")}</Badge>
        {lang === "ar" && <Badge tone="info" className="hidden md:inline-flex">{t("arabicDraft")}</Badge>}

        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={`${t("header.notifications")}${notes?.unread ? ` (${notes.unread} unread)` : ""}`}>
              <Bell />{notes?.unread ? <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-crit px-1 text-[13px] font-medium text-on-crit tabular">{notes.unread}</span> : null}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} className="z-50 w-80 rounded-lg border border-line bg-surface p-2 shadow-[var(--overlay-shadow)]">
              <div className="flex items-center justify-between px-2 py-1.5"><span className="font-medium">{t("header.notifications")}</span>
                {notes?.unread ? <button type="button" className="tap text-[13px] text-accent hover:underline" onClick={async () => { await api("/notifications/read", { json: {} }); setNotes((n) => n && { ...n, unread: 0, notifications: n.notifications.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) }); }}>Mark all read</button> : null}
              </div>
              {!notes?.notifications.length && <p className="px-2 pb-2 text-[13px] text-ink-muted">{t("header.noNotifications")}</p>}
              <ul className="max-h-96 overflow-y-auto">
                {notes?.notifications.map((n) => (
                  <li key={n.id}><Link href={n.link} className="block rounded px-2 py-2 hover:bg-surface-2"><div className={`text-[13px] ${n.read_at ? "text-ink-muted" : "font-medium"}`}>{n.title}</div><div className="line-clamp-2 text-[13px] text-ink-faint">{n.body}</div></Link></li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <PrefToggles />

        <Link href="/decisions" className="btn hidden min-h-[44px] items-center gap-2 whitespace-nowrap rounded-md border border-[#e4cf9f] bg-warn-soft px-4 text-[13.5px] font-medium text-warn sm:inline-flex" aria-label={`${t("header.approvals")} (${pending ?? 0})`}>
          <span className="size-2 rounded-full bg-gold" aria-hidden /><span className="hidden 2xl:inline">{t("header.approvals")}</span> <span className="tabular">({pending ?? "–"})</span>
        </Link>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button type="button" id="user-menu-trigger" aria-label={`${s.principal.name}, ${ROLE_LABELS[s.principal.role]}`} className="grid size-11 place-items-center rounded-full border border-line bg-surface hover:border-line-strong">
              <UserRound className="size-[18px]" strokeWidth={1.6} />
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={6} className="z-50 w-72 rounded-lg border border-line bg-surface p-1.5 shadow-[var(--overlay-shadow)]">
              <div className="px-2.5 py-2">
                <div className="font-medium">{s.principal.name}</div>
                <div className="text-[13px] text-ink-muted">{s.principal.title}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted"><Landmark className="size-3.5 text-accent" />{s.institution.name}</div>
                <div className="text-[13px] text-ink-faint">{s.institution.residency}</div>
              </div>
              <Dropdown.Separator className="my-1 h-px bg-line" />
              {s.roleSwitch.length > 0 && <>
              <Dropdown.Label className="eyebrow px-2.5 py-1">{t("header.switchRole")}</Dropdown.Label>
              {s.roleSwitch.map((p) => (
                <Dropdown.Item key={p.id} className={menuItem} onSelect={() => p.id !== s.principal.id && switchTo(p.id)}>
                  <span className="grid size-4 place-items-center">{p.id === s.principal.id && <Check className="size-4 text-accent" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{ROLE_LABELS[p.role]}</span>
                    <span className="block truncate text-[13px] text-ink-muted">{p.name}</span>
                  </span>
                </Dropdown.Item>
              ))}
              </>}
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <Dropdown.Item className={menuItem} onSelect={signOut}><Users className="size-4 text-ink-faint" />{t("header.switchInstitution")}</Dropdown.Item>
              {s.canReset && (
                <Dropdown.Item className={menuItem} onSelect={reset}>
                  <RotateCcw className="size-4 text-warn" />
                  <span className={armed ? "text-warn" : undefined}>{armed ? t("header.resetConfirm") : t("header.resetDemo")}</span>
                </Dropdown.Item>
              )}
              <Dropdown.Item className={menuItem} onSelect={signOut}><LogOut className="size-4 text-ink-faint" />{t("header.signOut")}</Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
    </header>
  );
}

/** Sector select (the industry lens, audited). On a Command Centre page it also opens that sector's centre. */
function SectorSelect() {
  const s = useSession();
  const { t, lang } = usePrefs();
  const router = useRouter();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const current = s.principal.industry;
  const ind = INDUSTRIES.find((i) => i.key === current);
  async function change(next: IndustryKey) {
    if (next === current) return;
    setBusy(true);
    const r = await api("/auth/industry", { json: { industry: next } });
    setBusy(false);
    if (!r.ok) return;
    const sec = sectorByIndustry(next);
    if (path.startsWith("/command-centres") && sec) router.push(`/command-centres/${sec.key}`);
    router.refresh();
  }
  return (
    <label className="relative hidden min-h-[46px] items-center gap-2.5 rounded-md border border-line bg-surface px-3.5 sm:flex">
      <IndustryIcon industry={current} className="size-[18px] text-primary" />
      <span className="grid leading-tight">
        <span className="text-[10.5px] text-ink-muted">{t("header.sector")}</span>
        <select value={current} disabled={busy} onChange={(e) => change(e.target.value as IndustryKey)} aria-label={t("header.sector")} style={{ backgroundColor: "transparent" }}
          className="max-w-[130px] appearance-none truncate border-0 bg-transparent pe-5 text-[13.5px] text-ink disabled:opacity-60 xl:max-w-[190px]" title={ind ? (lang === "ar" ? ind.nameAr : ind.name) : undefined}>
          {INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{lang === "ar" ? i.nameAr : i.name}</option>)}
        </select>
      </span>
      <ChevronDown className="pointer-events-none absolute end-3 bottom-3 size-3.5 text-ink-faint" />
    </label>
  );
}

/** Always-visible state of the foreign-model switch (Q063). Links to the controls. */
function ModelBadge() {
  const [s, setS] = useState<{ foreign_models_enabled: boolean; default_provider: string } | null>(null);
  useEffect(() => {
    const load = () => api<{ settings: { foreign_models_enabled: boolean; default_provider: string } }>("/ai/status").then((r) => r.ok && setS(r.data.settings));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);
  if (!s) return null;
  const local = s.default_provider === "local" ? "local model" : s.default_provider === "deterministic" ? "no model" : s.default_provider;
  return (
    <Link href="/governance#ai" className="tap hidden items-center md:inline-flex" title="Model sovereignty controls">
      <Badge tone={s.foreign_models_enabled ? "warn" : "ok"}>{s.foreign_models_enabled ? <Globe2 /> : <Lock />}<span className="hidden 2xl:inline">{s.foreign_models_enabled ? "Foreign models on" : "Foreign models off"} · </span>{s.foreign_models_enabled ? <span className="2xl:hidden">Foreign on</span> : null}<span className={s.foreign_models_enabled ? "hidden 2xl:inline" : "hidden lg:inline"}>{local}</span></Badge>
    </Link>
  );
}
