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
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const menuItem = "flex cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { t, lang, toggleLang } = usePrefs();
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
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 flex min-h-[64px] items-center gap-2.5 border-b border-line bg-bg px-4 py-2 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu /></Button>

      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button type="button" className="hidden min-h-[40px] items-center gap-2 rounded-md border border-line bg-surface px-3 text-start xl:flex">
            <Landmark className="size-4 text-primary" strokeWidth={1.6} />
            <span className="grid leading-tight"><span className="text-[10px] text-ink-muted">{t("header.institution")}</span><span className="max-w-[170px] truncate text-[13px]">{s.institution.shortName}</span></span>
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
          <label className="relative flex h-9 min-w-0 max-w-[320px] flex-1 items-center sm:min-w-[110px]">
            <Search className="pointer-events-none absolute start-3 size-4 text-ink-faint" />
            <input autoComplete="off"
              id="global-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQ(""); if (e.key === "Enter" && results[0]) { router.push(results[0].href); setQ(""); } }}
              placeholder={t("header.search")}
              aria-label={t("header.search")}
              className="h-9 w-full rounded-md border border-line bg-surface ps-9 pe-3 text-[13px] text-ink placeholder:text-ink-faint"
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

        <Link href="/decisions" className="btn hidden min-h-[40px] items-center gap-2 whitespace-nowrap rounded-md border border-[#e4cf9f] bg-warn-soft px-3 text-[13px] font-medium text-warn sm:inline-flex" aria-label={`${t("header.approvals")} (${pending ?? 0})`}>
          <span className="size-2 rounded-full bg-gold" aria-hidden /><span className="hidden xl:inline">{t("header.approvals")}</span> <span className="tabular">({pending ?? "–"})</span>
        </Link>

        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <button type="button" id="user-menu-trigger" aria-label={`${s.principal.name}, ${ROLE_LABELS[s.principal.role]}${notes?.unread ? `, ${notes.unread} unread notifications` : ""}`} className="relative grid size-10 place-items-center rounded-full border border-line bg-surface hover:border-line-strong">
              <UserRound className="size-[18px]" strokeWidth={1.6} />
              {notes?.unread ? <span aria-hidden className="absolute -end-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-crit px-1 text-[11px] font-medium leading-[18px] text-on-crit tabular">{notes.unread}</span> : null}
            </button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content align="end" sideOffset={6} className="z-50 max-h-[85vh] w-80 overflow-y-auto rounded-lg border border-line bg-surface p-1.5 shadow-[var(--overlay-shadow)]">
              <div className="px-2.5 py-2">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{s.principal.name}</span><Badge tone="gold" title={t("header.demo")}>{t("header.demo")}</Badge></div>
                <div className="text-[13px] text-ink-muted">{s.principal.title}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted"><Landmark className="size-3.5 text-accent" />{s.institution.name}</div>
                <div className="text-[13px] text-ink-faint">{s.institution.residency}</div>
              </div>
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <Dropdown.Label className="flex items-center justify-between px-2.5 py-1">
                <span className="eyebrow">{t("header.notifications")}{notes?.unread ? ` · ${notes.unread}` : ""}</span>
                {notes?.unread ? <button type="button" className="tap text-[12px] text-accent hover:underline" onClick={async () => { await api("/notifications/read", { json: {} }); setNotes((n) => n && { ...n, unread: 0, notifications: n.notifications.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) }); }}>Mark all read</button> : null}
              </Dropdown.Label>
              {!notes?.notifications.length && <p className="px-2.5 pb-1.5 text-[12.5px] text-ink-muted">{t("header.noNotifications")}</p>}
              {notes?.notifications.slice(0, 4).map((n) => (
                <Dropdown.Item key={n.id} asChild className={menuItem}>
                  <Link href={n.link} className="!items-start"><Bell className="mt-0.5 size-4 shrink-0 text-ink-faint" /><span className="min-w-0"><span className={`line-clamp-1 ${n.read_at ? "text-ink-muted" : "font-medium"}`}>{n.title}</span><span className="line-clamp-1 text-[12px] text-ink-faint">{n.body}</span></span></Link>
                </Dropdown.Item>
              ))}
              <Dropdown.Separator className="my-1 h-px bg-line" />
              <Dropdown.Item className={menuItem} onSelect={(e) => { e.preventDefault(); toggleLang(); }}>
                <Globe2 className="size-4 text-ink-faint" /><span className="flex-1">Language</span>
                <span className="text-[12.5px]"><span className={lang === "en" ? "font-bold" : "text-ink-muted"}>EN</span> | <span className={lang === "ar" ? "font-bold" : "text-ink-muted"} lang="ar">العربية</span></span>
              </Dropdown.Item>
              {lang === "ar" && <div className="px-2.5 pb-1"><Badge tone="info">{t("arabicDraft")}</Badge></div>}
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
    <label className="relative hidden min-h-[40px] items-center gap-2 rounded-md border border-line bg-surface px-3 sm:flex">
      <IndustryIcon industry={current} className="size-4 text-primary" />
      <span className="grid leading-tight">
        <span className="text-[10px] text-ink-muted">{t("header.sector")}</span>
        <select value={current} disabled={busy} onChange={(e) => change(e.target.value as IndustryKey)} aria-label={t("header.sector")} style={{ backgroundColor: "transparent" }}
          className="max-w-[130px] appearance-none truncate border-0 bg-transparent pe-5 text-[13px] text-ink disabled:opacity-60 xl:max-w-[190px]" title={ind ? (lang === "ar" ? ind.nameAr : ind.name) : undefined}>
          {INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{lang === "ar" ? i.nameAr : i.name}</option>)}
        </select>
      </span>
      <ChevronDown className="pointer-events-none absolute end-3 bottom-2.5 size-3.5 text-ink-faint" />
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
      <Badge tone={s.foreign_models_enabled ? "warn" : "ok"} title={`${s.foreign_models_enabled ? "Foreign models on" : "Foreign models off"} · ${local}`}>{s.foreign_models_enabled ? <Globe2 /> : <Lock />}<span>{s.foreign_models_enabled ? "Foreign on" : "Sovereign"}</span></Badge>
    </Link>
  );
}
