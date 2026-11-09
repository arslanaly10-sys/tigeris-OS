/**
 * Fund applications: deal screening, IC memo preparation, portfolio monitoring and board/LP reports.
 * The "first application" a fund team can use in week one (critical review, section 6; Brain Co's FinanceOS lesson).
 * Every company, figure and limit below is SYNTHETIC and fictional, labelled as such wherever it is shown.
 * All arithmetic is deterministic TypeScript; no model computes or decides anything here.
 */

export interface Mandate {
  name: string;
  navUsd: number;
  cashUsd: number;
  sectors: string[];
  excluded: string[];
  geographies: string[];
  ticketMinUsd: number;
  ticketMaxUsd: number;
  maxSectorShare: number; // of NAV, after the deal
  maxNameShare: number; // one ticket as a share of NAV
  leverageWatch: number; // net debt / EBITDA
  leverageMax: number;
}

export interface Deal {
  key: string; name: string; sector: string; geography: string; stage: string;
  ticketUsd: number; ownership: number; revenueUsd: number; ebitdaUsd: number; revenueGrowth: number; netDebtUsd: number;
  esgFlags: string[]; thesis: string; risks: string[]; source: string;
}

export interface Holding {
  key: string; name: string; sector: string; geography: string; investedUsd: number; valueUsd: number; valuePrevUsd: number;
  revenueVsPlan: number; leverage: number; leverageCovenant: number; runwayMonths: number | null; note: string;
}

export const FUND_DATA_LABEL = "Synthetic: fictional companies and figures for demonstration";

export const MANDATE: Mandate = {
  name: "Growth and national capability fund (synthetic)",
  navUsd: 12_400_000_000, cashUsd: 1_350_000_000,
  sectors: ["energy transition", "logistics", "healthcare", "advanced manufacturing", "digital infrastructure", "food security"],
  excluded: ["thermal coal", "tobacco", "gambling"],
  geographies: ["GCC", "Wider MENA", "South Asia"],
  ticketMinUsd: 50_000_000, ticketMaxUsd: 600_000_000,
  maxSectorShare: 0.25, maxNameShare: 0.05, leverageWatch: 3.5, leverageMax: 5,
};

export const DEALS: Deal[] = [
  { key: "D-101", name: "Qamar Cold Chain", sector: "food security", geography: "GCC", stage: "Growth equity", ticketUsd: 180_000_000, ownership: 0.30, revenueUsd: 240_000_000, ebitdaUsd: 46_000_000, revenueGrowth: 0.21, netDebtUsd: 95_000_000, esgFlags: [],
    thesis: "Regional cold-chain capacity is short of demand; the platform adds 40% more refrigerated storage near two ports.", risks: ["Construction delays on two sites", "Customer concentration: top three are 38% of revenue"], source: "Inbound from a regional bank (synthetic)" },
  { key: "D-102", name: "Sahel Grid Storage", sector: "energy transition", geography: "Wider MENA", stage: "Project equity", ticketUsd: 420_000_000, ownership: 0.45, revenueUsd: 85_000_000, ebitdaUsd: 52_000_000, revenueGrowth: 0.35, netDebtUsd: 240_000_000, esgFlags: [],
    thesis: "Contracted battery storage alongside utility solar; offtake with the state utility for 15 years.", risks: ["Leverage near the mandate ceiling", "Single offtaker"], source: "Co-investment offer from a partner fund (synthetic)" },
  { key: "D-103", name: "Hadid Precision Castings", sector: "advanced manufacturing", geography: "GCC", stage: "Buyout", ticketUsd: 260_000_000, ownership: 0.70, revenueUsd: 310_000_000, ebitdaUsd: 41_000_000, revenueGrowth: 0.08, netDebtUsd: 120_000_000, esgFlags: ["Energy-intensive process: decarbonisation plan needed"],
    thesis: "Localises turbine and valve castings now imported; anchor customers include two national industrial champions.", risks: ["Qualification time with anchor customers", "Energy cost exposure"], source: "Proprietary: national programme pipeline (synthetic)" },
  { key: "D-104", name: "Wadi Data Centres", sector: "digital infrastructure", geography: "GCC", stage: "Growth equity", ticketUsd: 750_000_000, ownership: 0.25, revenueUsd: 190_000_000, ebitdaUsd: 88_000_000, revenueGrowth: 0.42, netDebtUsd: 260_000_000, esgFlags: ["Water use for cooling"],
    thesis: "Sovereign-cloud demand outstrips local capacity; 120 MW pipeline with two signed hyperscale tenants.", risks: ["Ticket above the mandate maximum", "Power connection timing"], source: "Sell-side process (synthetic)" },
  { key: "D-105", name: "Noor Diagnostics", sector: "healthcare", geography: "South Asia", stage: "Growth equity", ticketUsd: 95_000_000, ownership: 0.20, revenueUsd: 130_000_000, ebitdaUsd: 22_000_000, revenueGrowth: 0.27, netDebtUsd: 10_000_000, esgFlags: [],
    thesis: "Lab network expanding into second-tier cities; asset-light collection points.", risks: ["Price regulation", "Key-person dependence on the founder"], source: "Inbound from management (synthetic)" },
  { key: "D-106", name: "Dune Coal Logistics", sector: "thermal coal", geography: "South Asia", stage: "Buyout", ticketUsd: 150_000_000, ownership: 0.60, revenueUsd: 400_000_000, ebitdaUsd: 70_000_000, revenueGrowth: 0.02, netDebtUsd: 140_000_000, esgFlags: ["Excluded sector"],
    thesis: "Cash-generative coal haulage with long contracts.", risks: ["Excluded by the mandate", "Stranded-asset risk"], source: "Broker (synthetic)" },
  { key: "D-107", name: "Marsa Feeder Lines", sector: "logistics", geography: "GCC", stage: "Growth equity", ticketUsd: 140_000_000, ownership: 0.35, revenueUsd: 160_000_000, ebitdaUsd: 24_000_000, revenueGrowth: 0.15, netDebtUsd: 100_000_000, esgFlags: [],
    thesis: "Feeder shipping that keeps secondary ports supplied when main lanes are disrupted.", risks: ["Leverage above the watch level", "Fuel price exposure"], source: "Proprietary (synthetic)" },
];

export const HOLDINGS: Holding[] = [
  { key: "H-01", name: "Ghaf Renewables", sector: "energy transition", geography: "GCC", investedUsd: 900_000_000, valueUsd: 1_310_000_000, valuePrevUsd: 1_260_000_000, revenueVsPlan: 0.04, leverage: 3.1, leverageCovenant: 5.0, runwayMonths: null, note: "Second solar plant at commercial operation." },
  { key: "H-02", name: "Lulu Port Services", sector: "logistics", geography: "GCC", investedUsd: 650_000_000, valueUsd: 610_000_000, valuePrevUsd: 700_000_000, revenueVsPlan: -0.12, leverage: 4.6, leverageCovenant: 5.0, runwayMonths: null, note: "Volumes down on lane disruption; covenant headroom thin." },
  { key: "H-03", name: "Shifa Hospitals", sector: "healthcare", geography: "Wider MENA", investedUsd: 1_100_000_000, valueUsd: 1_420_000_000, valuePrevUsd: 1_390_000_000, revenueVsPlan: 0.02, leverage: 2.4, leverageCovenant: 4.5, runwayMonths: null, note: "Third hospital opened on time." },
  { key: "H-04", name: "Raml Semiconductors", sector: "advanced manufacturing", geography: "GCC", investedUsd: 480_000_000, valueUsd: 350_000_000, valuePrevUsd: 420_000_000, revenueVsPlan: -0.28, leverage: 0, leverageCovenant: 3.0, runwayMonths: 5, note: "Qualification slipped two quarters; cash runway short." },
  { key: "H-05", name: "Oasis Fibre", sector: "digital infrastructure", geography: "GCC", investedUsd: 1_300_000_000, valueUsd: 1_880_000_000, valuePrevUsd: 1_800_000_000, revenueVsPlan: 0.07, leverage: 3.9, leverageCovenant: 5.5, runwayMonths: null, note: "Fibre-to-home take-up ahead of plan." },
  { key: "H-06", name: "Barakah Agri-Tech", sector: "food security", geography: "South Asia", investedUsd: 300_000_000, valueUsd: 320_000_000, valuePrevUsd: 330_000_000, revenueVsPlan: -0.05, leverage: 5.3, leverageCovenant: 5.0, runwayMonths: 14, note: "Leverage covenant breached at quarter end; waiver requested." },
  { key: "H-07", name: "Sadeem Logistics Parks", sector: "logistics", geography: "GCC", investedUsd: 1_500_000_000, valueUsd: 1_650_000_000, valuePrevUsd: 1_640_000_000, revenueVsPlan: 0.01, leverage: 3.3, leverageCovenant: 5.0, runwayMonths: null, note: "Occupancy 94%." },
  { key: "H-08", name: "Zayt Green Hydrogen", sector: "energy transition", geography: "Wider MENA", investedUsd: 800_000_000, valueUsd: 790_000_000, valuePrevUsd: 800_000_000, revenueVsPlan: 0, leverage: 0, leverageCovenant: 3.0, runwayMonths: 30, note: "Pre-revenue; electrolyser order placed." },
];

/* ---------------- deal screening ---------------- */

export type Verdict = "pass" | "watch" | "fail";
export interface Criterion { key: string; label: string; verdict: Verdict; detail: string }
export interface Screen { deal: Deal; criteria: Criterion[]; result: "advance" | "review" | "decline"; impliedEvUsd: number; evToEbitda: number; leverage: number; sectorShareAfter: number; nameShare: number }

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const usd = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)} bn` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(0)} m` : `${s}$${a.toFixed(0)}`;
};

export function sectorExposure(holdings: Holding[] = HOLDINGS): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of holdings) out[h.sector] = (out[h.sector] ?? 0) + h.valueUsd;
  return out;
}

/** Screens one deal against the mandate. Deterministic; each criterion says why. */
export function screenDeal(deal: Deal, m: Mandate = MANDATE, holdings: Holding[] = HOLDINGS): Screen {
  const leverage = deal.ebitdaUsd > 0 ? deal.netDebtUsd / deal.ebitdaUsd : Infinity;
  const equityValue = deal.ticketUsd / deal.ownership;
  const impliedEvUsd = equityValue + deal.netDebtUsd;
  const evToEbitda = deal.ebitdaUsd > 0 ? impliedEvUsd / deal.ebitdaUsd : Infinity;
  const sectorShareAfter = ((sectorExposure(holdings)[deal.sector] ?? 0) + deal.ticketUsd) / (m.navUsd + deal.ticketUsd);
  const nameShare = deal.ticketUsd / m.navUsd;
  const c: Criterion[] = [];
  const excluded = m.excluded.includes(deal.sector);
  c.push({ key: "sector", label: "Sector in mandate", verdict: excluded ? "fail" : m.sectors.includes(deal.sector) ? "pass" : "watch",
    detail: excluded ? `${deal.sector} is excluded by the mandate.` : m.sectors.includes(deal.sector) ? `${deal.sector} is a mandate sector.` : `${deal.sector} is not a named sector; needs a committee view.` });
  c.push({ key: "geography", label: "Geography", verdict: m.geographies.includes(deal.geography) ? "pass" : "watch", detail: `${deal.geography}; mandate focus is ${m.geographies.join(", ")}.` });
  c.push({ key: "ticket", label: "Ticket size", verdict: deal.ticketUsd > m.ticketMaxUsd || deal.ticketUsd < m.ticketMinUsd ? "fail" : "pass",
    detail: `${usd(deal.ticketUsd)} against a band of ${usd(m.ticketMinUsd)} to ${usd(m.ticketMaxUsd)}.` });
  c.push({ key: "name", label: "Single-name limit", verdict: nameShare > m.maxNameShare ? "fail" : nameShare > m.maxNameShare * 0.8 ? "watch" : "pass",
    detail: `Ticket is ${pct(nameShare)} of NAV; limit ${pct(m.maxNameShare, 0)}.` });
  c.push({ key: "concentration", label: "Sector concentration after the deal", verdict: sectorShareAfter > m.maxSectorShare ? "fail" : sectorShareAfter > m.maxSectorShare * 0.85 ? "watch" : "pass",
    detail: `${deal.sector} would be ${pct(sectorShareAfter)} of NAV; limit ${pct(m.maxSectorShare, 0)}.` });
  c.push({ key: "leverage", label: "Leverage", verdict: leverage > m.leverageMax ? "fail" : leverage > m.leverageWatch ? "watch" : "pass",
    detail: `Net debt / EBITDA ${leverage.toFixed(1)}x; watch above ${m.leverageWatch}x, limit ${m.leverageMax}x.` });
  c.push({ key: "esg", label: "ESG flags", verdict: deal.esgFlags.length ? (excluded ? "fail" : "watch") : "pass", detail: deal.esgFlags.length ? deal.esgFlags.join("; ") : "None raised." });
  const result = c.some((x) => x.verdict === "fail") ? "decline" : c.some((x) => x.verdict === "watch") ? "review" : "advance";
  return { deal, criteria: c, result, impliedEvUsd, evToEbitda, leverage, sectorShareAfter, nameShare };
}

/* ---------------- IC memo ---------------- */

/** A first-draft IC memo assembled from the deal record and the screen. Every figure is from the record; nothing is invented. */
export function icMemo(s: Screen, m: Mandate = MANDATE): string {
  const d = s.deal;
  const lines = [
    `# Investment committee memo (draft): ${d.name}`,
    "",
    `> ${FUND_DATA_LABEL}. Drafted by TIGERIS from the deal record; a named analyst must review every line before it goes to committee.`,
    "",
    `**Deal** ${d.key} · ${d.stage} · ${d.sector} · ${d.geography} · source: ${d.source}`,
    `**Screen result** ${s.result.toUpperCase()} against "${m.name}"`,
    "",
    "## Recommendation",
    s.result === "advance" ? "Proceed to full due diligence." : s.result === "review" ? "Proceed only if the committee accepts the items marked WATCH below." : "Do not proceed: at least one mandate limit fails.",
    "",
    "## Thesis",
    d.thesis,
    "",
    "## Key figures (from the deal record)",
    `| Item | Value |`, `|---|---|`,
    `| Ticket | ${usd(d.ticketUsd)} for ${pct(d.ownership, 0)} |`,
    `| Implied enterprise value | ${usd(s.impliedEvUsd)} |`,
    `| EV / EBITDA | ${s.evToEbitda.toFixed(1)}x |`,
    `| Revenue · growth | ${usd(d.revenueUsd)} · ${pct(d.revenueGrowth, 0)} |`,
    `| EBITDA · margin | ${usd(d.ebitdaUsd)} · ${pct(d.ebitdaUsd / d.revenueUsd, 0)} |`,
    `| Net debt / EBITDA | ${s.leverage.toFixed(1)}x |`,
    "",
    "## Mandate fit",
    ...s.criteria.map((c) => `- **${c.verdict.toUpperCase()}** ${c.label}: ${c.detail}`),
    "",
    "## Risks",
    ...d.risks.map((r) => `- ${r}`),
    "",
    "## Questions for diligence",
    "- What evidence confirms the growth rate beyond management's own figures?",
    ...s.criteria.filter((c) => c.verdict !== "pass").map((c) => `- How is "${c.label.toLowerCase()}" resolved or mitigated?`),
    "",
    "## Decision",
    "To be taken by the named committee members in TIGERIS. This memo does not execute anything.",
  ];
  return lines.join("\n");
}

/* ---------------- portfolio monitoring ---------------- */

export interface Check { key: string; label: string; verdict: Verdict; detail: string }
export interface Monitored { holding: Holding; checks: Check[]; status: Verdict; qoq: number; moic: number }

export function monitorHolding(h: Holding): Monitored {
  const qoq = h.valuePrevUsd ? h.valueUsd / h.valuePrevUsd - 1 : 0;
  const moic = h.investedUsd ? h.valueUsd / h.investedUsd : 0;
  const headroom = h.leverageCovenant ? 1 - h.leverage / h.leverageCovenant : 1;
  const checks: Check[] = [
    { key: "covenant", label: "Leverage covenant", verdict: h.leverage > h.leverageCovenant ? "fail" : headroom < 0.1 ? "watch" : "pass", detail: `${h.leverage.toFixed(1)}x against ${h.leverageCovenant.toFixed(1)}x (${h.leverage > h.leverageCovenant ? "breached" : `${pct(headroom, 0)} headroom`}).` },
    { key: "plan", label: "Revenue against plan", verdict: h.revenueVsPlan <= -0.15 ? "fail" : h.revenueVsPlan <= -0.05 ? "watch" : "pass", detail: `${h.revenueVsPlan >= 0 ? "+" : ""}${pct(h.revenueVsPlan, 0)} against plan.` },
    { key: "value", label: "Value this quarter", verdict: qoq <= -0.15 ? "fail" : qoq <= -0.05 ? "watch" : "pass", detail: `${qoq >= 0 ? "+" : ""}${pct(qoq)} quarter on quarter.` },
    { key: "runway", label: "Cash runway", verdict: h.runwayMonths === null ? "pass" : h.runwayMonths < 6 ? "fail" : h.runwayMonths < 12 ? "watch" : "pass", detail: h.runwayMonths === null ? "Cash generative." : `${h.runwayMonths} months.` },
  ];
  const status: Verdict = checks.some((c) => c.verdict === "fail") ? "fail" : checks.some((c) => c.verdict === "watch") ? "watch" : "pass";
  return { holding: h, checks, status, qoq, moic };
}

export function fundSummary(holdings: Holding[] = HOLDINGS, m: Mandate = MANDATE) {
  const monitored = holdings.map(monitorHolding);
  const invested = holdings.reduce((s, h) => s + h.investedUsd, 0);
  const value = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const prev = holdings.reduce((s, h) => s + h.valuePrevUsd, 0);
  const sectors = Object.entries(sectorExposure(holdings)).map(([sector, v]) => ({ sector, valueUsd: v, share: v / m.navUsd })).sort((a, b) => b.valueUsd - a.valueUsd);
  return {
    invested, value, prev, cash: m.cashUsd, nav: m.navUsd, moic: value / invested, qoq: value / prev - 1, sectors,
    breaches: monitored.filter((x) => x.status === "fail"), watch: monitored.filter((x) => x.status === "watch"), monitored,
    movers: [...monitored].sort((a, b) => Math.abs(b.holding.valueUsd - b.holding.valuePrevUsd) - Math.abs(a.holding.valueUsd - a.holding.valuePrevUsd)).slice(0, 3),
  };
}

/* ---------------- board / LP report ---------------- */

export function boardReport(quarter: string, holdings: Holding[] = HOLDINGS, m: Mandate = MANDATE): string {
  const f = fundSummary(holdings, m);
  const lines = [
    `# Board and LP report: ${m.name}, ${quarter}`,
    "",
    `> ${FUND_DATA_LABEL}. Every figure is computed from the holding records; nothing is estimated by a model.`,
    "",
    "## Headline",
    `- Portfolio value ${usd(f.value)} against ${usd(f.invested)} invested: ${f.moic.toFixed(2)}x multiple on invested capital.`,
    `- Change this quarter: ${f.qoq >= 0 ? "+" : ""}${pct(f.qoq)} (${usd(f.value - f.prev)}).`,
    `- Cash available: ${usd(f.cash)}. Reported NAV: ${usd(f.nav)}.`,
    `- ${f.breaches.length} holding(s) in breach, ${f.watch.length} on watch.`,
    "",
    "## Allocation by sector (share of NAV)",
    ...f.sectors.map((s) => `- ${s.sector}: ${usd(s.valueUsd)} (${pct(s.share)})${s.share > m.maxSectorShare ? " **above the limit**" : ""}`),
    "",
    "## Largest movers this quarter",
    ...f.movers.map((x) => `- ${x.holding.name}: ${usd(x.holding.valuePrevUsd)} → ${usd(x.holding.valueUsd)} (${x.qoq >= 0 ? "+" : ""}${pct(x.qoq)}). ${x.holding.note}`),
    "",
    "## Breaches and watch items",
    ...(f.breaches.length + f.watch.length === 0 ? ["- None."] : [...f.breaches, ...f.watch].map((x) => `- **${x.status === "fail" ? "BREACH" : "WATCH"}** ${x.holding.name}: ${x.checks.filter((c) => c.verdict !== "pass").map((c) => `${c.label.toLowerCase()} ${c.detail}`).join(" ")}`)),
    "",
    "## Holdings",
    "| Holding | Sector | Invested | Value | Quarter | Status |", "|---|---|---|---|---|---|",
    ...f.monitored.map((x) => `| ${x.holding.name} | ${x.holding.sector} | ${usd(x.holding.investedUsd)} | ${usd(x.holding.valueUsd)} | ${x.qoq >= 0 ? "+" : ""}${pct(x.qoq)} | ${x.status === "fail" ? "breach" : x.status === "watch" ? "watch" : "on track"} |`),
  ];
  return lines.join("\n");
}
