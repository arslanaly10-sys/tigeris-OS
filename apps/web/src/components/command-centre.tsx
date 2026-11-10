"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { icons, type LucideProps } from "lucide-react";
import "./command-centre.css";
import { sectorByIndustry, sectorByKey, type Block, type Item, type Pill, type Sector } from "@/lib/command-centres";
import { CC_AR } from "@/lib/command-centres-ar";
import { api } from "@/lib/api";
import { usePrefs } from "./prefs";
import { useSession } from "./session-context";

/**
 * Sector Command Centres inside the OS (Command Centres brief, phase 2). The mockup layout is kept; what changed:
 * - a live strip of this institution's cases and signals for the sector (row counts, each a link to its list);
 * - real cases surface in Priority Intelligence and Expert Review, real decision counts in Mandate status;
 * - every action routes to the OS module that does it, and any suggested case can be opened (audited) from its card;
 * - all copy has an Arabic draft and follows the OS language and direction.
 * Sector figures that need authorised sources stay "—" with "Source not connected". No action executes here.
 */
const ALIAS: Record<string, string> = { "triangle-alert": "TriangleExclamationPoint", "building-2": "BuildingComplex", waves: "WavesHorizontal" };
const pascal = (k: string) => ALIAS[k] ?? k.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
function Ic({ n, ...p }: { n?: string } & LucideProps) {
  if (!n) return null;
  const C = icons[pascal(n) as keyof typeof icons];
  return C ? <C aria-hidden strokeWidth={1.6} {...p} /> : null;
}

// ---------- Context: translation, sector data, actions ----------
interface SectorCase { case_key: string; title: string; objective?: string; state: string; owner_label: string; last_activity_at: string }
interface SectorSignal { id: string; title: string; urgency: string; data_mode: string; status: string; why_surfaced: string; detected_at: string }
interface SectorData {
  cases: SectorCase[]; review: SectorCase[]; signals: SectorSignal[];
  counts: { openCases: number; inReview: number; awaitingDecision: number; approved: number; closed: number; newSignals: number; signals: number };
  lastUpdated: string | null;
}
type Kind = "case" | "scenario" | "approval" | "specialist" | "data" | "map" | "signals";
type Ask = { title: string; desc?: string; kind: Kind; card: string };
interface Ctx { tr: (s: string) => string; ask: (a: Ask) => void; go: (k: Kind) => void; data: SectorData | null; sector: Sector }
const C = createContext<Ctx | null>(null);
const useCC = () => useContext(C)!;

/** Where each kind of card leads in the OS. */
const ROUTES: Record<Kind, string> = { case: "/cases", scenario: "/scenarios", approval: "/decisions", specialist: "/playbooks", data: "/sources", map: "/map", signals: "/signals" };
function kindOf(title = "", type?: Block["type"]): Kind {
  if (/Specialist/i.test(title)) return "specialist";
  if (/Mandate|Decision|Approval/i.test(title)) return "approval";
  if (/Scenario|Commodity/i.test(title)) return "scenario";
  if (/Intelligence Cases|Review Queue|Intelligence Areas|Risk & Exposure Areas/i.test(title)) return "case";
  if (type === "map" || /Map|Network|Route/i.test(title)) return "map";
  return "data";
}

// ---------- Dialog ----------
const BODY: Record<Kind, string> = {
  case: "Opens a case in Intelligence Cases, in this sector, owned by you. It starts at \"detected\" and needs evidence before any analysis or decision. Nothing executes.",
  scenario: "Scenarios run in the OS with every input and assumption shown before any result.",
  approval: "Decisions need a named approver with the required authority. Nothing executes from this screen.",
  specialist: "Specialists work inside cases and playbooks; they read evidence and cite it, and they never act.",
  data: "This figure needs an authorised institutional source. Connect one in Data & Sources; until then it stays empty.",
  map: "The map is illustrative. The Movement Map shows ships, assets and events with their sources.",
  signals: "Open Signals",
};
const OPEN: Record<Kind, string> = {
  case: "Open Intelligence Cases", scenario: "Open Scenarios & Foresight", approval: "Open Decision Authority", specialist: "Open Playbooks",
  data: "Open Data & Sources", map: "Open Movement Map", signals: "Open Signals",
};

function Dialog({ a, onClose }: { a: Ask; onClose: () => void }) {
  const { tr, go, sector } = useCC();
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const canStart = a.kind === "case" || a.kind === "scenario" || a.kind === "approval";
  async function start() {
    setBusy(true); setErr(null);
    const r = await api<{ caseKey: string }>(`/sectors/${sector.industry}/cases`, { json: { title: a.title, objective: a.desc, card: a.card } });
    setBusy(false);
    if (r.ok) router.push(`/cases/${r.data.caseKey}`);
    else setErr(tr(r.status === 403 ? "Your role cannot open cases." : "Could not open the case."));
  }
  return (
    <div className="cc-scrim" onClick={onClose}>
      <div className="cc-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-dlg-t" onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">{tr(a.card)}</span>
        <h2 id="cc-dlg-t">{tr(a.title)}</h2>
        {a.desc && <p className="cc-dlg-desc">{tr(a.desc)}</p>}
        <p>{tr(a.kind === "case" ? BODY.case : BODY[a.kind])}</p>
        {canStart && a.kind !== "case" && <p>{tr(BODY.case)}</p>}
        {err && <p role="alert" className="cc-err">{err}</p>}
        <footer>
          <button type="button" className="cc-btn small" onClick={onClose}>{tr("Close")}</button>
          {a.kind === "scenario" && (sector.industry === "energy" || sector.industry === "supply_chain") && <button type="button" className="cc-btn small" onClick={() => router.push("/simulator")}>{tr("Open Shock Simulator")}</button>}
          {a.kind === "approval" && <button type="button" className="cc-btn small" onClick={() => router.push("/governor")}>{tr("Open Governor Question")}</button>}
          <button ref={canStart ? undefined : ref} type="button" className={`cc-btn small${canStart ? "" : " solid"}`} onClick={() => go(a.kind)}>{tr(OPEN[a.kind])}</button>
          {canStart && <button ref={ref} type="button" className="cc-btn small solid" disabled={busy} onClick={start}>{tr(busy ? "Opening…" : "Start a case")}</button>}
        </footer>
      </div>
    </div>
  );
}

// ---------- Small parts ----------
function PillTag({ p }: { p: Pill }) {
  const { tr } = useCC();
  if (typeof p === "object") return <span className="cc-pill neutral">{tr(p.text)}</span>;
  if (p === "approval") return <span className="cc-pill approval"><span className="cc-dot" />{tr("Approval required")}</span>;
  const text = { awaiting: "Awaiting data", high: "High", medium: "Medium", low: "Low" }[p];
  return <span className={`cc-pill ${p}`}>{tr(text)}</span>;
}
const NA = () => <span className="cc-na">{useCC().tr("Source not connected")}</span>;
const Chev = () => <Ic n="chevron-right" className="cc-chev" />;

function Head({ b }: { b: Block }) {
  const { tr, ask, go } = useCC();
  const m = b.type === "map" ? b : null;
  const chipRight = b.span >= 4 && (b.title?.length ?? 0) <= 20 && !b.subtitle;
  const chip = b.chip && !(b.type === "chart" && b.tabs);
  const kind = kindOf(b.title, b.type);
  return (
    <div className="cc-card-h">
      <Ic n={b.icon} />
      <div className="cc-card-t">
        {b.title && <h2>{tr(b.title)}</h2>}
        {b.subtitle && <p className="cc-card-sub">{tr(b.subtitle)}</p>}
        {chip && !chipRight && <p className="cc-card-sub">{tr("Source not connected")}</p>}
      </div>
      <div className="cc-card-a">
        {m && !m.dark && m.segmented && <Seg opts={m.segmented} label={b.title!} />}
        {m?.dropdown?.map((d, i) => <Drop key={i} label={d.label} opts={d.options} />)}
        {m?.button && <button type="button" className="cc-btn small" onClick={() => go("map")}>{tr(m.button)}<Chev /></button>}
        {m?.expand && <button type="button" className="cc-sq" aria-label={`Expand ${b.title}`} onClick={() => ask({ title: b.title!, kind: "map", card: b.title! })}><Ic n="maximize-2" /></button>}
        {chip && chipRight && <span className="cc-chip">{tr("Source not connected")}</span>}
        {b.link && <button type="button" className="cc-link" onClick={() => go(kind)}>{tr(b.link)}<Ic n="arrow-right" /></button>}
        {b.more && <button type="button" className="cc-more" aria-label={`More options for ${b.title}`} onClick={() => ask({ title: b.title!, kind, card: b.title! })}><Ic n="ellipsis" /></button>}
      </div>
    </div>
  );
}

function Seg({ opts, label }: { opts: string[]; label: string }) {
  const { tr } = useCC();
  const [v, setV] = useState(0);
  return <div className="cc-seg" role="group" aria-label={`${tr(label)}`}>{opts.map((o, i) => <button key={o} type="button" aria-pressed={v === i} onClick={() => setV(i)}>{tr(o)}</button>)}</div>;
}
function Drop({ label, opts }: { label?: string; opts: string[] }) {
  const { tr } = useCC();
  const [v, setV] = useState(0);
  return (
    <label className="cc-drop">{label && tr(label)}
      <span className="cc-drop-box"><select value={v} onChange={(e) => setV(Number(e.target.value))} aria-label={label ? tr(label) : tr(opts[0]!)}>{opts.map((o, i) => <option key={o} value={i}>{tr(o)}</option>)}</select><Ic n="chevron-down" /></span>
    </label>
  );
}
function Tabs({ opts }: { opts: string[] }) {
  const { tr } = useCC();
  const [v, setV] = useState(0);
  return <div className="cc-tabs" role="tablist">{opts.map((o, i) => <button key={o} role="tab" type="button" aria-selected={v === i} onClick={() => setV(i)}>{tr(o)}</button>)}</div>;
}
function Filters({ opts }: { opts: string[] }) {
  const { tr } = useCC();
  const [v, setV] = useState(0);
  return <div className="cc-filters">{opts.map((o, i) => <button key={o} type="button" aria-pressed={v === i} onClick={() => setV(i)}>{tr(o)}</button>)}</div>;
}

/** A case that exists in this institution, shown in a mockup list. Links straight to the case. */
function CaseRow({ c, boxed }: { c: SectorCase; boxed: boolean }) {
  const { tr } = useCC();
  return (
    <Link href={`/cases/${c.case_key}`} className="cc-item cc-real">
      {boxed ? <span className="cc-ib"><Ic n="folder-open" /></span> : <Ic n="folder-open" />}
      <span><b>{c.title}</b><p>{tr("Case in this institution")} · {c.case_key}</p></span>
      <span className="cc-end"><span className="cc-pill neutral">{tr(c.state)}</span><Chev /></span>
    </Link>
  );
}

function Row({ it, card, boxed, narrow }: { it: Item; card: string; boxed: boolean; narrow?: boolean }) {
  const { tr, ask } = useCC();
  const kind: Kind = it.button || /scenario/i.test(it.title) ? "scenario" : it.pill === "approval" ? "approval" : kindOf(card);
  return (
    <button type="button" className={`cc-item${it.icon || it.dot ? "" : " noicon"}`} onClick={() => ask({ title: it.title, desc: it.desc, kind, card })}>
      {it.dot ? <span className={`cc-sdot ${it.dot}`} aria-hidden /> : it.icon === "square" ? <span className="cc-check" aria-hidden /> : it.icon ? (boxed ? <span className="cc-ib"><Ic n={it.icon} /></span> : <Ic n={it.icon} />) : null}
      <span><b>{tr(it.title)}</b>{it.desc && <p>{tr(it.desc)}</p>}{narrow && it.pill && <span style={{ display: "block", marginTop: 4 }}><PillTag p={it.pill} /></span>}</span>
      <span className="cc-end">{!narrow && it.pill && <PillTag p={it.pill} />}{it.button ? <span className="cc-btn small solid"><Ic n="chart-no-axes-column" />{tr(it.button)}</span> : <Chev />}</span>
    </button>
  );
}

function Chart({ b }: { b: Extract<Block, { type: "chart" }> }) {
  const { tr, go } = useCC();
  const ticks = b.yTicks ?? ["", "", "", "", ""];
  return (
    <>
      {b.tabs && <Tabs opts={b.tabs} />}
      {b.dropdown && <div><Drop opts={b.dropdown} /></div>}
      {b.y && b.tabs && <div className="cc-meta" style={{ justifyContent: "space-between" }}><span>{tr(b.y)}</span><NA /></div>}
      <div className="cc-chart">
        <span className="cc-ylab">{b.tabs || !b.y ? "" : tr(b.y)}</span>
        <div className="cc-yt" aria-hidden>{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
        <div className="cc-plot">
          {ticks.map((_, i) => <i key={i} />)}
          <div className="cc-empty">
            <Ic n="chart-no-axes-column" />
            <b>{tr(b.empty[0])}</b>
            {b.empty[1] && <p>{tr(b.empty[1])}</p>}
            {b.button && <button type="button" className={`cc-btn${b.button.length > 14 ? " solid" : ""}`} onClick={() => go("data")}>{b.button.length > 14 && <Ic n="link" />}{tr(b.button)}</button>}
          </div>
        </div>
        {b.x.length > 0 && <div className="cc-xt" aria-hidden>{b.x.map((x) => <span key={x}>{tr(x)}</span>)}</div>}
      </div>
      {b.tabs && !b.y && <NA />}
    </>
  );
}

function Body({ b, narrow }: { b: Block; narrow?: boolean }) {
  const { tr, ask, go, data } = useCC();
  const card = b.title ?? "";
  switch (b.type) {
    case "kpis":
      return <div className="cc-kpis">{b.items.map((k) => <button type="button" key={k.title} className="cc-kpi" onClick={() => ask({ title: k.title, kind: "data", card: k.title })}><Ic n={k.icon} /><b>{tr(k.title)}</b><span className="cc-dash">—</span><NA /></button>)}</div>;
    case "glance":
      return <div className="cc-glance">{b.items.map((k) => <button type="button" key={k.title} className="cc-cell" onClick={() => ask({ title: k.title, kind: kindOf(card) === "case" ? "case" : "data", card })}><Ic n={k.icon} /><b>{tr(k.title)}</b><span className="cc-dash">—</span><NA />{b.chip && <Chev />}</button>)}</div>;
    case "rows":
      return <div className="cc-rowsm">{b.items.map((k) => <button type="button" key={k.title} onClick={() => ask({ title: k.title, kind: "data", card })}><Ic n={k.icon} /><span>{tr(k.title)}</span><span className="r"><span className="cc-dash">—</span><NA /></span></button>)}</div>;
    case "map": {
      const side = b.legend ? "left" : b.sideList ? "right" : "";
      return (
        <>
          {b.dark && b.segmented && <div><Seg opts={b.segmented} label={b.title!} /></div>}
          <div className={`cc-map ${side}`}>
            {b.legend && <div className="cc-legend" aria-label="Legend">{b.legend.map((l, i) => <div key={l.title} className={i === 0 && l.title.startsWith("All") ? "on" : ""}><Ic n={l.icon} />{tr(l.title)}</div>)}</div>}
            <button type="button" className="cc-map-img" onClick={() => ask({ title: b.title!, kind: "map", card: b.title! })} aria-label={`${tr(b.alt)}. ${tr("Open Movement Map")}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.img} alt={`${tr(b.alt)}. Illustrative, not live data.`} width={1000} height={Math.round(1000 / b.ratio)} loading="lazy" />
            </button>
            {b.sideList && <div className="cc-sidelist">{b.sideList.map((l) => <button key={l.title} type="button" onClick={() => ask({ title: l.title, kind: "data", card })}><Ic n={l.icon} /><span>{tr(l.title)}</span><small>— | {tr("Source not connected")}</small></button>)}</div>}
          </div>
          {b.chips && <div className="cc-chips">{b.chips.map((c) => <span key={c.title}>{c.dot ? <span className={`cc-sdot ${c.dot}`} /> : c.icon ? <Ic n={c.icon} /> : <span className="cc-sdot" style={{ border: "1.5px solid var(--cc-muted)" }} />}{tr(c.title)}</span>)}</div>}
        </>
      );
    }
    case "chart":
      return <Chart b={b} />;
    case "list": {
      const boxed = b.items.some((i) => i.icon && i.desc) && b.span >= 4 && !b.items.some((i) => i.pill === "high");
      const real = /Priority Intelligence Cases/.test(card) ? data?.cases.filter((c) => !["review", "decision"].includes(c.state)).slice(0, 2) ?? []
        : /Expert Review Queue/.test(card) ? data?.review.slice(0, 2) ?? [] : [];
      return (
        <>
          {b.dropdown && <Drop opts={[b.dropdown, ...b.items.map((i) => i.title)]} />}
          <div className="cc-list">
            {real.map((c) => <CaseRow key={c.case_key} c={c} boxed={boxed} />)}
            {b.items.map((it) => <Row key={it.title} it={it} card={card} boxed={boxed} narrow={narrow} />)}
          </div>
          {b.footerButton && <button type="button" className="cc-btn solid" onClick={() => go("scenario")}>{tr(b.footerButton)}</button>}
        </>
      );
    }
    case "tiles": {
      const narrowTiles = b.span <= 4;
      const kind = kindOf(card) === "case" ? "case" : "scenario";
      return (
        <div className={`cc-tiles${narrowTiles ? " narrow" : b.items.length > 3 ? " icons" : ""}`} style={{ ["--n" as string]: b.items.length }}>
          {b.items.map((t) => (
            <button key={t.title} type="button" className="cc-tile" onClick={() => ask({ title: t.title, desc: t.desc, kind, card })}>
              <Ic n={t.icon} />{narrowTiles || b.items.length > 3 ? <><Chev /><div><b>{tr(t.title)}</b><p>{t.desc && tr(t.desc)}</p></div></> : <><div><b>{tr(t.title)}</b><p>{t.desc && tr(t.desc)}</p></div><Chev /></>}
            </button>
          ))}
        </div>
      );
    }
    case "table": {
      const real = /Expert Review/.test(card) ? data?.review ?? [] : [];
      return (
        <div className="cc-scroll">
          <table className="cc-table">
            <thead><tr>{b.columns.map((c) => <th key={c} scope="col">{tr(c)}</th>)}</tr></thead>
            <tbody>
              {b.rows?.length ? b.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 1 ? "m" : ""}>{c === "Awaiting data" ? <PillTag p="awaiting" /> : tr(c)}</td>)}</tr>)
                : real.length ? real.map((c) => (
                  <tr key={c.case_key}>{b.columns.map((col, i) => <td key={col} className={i === 0 ? "" : "m"}>
                    {i === 0 ? <Link className="cc-tlink" href={`/cases/${c.case_key}`}>{c.title}</Link> : i === b.columns.length - 1 ? <span className="cc-pill neutral">{tr(c.state)}</span> : i === 1 ? c.case_key : c.owner_label}
                  </td>)}</tr>))
                : b.chip ? <tr><td colSpan={b.columns.length}><div className="cc-empty cc-static"><Ic n="file-text" /><b>{tr("No items to display")}</b><p>{tr("Authorised data is required to populate the expert review queue.")}</p><button type="button" className="cc-btn solid" onClick={() => go("data")}><Ic n="link" />{tr("Connect authorised data")}</button></div></td></tr>
                : <tr>{b.columns.map((c, i) => <td key={c}>{i === b.columns.length - 1 ? <span className="cc-pill awaiting">{tr("Awaiting input")}</span> : <span className="cc-skel" aria-label="No value" />}</td>)}</tr>}
            </tbody>
          </table>
        </div>
      );
    }
    case "empty": {
      const decisions = /Mandate|Decision/.test(card) ? data?.review.filter((c) => c.state === "decision") ?? [] : [];
      return (
        <>
          {b.tabs && <Tabs opts={b.tabs} />}
          {b.filters && <Filters opts={b.filters} />}
          {decisions.length ? <div className="cc-list">{decisions.map((c) => <CaseRow key={c.case_key} c={c} boxed={false} />)}</div>
            : !b.empty && !b.button ? <button type="button" className="cc-skelrow" onClick={() => ask({ title: card, kind: "approval", card })}><span className="cc-skel" aria-label="No item" /><PillTag p="approval" /><Chev /></button>
            : <div className="cc-empty cc-static">
              <Ic n="file-text" />
              <b>{tr(b.empty?.[0] ?? "No items to show")}</b>
              <p>{tr(b.empty?.[1] ?? "Authorised data is required to display mandate checks and decisions.")}</p>
              {b.button && <button type="button" className="cc-btn solid" onClick={() => go("data")}><Ic n="link" />{tr(b.button)}</button>}
            </div>}
        </>
      );
    }
    case "align":
      return (
        <>
          <div className="cc-align">{b.items.map((a) => <div key={a.title}><Ic n={a.icon} /><span>{tr(a.title)}</span><span className="cc-track" aria-hidden /><span aria-label="No value">—</span></div>)}</div>
          {b.pillButton && <div><button type="button" className="cc-btn round small" onClick={() => go("approval")}>{tr(b.pillButton)}<Ic n="arrow-right" className="cc-arrow" /></button></div>}
        </>
      );
    case "kv":
      return <div className="cc-kv">{b.items.map((k) => <button type="button" key={k.label} onClick={() => go("data")}><Ic n={k.icon} /><span>{tr(k.label)}</span><span>{tr(k.value)}</span></button>)}</div>;
    case "actions":
      return <div className="cc-acts">{b.items.map((a) => <div key={a.title}><Ic n={a.icon} /><span><b>{tr(a.title)}</b><p>{a.desc && tr(a.desc)}</p></span><button type="button" className="cc-btn small" onClick={() => ask({ title: a.title, desc: a.desc, kind: "approval", card })}>{a.button && tr(a.button)}</button></div>)}</div>;
    case "status": {
      // Real case counts for this sector: decision = awaiting approval, review = in review, handoff = approved.
      const n: Record<string, number | undefined> = { "Items requiring approval": data?.counts.awaitingDecision, "In review": data?.counts.inReview, Approved: data?.counts.approved };
      return (
        <div className="cc-status">
          {b.items.map((k) => (
            <Link key={k.title} href="/cases" className="cc-cell">
              <Ic n={k.icon} /><b>{tr(k.title)}</b>
              {n[k.title] !== undefined ? <><span className="cc-dash tabular">{n[k.title]}</span><span className="cc-na">{tr("Cases in this sector")}</span></> : <><span className="cc-dash">—</span><NA /></>}
            </Link>
          ))}
          {b.button && <button type="button" className="cc-btn" style={{ alignSelf: "center" }} onClick={() => go("approval")}>{tr(b.button)}<Ic n="arrow-right" className="cc-arrow" /></button>}
        </div>
      );
    }
    case "pair":
      return null;
  }
}

function Card({ b, narrow }: { b: Block; narrow?: boolean }) {
  const { tr } = useCC();
  if (b.type === "kpis") return <section aria-label="Key measures"><Body b={b} /></section>;
  if (b.type === "pair") return <div className="cc-pair">{b.blocks.map((x, i) => <Card key={i} b={x} narrow />)}</div>;
  return <section className={`cc-card${b.type === "map" && b.dark ? " dark" : ""}`} aria-label={b.title && tr(b.title)}>{(b.title || b.icon) && <Head b={b} />}<Body b={b} narrow={narrow} /></section>;
}

/** The live strip: this institution's records for the sector, as row counts that each open their list. */
function LiveStrip() {
  const { tr, data, lang } = { ...useCC(), lang: usePrefs().lang };
  if (!data) return <section className="cc-card cc-live" aria-busy="true"><p className="cc-na">…</p></section>;
  const tiles = [
    { label: "Open cases", n: data.counts.openCases, href: "/cases", icon: "folder-open" },
    { label: "New signals", n: data.counts.newSignals, href: "/signals", icon: "radio-tower" },
    { label: "In review", n: data.counts.inReview, href: "/cases", icon: "users" },
    { label: "Awaiting decision", n: data.counts.awaitingDecision, href: "/decisions", icon: "badge-check" },
  ];
  const fmt = (d: string) => new Date(d).toLocaleDateString(lang === "ar" ? "ar" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className="cc-card cc-live" aria-label={tr("In this institution")}>
      <div className="cc-card-h">
        <Ic n="activity" />
        <div className="cc-card-t"><h2>{tr("In this institution")}</h2><p className="cc-card-sub">{tr("Counts are rows in this institution's records; each opens the list behind it.")}</p></div>
        {data.lastUpdated && <span className="cc-chip">{tr("Last activity")}: {fmt(data.lastUpdated)}</span>}
      </div>
      <div className="cc-live-grid">
        <div className="cc-live-tiles">
          {tiles.map((t) => <Link key={t.label} href={t.href} className="cc-kpi"><Ic n={t.icon} /><b>{tr(t.label)}</b><span className="cc-dash tabular">{t.n}</span></Link>)}
        </div>
        <div className="cc-live-sig">
          <div className="cc-live-sig-h"><b>{tr("Latest signals")}</b><Link href="/signals" className="cc-link">{tr("View all")}<Ic n="arrow-right" /></Link></div>
          {data.signals.length === 0 ? <p className="cc-na">{tr("No signals in this sector.")}</p> : data.signals.slice(0, 3).map((s) => (
            <Link key={s.id} href={`/signals?focus=${s.id}`} className="cc-sig">
              <span className={`cc-pill ${s.urgency === "critical" || s.urgency === "high" ? "high" : s.urgency === "medium" ? "medium" : "low"}`}>{tr(s.urgency)}</span>
              <span className="cc-sig-t">{s.title}</span>
              <span className="cc-pill neutral">{tr(s.data_mode)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CommandCentre({ sectorKey }: { sectorKey: string }) {
  const s = sectorByKey(sectorKey)!;
  const router = useRouter();
  const session = useSession();
  const { lang } = usePrefs();
  const tr = useCallback((x: string) => (lang === "ar" ? CC_AR[x] ?? x : x), [lang]);
  const [a, setAsk] = useState<Ask | null>(null);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<SectorData | null>(null);

  // Hash routes (#energy, #banking, ...) resolve to the sector's route.
  useEffect(() => {
    const goHash = () => { const h = window.location.hash.slice(1); if (h && h !== sectorKey && sectorByKey(h)) router.replace(`/command-centres/${h}`); };
    goHash();
    window.addEventListener("hashchange", goHash);
    return () => window.removeEventListener("hashchange", goHash);
  }, [router, sectorKey]);

  // The OS sector lens follows the Command Centre being viewed (an audited lens change, permissions unchanged).
  useEffect(() => {
    if (session.principal.industry !== s.industry) api("/auth/industry", { json: { industry: s.industry } }).then((r) => r.ok && router.refresh());
  }, [s.industry, session.principal.industry, router]);

  useEffect(() => {
    let live = true;
    setData(null);
    api<SectorData>(`/sectors/${s.industry}`).then((r) => live && r.ok && setData(r.data));
    return () => { live = false; };
  }, [s.industry]);

  const go = useCallback((k: Kind) => router.push(ROUTES[k]), [router]);
  const ctx: Ctx = { tr, ask: setAsk, go, data, sector: s };

  return (
    <C.Provider value={ctx}>
      <div className="cc">
        <div className="cc-content">
          <div className="cc-head">
            <div className="cc-head-l">
              {s.eyebrow && <p className={`cc-eyebrow${s.eyebrowCaps ? "" : " plain"}`}>{tr(s.eyebrow)}</p>}
              <h1>{tr(s.title)}{s.badge && s.right.hero && <> <span className="cc-badge" style={{ verticalAlign: "middle" }}>{tr("Proposed interface")}</span></>}</h1>
              <p className="cc-sub">{tr(s.subtitle)}</p>
            </div>
            {(s.right.hero || s.right.meta || s.badge) && !s.right.metaTabs && (
              <div className="cc-head-r">
                {((s.badge && !s.right.hero) || s.right.meta) && <div className="cc-meta">{s.badge && !s.right.hero && <span className="cc-badge">{tr("Proposed interface")}</span>}{s.right.meta && <span>{tr(s.right.meta)}</span>}</div>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.right.hero && <img className="cc-hero" src={s.right.hero} alt={`${tr(s.right.heroAlt ?? "")}. Illustrative.`} width={520} height={130} />}
              </div>
            )}
          </div>
          {s.right.metaTabs && (
            <div className="cc-metatabs">
              <div className="cc-meta"><span>{tr("Last updated: —")}</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Ic n="circle" width={9} height={9} />{tr("Source not connected")}</span></div>
              <div className="cc-strip">{s.right.metaTabs.map((t) => <button key={t.title} type="button" onClick={() => setAsk({ title: t.title, kind: t.title === "Shipments" || t.title === "Air Cargo" ? "map" : "data", card: s.label })}><Ic n={t.icon} />{tr(t.title)}</button>)}</div>
            </div>
          )}
          {s.pageTabs && <div className="cc-pagetabs" role="tablist">{s.pageTabs.map((t, i) => <button key={t} type="button" role="tab" aria-selected={tab === i} onClick={() => (i === 0 ? setTab(0) : setAsk({ title: t, kind: "data", card: s.label }))}>{tr(t)}</button>)}</div>}

          <LiveStrip />

          {s.rows.map((row, ri) => (
            <div key={ri} className="cc-grid">
              {row.map((b, bi) => (
                <div key={bi} className={`cc-col${b.span >= 7 ? " wide" : ""}`} style={{ gridColumn: `span ${b.span}` }}>
                  <Card b={b} />
                  {b.stack && <Card b={b.stack} />}
                </div>
              ))}
            </div>
          ))}

          <footer className="cc-foot"><div>{s.footer.map((f) => <span key={f}>{tr(f)}</span>)}</div><span>{tr(s.footerRight)}</span></footer>
        </div>
        {a && <Dialog a={a} onClose={() => setAsk(null)} />}
      </div>
    </C.Provider>
  );
}

/** /command-centres: the hash (#energy) wins, then the person's sector lens, then supply chain. */
export function CommandCentreIndex() {
  const router = useRouter();
  const s = useSession();
  useEffect(() => {
    const h = window.location.hash.slice(1);
    router.replace(`/command-centres/${sectorByKey(h) ? h : sectorByIndustry(s.principal.industry)?.key ?? "supply-chain"}`);
  }, [router, s.principal.industry]);
  return null;
}
