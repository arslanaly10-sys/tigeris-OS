"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { icons, type LucideProps } from "lucide-react";
import "@fontsource/libre-caslon-text/400.css";
import "@fontsource/libre-caslon-text/700.css";
import "@fontsource-variable/inter";
import "./command-centre.css";
import { INSTITUTIONS, NAV, SECTORS, sectorByKey, type Block, type Item, type Pill } from "@/lib/command-centres";

/**
 * Sector Command Centres (Command Centres brief): one shell and a renderer per block type, driven by
 * lib/command-centres.ts. Nothing here shows a number: metrics are "—", charts are empty states, and every button
 * opens a dialog that says what is needed. No action executes from these screens.
 */
const ALIAS: Record<string, string> = { "triangle-alert": "TriangleExclamationPoint", "building-2": "BuildingComplex", waves: "WavesHorizontal" };
const pascal = (k: string) => ALIAS[k] ?? k.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
function Ic({ n, ...p }: { n?: string } & LucideProps) {
  if (!n) return null;
  const C = icons[pascal(n) as keyof typeof icons];
  return C ? <C aria-hidden strokeWidth={1.6} {...p} /> : null;
}

type Ask = { title: string; kind?: "data" | "pilot" | "approval" | "scenario" | "info"; count?: number };
const Ctx = createContext<(a: Ask) => void>(() => {});
const useAsk = () => useContext(Ctx);

const DIALOG: Record<NonNullable<Ask["kind"]>, (a: Ask) => string> = {
  data: () => "This view is a proposed interface. Connect authorised institutional data to enable it; until then every figure stays empty.",
  pilot: (a) => `${a.title} is available in the pilot. This preview shows the Sovereign Overview for each sector.`,
  approval: (a) => `${a.count} item${a.count === 1 ? "" : "s"} need a named human decision. Nothing proceeds or executes from this screen; approvals are recorded once authorised data and authority are connected.`,
  scenario: () => "Scenarios run once authorised data is connected. Every input and assumption will be shown before any result.",
  info: () => "Available in the pilot. Connect authorised data to enable this.",
};

function Dialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const kind = ask.kind ?? "data";
  return (
    <div className="cc-scrim" onClick={onClose}>
      <div className="cc-dialog" role="dialog" aria-modal="true" aria-labelledby="cc-dlg-t" onClick={(e) => e.stopPropagation()}>
        <span className="cc-eyebrow">{kind === "pilot" ? "Available in the pilot" : kind === "approval" ? "Approval required" : "Proposed interface"}</span>
        <h2 id="cc-dlg-t">{ask.title}</h2>
        <p>{DIALOG[kind](ask)}</p>
        <footer><button ref={ref} type="button" className="cc-btn solid small" onClick={onClose}>Close</button></footer>
      </div>
    </div>
  );
}

function PillTag({ p }: { p: Pill }) {
  if (typeof p === "object") return <span className="cc-pill neutral">{p.text}</span>;
  if (p === "approval") return <span className="cc-pill approval"><span className="cc-dot" />Approval required</span>;
  const text = { awaiting: "Awaiting data", high: "High", medium: "Medium", low: "Low" }[p];
  return <span className={`cc-pill ${p}`}>{text}</span>;
}

const NA = () => <span className="cc-na">Source not connected</span>;
const Chev = () => <Ic n="chevron-right" className="cc-chev" />;

function Head({ b }: { b: Block }) {
  const ask = useAsk();
  const m = b.type === "map" ? b : null;
  const chipRight = b.span >= 4 && (b.title?.length ?? 0) <= 20 && !b.subtitle;
  const chip = b.chip && !(b.type === "chart" && b.tabs);
  return (
    <div className="cc-card-h">
      <Ic n={b.icon} />
      <div className="cc-card-t">
        {b.title && <h2>{b.title}</h2>}
        {b.subtitle && <p className="cc-card-sub">{b.subtitle}</p>}
        {chip && !chipRight && <p className="cc-card-sub">Source not connected</p>}
      </div>
      <div className="cc-card-a">
        {m && !m.dark && m.segmented && <Seg opts={m.segmented} label={b.title!} />}
        {m?.dropdown?.map((d, i) => <Drop key={i} label={d.label} opts={d.options} />)}
        {m?.button && <button type="button" className="cc-btn small" onClick={() => ask({ title: m.button! })}>{m.button}<Chev /></button>}
        {m?.expand && <button type="button" className="cc-sq" aria-label={`Expand ${b.title}`} onClick={() => ask({ title: b.title! })}><Ic n="maximize-2" /></button>}
        {chip && chipRight && <span className="cc-chip">Source not connected</span>}
        {b.link && <button type="button" className="cc-link" onClick={() => ask({ title: `${b.title}: ${b.link}` })}>{b.link}<Ic n="arrow-right" /></button>}
        {b.more && <button type="button" className="cc-more" aria-label={`More options for ${b.title}`} onClick={() => ask({ title: b.title!, kind: "info" })}><Ic n="ellipsis" /></button>}
      </div>
    </div>
  );
}

function Seg({ opts, label }: { opts: string[]; label: string }) {
  const [v, setV] = useState(0);
  return <div className="cc-seg" role="group" aria-label={`${label} view`}>{opts.map((o, i) => <button key={o} type="button" aria-pressed={v === i} onClick={() => setV(i)}>{o}</button>)}</div>;
}
function Drop({ label, opts }: { label?: string; opts: string[] }) {
  const ask = useAsk();
  return <span className="cc-drop">{label}<button type="button" aria-haspopup="dialog" onClick={() => ask({ title: `${label ?? "Filter"} ${opts.join(", ")}`, kind: "info" })}>{opts[0]}<Ic n="chevron-down" /></button></span>;
}
function Tabs({ opts }: { opts: string[] }) {
  const [v, setV] = useState(0);
  return <div className="cc-tabs" role="tablist">{opts.map((o, i) => <button key={o} role="tab" type="button" aria-selected={v === i} onClick={() => setV(i)}>{o}</button>)}</div>;
}

function Row({ it, ctx, narrow }: { it: Item; ctx: string; narrow?: boolean }) {
  const ask = useAsk();
  const boxed = ctx === "boxed";
  const kind: Ask["kind"] = it.button || /scenario/i.test(it.title) ? "scenario" : it.pill === "approval" ? "approval" : "data";
  return (
    <button type="button" className={`cc-item${it.icon || it.dot ? "" : " noicon"}`} onClick={() => ask({ title: it.title, kind, count: 1 })}>
      {it.dot ? <span className={`cc-sdot ${it.dot}`} aria-hidden /> : it.icon === "square" ? <span className="cc-check" aria-hidden /> : it.icon ? (boxed ? <span className="cc-ib"><Ic n={it.icon} /></span> : <Ic n={it.icon} />) : null}
      <span><b>{it.title}</b>{it.desc && <p>{it.desc}</p>}{narrow && it.pill && <span style={{ display: "block", marginTop: 4 }}><PillTag p={it.pill} /></span>}</span>
      <span className="cc-end">{!narrow && it.pill && <PillTag p={it.pill} />}{it.button ? <span className="cc-btn small solid"><Ic n="chart-no-axes-column" />{it.button}</span> : <Chev />}</span>
    </button>
  );
}

function Chart({ b }: { b: Extract<Block, { type: "chart" }> }) {
  const ask = useAsk();
  const ticks = b.yTicks ?? ["", "", "", "", ""];
  return (
    <>
      {b.tabs && <Tabs opts={b.tabs} />}
      {b.dropdown && <div><Drop opts={b.dropdown} /></div>}
      {b.y && b.tabs && <div className="cc-meta" style={{ justifyContent: "space-between" }}><span>{b.y}</span><NA /></div>}
      <div className="cc-chart">
        <span className="cc-ylab">{b.tabs ? "" : b.y}</span>
        <div className="cc-yt" aria-hidden>{ticks.map((t, i) => <span key={i}>{t}</span>)}</div>
        <div className="cc-plot">
          {ticks.map((_, i) => <i key={i} />)}
          <div className="cc-empty">
            <Ic n="chart-no-axes-column" />
            <b>{b.empty[0]}</b>
            {b.empty[1] && <p>{b.empty[1]}</p>}
            {b.button && <button type="button" className={`cc-btn${b.button.length > 14 ? " solid" : ""}`} onClick={() => ask({ title: b.title! })}>{b.button.length > 14 && <Ic n="link" />}{b.button}</button>}
          </div>
        </div>
        {b.x.length > 0 && <div className="cc-xt" aria-hidden>{b.x.map((x) => <span key={x}>{x}</span>)}</div>}
      </div>
      {b.tabs && !b.y && <NA />}
    </>
  );
}

function Body({ b, narrow }: { b: Block; narrow?: boolean }) {
  const ask = useAsk();
  switch (b.type) {
    case "kpis":
      return <div className="cc-kpis">{b.items.map((k) => <div key={k.title} className="cc-kpi"><Ic n={k.icon} /><b>{k.title}</b><span className="cc-dash">—</span><NA /></div>)}</div>;
    case "glance":
      return <div className="cc-glance">{b.items.map((k) => <button type="button" key={k.title} className="cc-cell" onClick={() => ask({ title: k.title })}><Ic n={k.icon} /><b>{k.title}</b><span className="cc-dash">—</span><NA />{b.chip && <Chev />}</button>)}</div>;
    case "rows":
      return <div className="cc-rowsm">{b.items.map((k) => <div key={k.title}><Ic n={k.icon} /><span>{k.title}</span><span className="r"><span className="cc-dash">—</span><NA /></span></div>)}</div>;
    case "map": {
      const side = b.legend ? "left" : b.sideList ? "right" : "";
      return (
        <>
          {b.dark && b.segmented && <div><Seg opts={b.segmented} label={b.title!} /></div>}
          <div className={`cc-map ${side}`}>
            {b.legend && <div className="cc-legend" aria-label="Legend">{b.legend.map((l, i) => <Legend key={l.title} it={l} first={i === 0 && l.title.startsWith("All")} />)}</div>}
            <div className="cc-map-img"><img src={b.img} alt={`${b.alt}. Illustrative, not live data.`} width={1000} height={Math.round(1000 / b.ratio)} loading="lazy" /></div>
            {b.sideList && <div className="cc-sidelist">{b.sideList.map((l) => <button key={l.title} type="button" onClick={() => ask({ title: l.title })}><Ic n={l.icon} /><span>{l.title}</span><small>— | Source not connected</small></button>)}</div>}
          </div>
          {b.chips && <div className="cc-chips">{b.chips.map((c) => <span key={c.title}>{c.dot ? <span className={`cc-sdot ${c.dot}`} /> : c.icon ? <Ic n={c.icon} /> : <span className="cc-sdot" style={{ border: "1.5px solid var(--cc-muted)" }} />}{c.title}</span>)}</div>}
        </>
      );
    }
    case "chart":
      return <Chart b={b} />;
    case "list": {
      const boxed = b.items.some((i) => i.icon && i.desc) && b.span >= 4 && !b.items.some((i) => i.pill === "high");
      return (
        <>
          {b.dropdown && <button type="button" className="cc-btn small" style={{ justifyContent: "space-between", borderColor: "var(--cc-line)", color: "var(--cc-ink)" }} onClick={() => ask({ title: b.dropdown!, kind: "scenario" })}>{b.dropdown}<Ic n="chevron-down" /></button>}
          <div className="cc-list">{b.items.map((it) => <Row key={it.title} it={it} ctx={boxed ? "boxed" : ""} narrow={narrow} />)}</div>
          {b.footerButton && <button type="button" className="cc-btn solid" onClick={() => ask({ title: b.footerButton!, kind: "scenario" })}>{b.footerButton}</button>}
        </>
      );
    }
    case "tiles": {
      const narrow = b.span <= 4;
      return (
        <div className={`cc-tiles${narrow ? " narrow" : b.items.length > 3 ? " icons" : ""}`} style={{ ["--n" as string]: b.items.length }}>
          {b.items.map((t) => (
            <button key={t.title} type="button" className="cc-tile" onClick={() => ask({ title: t.title, kind: "scenario" })}>
              <Ic n={t.icon} />{narrow || b.items.length > 3 ? <><Chev /><div><b>{t.title}</b><p>{t.desc}</p></div></> : <><div><b>{t.title}</b><p>{t.desc}</p></div><Chev /></>}
            </button>
          ))}
        </div>
      );
    }
    case "table":
      return (
        <div className="cc-scroll">
          <table className="cc-table">
            <thead><tr>{b.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {b.rows?.length ? b.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 1 ? "m" : ""}>{c === "Awaiting data" ? <PillTag p="awaiting" /> : c}</td>)}</tr>)
                : b.chip ? <tr><td colSpan={b.columns.length}><div className="cc-empty cc-static"><Ic n="file-text" /><b>No items to display</b><p>Authorised data is required to populate the expert review queue.</p><button type="button" className="cc-btn solid" onClick={() => ask({ title: b.title! })}><Ic n="link" />Connect authorised data</button></div></td></tr>
                : <tr>{b.columns.map((c, i) => <td key={c}>{i === b.columns.length - 1 ? <span className="cc-pill awaiting">Awaiting input</span> : <span className="cc-skel" aria-label="No value" />}</td>)}</tr>}
            </tbody>
          </table>
        </div>
      );
    case "empty":
      return (
        <>
          {b.tabs && <Tabs opts={b.tabs} />}
          {b.filters && <Filters opts={b.filters} />}
          {!b.empty && !b.button ? <div className="cc-skelrow"><span className="cc-skel" aria-label="No item" /><PillTag p="approval" /><Chev /></div> : <div className="cc-empty cc-static">
            <Ic n="file-text" />
            <b>{b.empty?.[0] ?? "No items to show"}</b>
            <p>{b.empty?.[1] ?? "Authorised data is required to display mandate checks and decisions."}</p>
            {b.button && <button type="button" className="cc-btn solid" onClick={() => ask({ title: b.title! })}><Ic n="link" />{b.button}</button>}
          </div>}
        </>
      );
    case "align":
      return (
        <>
          <div className="cc-align">{b.items.map((a) => <div key={a.title}><Ic n={a.icon} /><span>{a.title}</span><span className="cc-track" aria-hidden /><span aria-label="No value">—</span></div>)}</div>
          {b.pillButton && <div><button type="button" className="cc-btn round small" onClick={() => ask({ title: b.pillButton! })}>{b.pillButton}<Ic n="arrow-right" className="cc-arrow" /></button></div>}
        </>
      );
    case "kv":
      return <div className="cc-kv">{b.items.map((k) => <div key={k.label}><Ic n={k.icon} /><span>{k.label}</span><span>{k.value}</span></div>)}</div>;
    case "actions":
      return <div className="cc-acts">{b.items.map((a) => <div key={a.title}><Ic n={a.icon} /><span><b>{a.title}</b><p>{a.desc}</p></span><button type="button" className="cc-btn small" onClick={() => ask({ title: a.title, kind: "approval", count: 1 })}>{a.button}</button></div>)}</div>;
    case "status":
      return (
        <div className="cc-status">
          {b.items.map((k) => <div key={k.title} className="cc-cell"><Ic n={k.icon} /><b>{k.title}</b><span className="cc-dash">—</span><NA /></div>)}
          {b.button && <button type="button" className="cc-btn" style={{ alignSelf: "center" }} onClick={() => ask({ title: b.button!, kind: "approval", count: 0 })}>{b.button}<Ic n="arrow-right" className="cc-arrow" /></button>}
        </div>
      );
    case "pair":
      return null;
  }
}

function Legend({ it, first }: { it: Item; first: boolean }) {
  return <div className={first ? "on" : ""}><Ic n={it.icon} />{it.title}</div>;
}

function Filters({ opts }: { opts: string[] }) {
  const [v, setV] = useState(0);
  return <div className="cc-filters">{opts.map((o, i) => <button key={o} type="button" aria-pressed={v === i} onClick={() => setV(i)}>{o}</button>)}</div>;
}

function Card({ b, narrow }: { b: Block; narrow?: boolean }) {
  if (b.type === "kpis") return <section aria-label="Key measures"><Body b={b} /></section>;
  if (b.type === "pair") return <div className="cc-pair">{b.blocks.map((x, i) => <Card key={i} b={x} narrow />)}</div>;
  return <section className={`cc-card${b.type === "map" && b.dark ? " dark" : ""}`} aria-label={b.title}>{(b.title || b.icon) && <Head b={b} />}<Body b={b} narrow={narrow} /></section>;
}

export function CommandCentre({ sectorKey }: { sectorKey: string }) {
  const s = sectorByKey(sectorKey)!;
  const router = useRouter();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  // Hash routes (#energy, #banking, ...) resolve to the sector's route.
  useEffect(() => {
    const go = () => { const h = window.location.hash.slice(1); if (h && h !== sectorKey && sectorByKey(h)) router.replace(`/command-centres/${h}`); };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [router, sectorKey]);

  return (
    <Ctx.Provider value={setAsk}>
      <div className={`cc${open ? " open" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
        <aside className="cc-side" aria-label="TIGERIS AI OS">
          <div className="cc-brand">
            <Ic n="tree-palm" width={36} height={36} color="var(--cc-green)" />
            <div><div className="cc-brand-name">TIGERIS AI OS</div><div className="cc-brand-tag">Sovereign intelligence<br />for a brighter<br />tomorrow</div></div>
          </div>
          <nav className="cc-nav">
            {NAV.map((n, i) => <button key={n.label} type="button" aria-current={i === 0 ? "page" : undefined} onClick={() => (i === 0 ? setOpen(false) : setAsk({ title: n.label, kind: "pilot" }))}><Ic n={n.icon} />{n.label}</button>)}
          </nav>
          <img className="cc-side-img" src={s.side} alt={`Illustrative ${s.label.toLowerCase()} landscape`} width={236} height={420} />
        </aside>
        <div className="cc-main">
          <header className="cc-top">
            <button type="button" className="cc-iconbtn cc-menu" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Ic n="menu" /></button>
            <label className="cc-select"><Ic n="landmark" /><span><small>Institution</small>
              <select defaultValue="" aria-label="Institution" onChange={(e) => e.target.value && setAsk({ title: e.target.value, kind: "data" })}>
                <option value="" disabled>Select institution</option>{INSTITUTIONS.map((x) => <option key={x}>{x}</option>)}
              </select></span><Ic n="chevron-down" className="cc-caret" /></label>
            <label className="cc-select"><Ic n={s.icon} /><span><small>Sector</small>
              <select value={s.key} aria-label="Sector" onChange={(e) => router.push(`/command-centres/${e.target.value}`)}>
                {SECTORS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select></span><Ic n="chevron-down" className="cc-caret" /></label>
            {s.search && <button type="button" className="cc-searchbox" onClick={() => setAsk({ title: "Search", kind: "info" })}><Ic n="search" /><span>Search entities, cases, scenarios…</span></button>}
            <div className="cc-top-right">
              <button type="button" className="cc-lang" aria-label="Switch language direction" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
                {lang === "en" ? <><b>EN</b> | <span>العربية</span></> : <><span>EN</span> | <b>العربية</b></>}
              </button>
              <button type="button" className="cc-iconbtn" aria-label="Display settings" onClick={() => setAsk({ title: "Display settings", kind: "info" })}><Ic n="sun" /></button>
              <button type="button" className="cc-approval" aria-label={`Approval required (${s.approvals})`} onClick={() => setAsk({ title: "Approval required", kind: "approval", count: s.approvals })}><span className="cc-dot" /><span className="cc-label">Approval required</span> ({s.approvals})<Ic n="chevron-down" /></button>
              <button type="button" className="cc-iconbtn cc-avatar" aria-label="Account" onClick={() => setAsk({ title: "Account", kind: "info" })}><Ic n="user" /></button>
            </div>
          </header>

          <main className="cc-content">
            <div className="cc-head">
              <div className="cc-head-l">
                {s.eyebrow && <p className={`cc-eyebrow${s.eyebrowCaps ? "" : " plain"}`}>{s.eyebrow}</p>}
                <h1>{s.title}{s.badge && s.right.hero && <> <span className="cc-badge" style={{ verticalAlign: "middle" }}>Proposed interface</span></>}</h1>
                <p className="cc-sub">{s.subtitle}</p>
              </div>
              {(s.right.hero || s.right.meta || s.badge) && !s.right.metaTabs && (
                <div className="cc-head-r">
                  {((s.badge && !s.right.hero) || s.right.meta) && <div className="cc-meta">{s.badge && !s.right.hero && <span className="cc-badge">Proposed interface</span>}{s.right.meta && <span>{s.right.meta}</span>}</div>}
                  {s.right.hero && <img className="cc-hero" src={s.right.hero} alt={`${s.right.heroAlt}. Illustrative.`} width={520} height={130} />}
                </div>
              )}
            </div>
            {s.right.metaTabs && (
              <div className="cc-metatabs">
                <div className="cc-meta"><span>Last updated: —</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Ic n="circle" width={9} height={9} />Source not connected</span></div>
                <div className="cc-strip">{s.right.metaTabs.map((t) => <button key={t.title} type="button" onClick={() => setAsk({ title: t.title })}><Ic n={t.icon} />{t.title}</button>)}</div>
              </div>
            )}
            {s.pageTabs && <div className="cc-pagetabs" role="tablist">{s.pageTabs.map((t, i) => <button key={t} type="button" role="tab" aria-selected={tab === i} onClick={() => (i === 0 ? setTab(0) : setAsk({ title: t, kind: "pilot" }))}>{t}</button>)}</div>}

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

            <footer className="cc-foot"><div>{s.footer.map((f) => <span key={f}>{f}</span>)}</div><span>{s.footerRight}</span></footer>
          </main>
        </div>
        {ask && <Dialog ask={ask} onClose={() => setAsk(null)} />}
      </div>
    </Ctx.Provider>
  );
}

export function CommandCentreIndex() {
  const router = useRouter();
  useEffect(() => {
    const h = window.location.hash.slice(1);
    router.replace(`/command-centres/${sectorByKey(h) ? h : "supply-chain"}`);
  }, [router]);
  return null as ReactNode;
}
