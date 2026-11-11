/**
 * Sovereign OS Packs (docs/research/brain-co.md §4). Four domains, six workflows each, written for TIGERIS:
 * each workflow states what it reads, what it checks, who decides and which sovereign layer protects it.
 * Each pack has one worked queue of synthetic items scored by deterministic rules (no model): the recommendation
 * is derived from the rules alone, and a named person decides. Items are fictional and labelled SYNTHETIC.
 */

export type PackKey = "finance" | "health" | "insurance" | "government";
export type LayerKey = "compute" | "data" | "models" | "keys" | "applications" | "people";

export interface Workflow { name: string; does: string; reads: string; checks: string; decides: string; layer: LayerKey; href?: string }
export type Value = string | number | boolean;
export interface Rule { key: string; label: string; blocking?: boolean; test: (f: Record<string, Value>) => boolean; show: (f: Record<string, Value>) => string }
export interface Item { id: string; title: string; f: Record<string, Value> }
export interface Queue { name: string; intro: string; decider: string; columns: { key: string; label: string; fmt?: (v: Value | undefined) => string }[]; rules: Rule[]; items: Item[] }
export interface Pack { key: PackKey; name: string; nameAr: string; icon: string; domain: string; line: string; who: string; workflows: Workflow[]; queue: Queue }

const usdM = (v: Value | undefined) => `$${Number(v).toLocaleString("en-GB")}m`;
const pct = (v: Value | undefined) => `${v}%`;
const yes = (v: Value | undefined) => (v ? "yes" : "no");

export const PACKS: Pack[] = [
  {
    key: "finance", name: "Sovereign Finance", nameAr: "المالية السيادية", icon: "Landmark", domain: "banking",
    line: "For sovereign funds, development banks and the treasury: capital decisions screened against the mandate, prepared for committee and monitored after they are made.",
    who: "Sovereign and development funds, state banks, the finance ministry's treasury",
    workflows: [
      { name: "Mandate screening", does: "Screens each opportunity against the mandate, concentration limits and sanctions before anyone spends time on it.", reads: "Deal teasers, the mandate, current holdings, sanctions lists", checks: "Ticket within limit, concentration after the deal, approved geographies, sanctions and ESG screens", decides: "Investment director", layer: "applications", href: "/fund" },
      { name: "Committee preparation", does: "Builds the committee memo from the data room, with every figure traced to the document it came from.", reads: "Data room, past committee decisions, precedents", checks: "Each figure tied to a source page; past deals with similar terms surfaced", decides: "Investment committee", layer: "data", href: "/fund" },
      { name: "Portfolio exposure", does: "Holds one set of facts for the portfolio and runs shocks against it, such as a Hormuz disruption.", reads: "Holdings, market data packages, the transmission graph", checks: "Exposure by route, commodity and counterparty; value at risk by scenario", decides: "Chief investment officer", layer: "models", href: "/simulator" },
      { name: "Rebalancing inside envelopes", does: "Proposes reallocations that stay inside the committee's pre-approved envelope, so one named person can authorise them.", reads: "Decision envelopes, sleeve targets, scenario outcomes", checks: "Value at risk within the envelope; authoriser role matches", decides: "Governance officer", layer: "applications", href: "/decisions" },
      { name: "Board and stakeholder reporting", does: "Produces board and LP reports in which every number links to its lineage.", reads: "Approved figures, decisions, the Ledger", checks: "No figure without lineage; synthetic data labelled", decides: "Board secretary", layer: "keys", href: "/reports" },
      { name: "Reconciliation and close", does: "Reconciles positions across custodians to one record under the institution's own rules.", reads: "Custodian statements, internal books", checks: "Breaks by size and age; rule version recorded", decides: "Head of finance", layer: "data" },
    ],
    queue: {
      name: "Co-investment screening against the mandate", decider: "Investment director",
      intro: "Six opportunities received this week. Limits: ticket up to $250m; no single sector above 15% of the portfolio after the deal; GCC, Asia and Europe only. A sanctions match blocks.",
      columns: [{ key: "sector", label: "Sector" }, { key: "ticket", label: "Ticket", fmt: usdM }, { key: "region", label: "Region" }, { key: "concAfter", label: "Sector share after", fmt: pct }],
      rules: [
        { key: "sanctions", label: "No sanctions match", blocking: true, test: (f) => !f.sanctionsHit, show: (f) => (f.sanctionsHit ? "match on a counterparty" : "clear") },
        { key: "ticket", label: "Ticket within $250m", test: (f) => Number(f.ticket) <= 250, show: (f) => usdM(f.ticket) },
        { key: "conc", label: "Sector share ≤ 15% after the deal", test: (f) => Number(f.concAfter) <= 15, show: (f) => pct(f.concAfter) },
        { key: "geo", label: "Approved geography", test: (f) => ["GCC", "Asia", "Europe"].includes(String(f.region)), show: (f) => String(f.region) },
        { key: "esg", label: "ESG screen passed", test: (f) => Boolean(f.esg), show: (f) => yes(f.esg) },
      ],
      items: [
        { id: "FIN-101", title: "Desalination platform, minority stake", f: { sector: "Water", ticket: 180, region: "GCC", concAfter: 6.2, esg: true, sanctionsHit: false } },
        { id: "FIN-102", title: "Specialty chemicals carve-out", f: { sector: "Industrials", ticket: 320, region: "Europe", concAfter: 12.4, esg: true, sanctionsHit: false } },
        { id: "FIN-103", title: "Regional tanker fleet", f: { sector: "Shipping", ticket: 140, region: "GCC", concAfter: 9.8, esg: true, sanctionsHit: true } },
        { id: "FIN-104", title: "Data-centre campus, phase 2", f: { sector: "Digital", ticket: 230, region: "GCC", concAfter: 16.1, esg: true, sanctionsHit: false } },
        { id: "FIN-105", title: "Grain terminal concession", f: { sector: "Food security", ticket: 95, region: "Africa", concAfter: 3.1, esg: true, sanctionsHit: false } },
        { id: "FIN-106", title: "Battery materials joint venture", f: { sector: "Energy transition", ticket: 210, region: "Asia", concAfter: 11.0, esg: true, sanctionsHit: false } },
      ],
    },
  },
  {
    key: "health", name: "Sovereign Health", nameAr: "الصحة السيادية", icon: "HeartPulse", domain: "healthcare",
    line: "For the health ministry, national insurers and hospital groups: the administrative work between a patient and their care, kept in the country and decided by clinicians.",
    who: "Health ministry, national health insurer, public hospital groups",
    workflows: [
      { name: "Clinical intake", does: "Reads referrals, claims and correspondence as they arrive, then classifies and routes each one with its key fields.", reads: "Referrals, scanned letters, claim forms", checks: "Patient and provider matched; required fields present", decides: "Intake supervisor", layer: "data" },
      { name: "Prior authorisation", does: "Gathers the evidence for medical necessity against the national guideline and drafts a recommendation. A clinician decides.", reads: "Request, clinical notes, the national guideline", checks: "Guideline criteria met, prior therapy documented, clinician credentialed, statutory clock", decides: "Reviewing clinician", layer: "applications" },
      { name: "Appeals against the clock", does: "Assembles the appeal file and its evidence, then tracks the statutory deadline to the hour.", reads: "Original decision, new evidence, appeal letter", checks: "Deadline, completeness, and that the original reviewer is excluded", decides: "Appeals panel", layer: "people" },
      { name: "Care-gap closure", does: "Finds the proof of care buried in notes, to close quality and screening gaps.", reads: "Encounter notes, lab results, programme criteria", checks: "Evidence matched to each criterion, with its source line", decides: "Quality lead", layer: "data" },
      { name: "Submission completeness", does: "Validates a claim or regulatory submission against the required criteria before it leaves.", reads: "Claim or submission, rule set version", checks: "Each criterion pass or fail, with the rule version recorded", decides: "Revenue cycle lead", layer: "applications" },
      { name: "Payment integrity", does: "Checks claims against policy and coding rules, with a rationale an auditor can follow.", reads: "Claims, the policy, coding edits", checks: "Rule hits with amounts; no model-only findings", decides: "Payment integrity officer", layer: "keys" },
    ],
    queue: {
      name: "Prior authorisation requests", decider: "Reviewing clinician",
      intro: "Six requests waiting. The national guideline requires at least 3 of 4 criteria, documented prior conservative therapy and a credentialed requester. The statutory decision window is 72 hours.",
      columns: [{ key: "service", label: "Service" }, { key: "criteria", label: "Guideline criteria met", fmt: (v) => `${v} of 4` }, { key: "hoursLeft", label: "Hours left", fmt: (v) => `${v} h` }],
      rules: [
        { key: "cred", label: "Requesting clinician credentialed", blocking: true, test: (f) => Boolean(f.credentialed), show: (f) => yes(f.credentialed) },
        { key: "criteria", label: "At least 3 of 4 guideline criteria", test: (f) => Number(f.criteria) >= 3, show: (f) => `${f.criteria} of 4` },
        { key: "prior", label: "Prior conservative therapy documented", test: (f) => Boolean(f.priorTherapy), show: (f) => yes(f.priorTherapy) },
        { key: "clock", label: "Inside the 72-hour window", test: (f) => Number(f.hoursLeft) > 0, show: (f) => `${f.hoursLeft} h left` },
      ],
      items: [
        { id: "HLT-201", title: "Knee MRI after six weeks of pain", f: { service: "Imaging", criteria: 4, priorTherapy: true, credentialed: true, hoursLeft: 51 } },
        { id: "HLT-202", title: "Biologic for moderate psoriasis", f: { service: "Specialty drug", criteria: 2, priorTherapy: true, credentialed: true, hoursLeft: 30 } },
        { id: "HLT-203", title: "Lumbar fusion, single level", f: { service: "Surgery", criteria: 3, priorTherapy: false, credentialed: true, hoursLeft: 12 } },
        { id: "HLT-204", title: "Sleep study, suspected apnoea", f: { service: "Diagnostics", criteria: 4, priorTherapy: true, credentialed: false, hoursLeft: 60 } },
        { id: "HLT-205", title: "Cardiac rehabilitation, 12 sessions", f: { service: "Rehabilitation", criteria: 3, priorTherapy: true, credentialed: true, hoursLeft: 4 } },
        { id: "HLT-206", title: "Insulin pump replacement", f: { service: "Device", criteria: 4, priorTherapy: true, credentialed: true, hoursLeft: -3 } },
      ],
    },
  },
  {
    key: "insurance", name: "Sovereign Insurance", nameAr: "التأمين السيادي", icon: "ShieldCheck", domain: "insurance",
    line: "For national insurers, reinsurers and the regulator: claims, underwriting and capital, with the country's catastrophe exposure kept in view.",
    who: "National insurers and reinsurers, takaful operators, the insurance regulator",
    workflows: [
      { name: "Claims triage", does: "Triages first notice of loss: confirms coverage, sets a starting reserve and flags fraud signals.", reads: "Notice of loss, the policy, prior claims", checks: "Coverage on the loss date, limit, reporting window, fraud signals", decides: "Claims handler", layer: "applications" },
      { name: "Underwriting against guidelines", does: "Reads each submission, applies the underwriting guideline and prices inside the authority.", reads: "Submission, guideline, loss history", checks: "Appetite, limits and the authority level for the price", decides: "Underwriter", layer: "applications" },
      { name: "Reinsurance and capital", does: "Tracks ceded exposure, recoverables and capital against target, including the Gulf catastrophe accumulation.", reads: "Treaties, bordereaux, the capital model", checks: "Recoverables by reinsurer rating; capital ratio against target", decides: "Chief risk officer", layer: "models", href: "/simulator" },
      { name: "Accumulation by chokepoint", does: "Sums marine and energy exposure that passes through Hormuz and Bab el-Mandeb.", reads: "Policies, the movement map, the intelligence graph", checks: "Exposure by route and vessel; shock scenarios", decides: "Head of marine", layer: "data", href: "/map" },
      { name: "Policy servicing", does: "Handles endorsements, renewals and cancellations across channels, with every change on the record.", reads: "Requests, the policy record", checks: "Authority, effective dates, premium change", decides: "Servicing lead", layer: "people" },
      { name: "Reserving and filings", does: "Analyses loss trends for reserves and prepares the regulator's filing.", reads: "Claims triangles, filing template", checks: "Method and assumptions recorded; actuary sign-off required", decides: "Appointed actuary", layer: "keys" },
    ],
    queue: {
      name: "Claims triage, first notice of loss", decider: "Claims handler",
      intro: "Six marine and property claims. Coverage must be active on the loss date; notice within 30 days; more than one fraud signal holds the claim for the special investigations unit. Starting reserve = the claimed amount up to the limit, less the deductible.",
      columns: [{ key: "line", label: "Line" }, { key: "claimed", label: "Claimed", fmt: usdM }, { key: "daysToNotice", label: "Days to notice" }, { key: "reserve", label: "Starting reserve", fmt: usdM }],
      rules: [
        { key: "cover", label: "Coverage active on the loss date", blocking: true, test: (f) => Boolean(f.covered), show: (f) => yes(f.covered) },
        { key: "notice", label: "Notice within 30 days", test: (f) => Number(f.daysToNotice) <= 30, show: (f) => `${f.daysToNotice} days` },
        { key: "fraud", label: "At most one fraud signal", test: (f) => Number(f.fraudSignals) <= 1, show: (f) => `${f.fraudSignals} signal(s)` },
        { key: "limit", label: "Claim within the policy limit", test: (f) => Number(f.claimed) <= Number(f.limit), show: (f) => `${usdM(f.claimed)} of ${usdM(f.limit)}` },
      ],
      items: [
        { id: "INS-301", title: "Cargo damage, container vessel at Jebel Ali", f: { line: "Marine cargo", claimed: 4.2, limit: 10, deductible: 0.25, daysToNotice: 6, fraudSignals: 0, covered: true } },
        { id: "INS-302", title: "Hull damage after Hormuz near-miss", f: { line: "Marine hull", claimed: 18, limit: 15, deductible: 0.5, daysToNotice: 12, fraudSignals: 0, covered: true } },
        { id: "INS-303", title: "Warehouse fire, free zone", f: { line: "Property", claimed: 7.5, limit: 20, deductible: 0.2, daysToNotice: 44, fraudSignals: 1, covered: true } },
        { id: "INS-304", title: "Business interruption, refinery outage", f: { line: "Energy", claimed: 32, limit: 50, deductible: 1, daysToNotice: 9, fraudSignals: 3, covered: true } },
        { id: "INS-305", title: "Delay in start-up, desalination plant", f: { line: "Engineering", claimed: 11, limit: 25, deductible: 0.5, daysToNotice: 15, fraudSignals: 0, covered: false } },
        { id: "INS-306", title: "Loss of hire, tanker held at anchorage", f: { line: "Marine war", claimed: 2.8, limit: 5, deductible: 0.1, daysToNotice: 3, fraudSignals: 0, covered: true } },
      ].map((i) => ({ ...i, f: { ...i.f, reserve: Math.round((Math.min(Number(i.f.claimed), Number(i.f.limit)) - Number(i.f.deductible)) * 100) / 100 } })),
    },
  },
  {
    key: "government", name: "Sovereign Government", nameAr: "الحكومة السيادية", icon: "Building2", domain: "public_sector",
    line: "For ministries, municipalities and authorities: permits, licences, grants and procurement decided faster, under the state's own rules, with a record any auditor can follow.",
    who: "Ministries, municipalities, regulators, procurement authorities",
    workflows: [
      { name: "Permit review", does: "Reads each application, applies the building and zoning code clause by clause and drafts a decision.", reads: "Application, drawings, the code", checks: "Each clause pass or fail with its reference; missing documents", decides: "Permit officer", layer: "applications" },
      { name: "Licensing integrity", does: "Cross-checks licence applications against registries to catch inconsistencies and fraud.", reads: "Application, the commercial registry, prior licences", checks: "Ownership, matching of addresses and directors, prior refusals", decides: "Licensing officer", layer: "data" },
      { name: "Grant evaluation", does: "Scores applications against published criteria and ranks them, giving a reason for every point.", reads: "Applications, the programme criteria", checks: "Eligibility, then a score per criterion with its evidence", decides: "Grants committee", layer: "people" },
      { name: "Procurement award review", does: "Structures the bid review: compliance, local content, price reasonableness, conflicts, then a clear path to award.", reads: "Bids, the tender, the vendor register, sanctions lists", checks: "Registration, local content, price against the estimate, conflicts, sanctions", decides: "Tender committee", layer: "applications" },
      { name: "Emergency disbursement", does: "Verifies eligibility after a disruption and prioritises payments, with each one traceable.", reads: "Claims, registries, damage assessments", checks: "Eligibility, duplicates, priority score", decides: "Disbursement authority", layer: "keys" },
      { name: "Citizen and business services", does: "Routes service requests to the right team and keeps the requester informed.", reads: "Requests across channels", checks: "Routing rule, service level, escalation", decides: "Service manager", layer: "people" },
    ],
    queue: {
      name: "Procurement award review, port equipment tender", decider: "Tender committee",
      intro: "Six bids for a port crane tender. The engineer's estimate is $42m; bids more than 10% from it need justification. Local content must be at least 30%. An unregistered bidder or a sanctions match blocks; a declared conflict of interest goes to the committee.",
      columns: [{ key: "bidder", label: "Bidder" }, { key: "price", label: "Bid", fmt: usdM }, { key: "localContent", label: "Local content", fmt: pct }],
      rules: [
        { key: "reg", label: "Bidder registered", blocking: true, test: (f) => Boolean(f.registered), show: (f) => yes(f.registered) },
        { key: "sanc", label: "Sanctions lists clear", blocking: true, test: (f) => !f.sanctionsHit, show: (f) => (f.sanctionsHit ? "match" : "clear") },
        { key: "local", label: "Local content ≥ 30%", test: (f) => Number(f.localContent) >= 30, show: (f) => pct(f.localContent) },
        { key: "price", label: "Within 10% of the $42m estimate", test: (f) => Math.abs(Number(f.price) - 42) / 42 <= 0.1, show: (f) => `${(((Number(f.price) - 42) / 42) * 100).toFixed(1)}%` },
        { key: "coi", label: "No conflict of interest declared", test: (f) => !f.conflict, show: (f) => (f.conflict ? "declared" : "none") },
      ],
      items: [
        { id: "GOV-401", title: "Bid A", f: { bidder: "Gulf Heavy Lift (fictional)", price: 41.2, localContent: 38, registered: true, sanctionsHit: false, conflict: false } },
        { id: "GOV-402", title: "Bid B", f: { bidder: "Northline Cranes (fictional)", price: 35.9, localContent: 22, registered: true, sanctionsHit: false, conflict: false } },
        { id: "GOV-403", title: "Bid C", f: { bidder: "Peninsula Port Systems (fictional)", price: 44.5, localContent: 41, registered: true, sanctionsHit: false, conflict: true } },
        { id: "GOV-404", title: "Bid D", f: { bidder: "Strait Marine Works (fictional)", price: 39.8, localContent: 33, registered: false, sanctionsHit: false, conflict: false } },
        { id: "GOV-405", title: "Bid E", f: { bidder: "Orient Lifting Co. (fictional)", price: 40.6, localContent: 31, registered: true, sanctionsHit: true, conflict: false } },
        { id: "GOV-406", title: "Bid F", f: { bidder: "Coastal Engineering JV (fictional)", price: 43.1, localContent: 35, registered: true, sanctionsHit: false, conflict: false } },
      ],
    },
  },
];

export type Verdict = { tone: "ok" | "warn" | "crit"; label: string; passed: number; total: number; failed: Rule[] };
/** The recommendation comes from the rules alone: a blocking failure holds, all passing is ready for decision, otherwise more information is needed. */
export function assess(q: Queue, it: Item): Verdict {
  const failed = q.rules.filter((r) => !r.test(it.f));
  const passed = q.rules.length - failed.length;
  if (failed.some((r) => r.blocking)) return { tone: "crit", label: "Hold", passed, total: q.rules.length, failed };
  if (!failed.length) return { tone: "ok", label: "Ready for decision", passed, total: q.rules.length, failed };
  return { tone: "warn", label: "Needs information", passed, total: q.rules.length, failed };
}
export const packByKey = (k: string | null | undefined) => PACKS.find((p) => p.key === k);
