import { authorityFor } from "../config/authority";
import type { Diagnosis } from "./diagnosis";
import type { SimRun } from "./simulation";
import type { Valuation } from "./valuation";

/**
 * Governor question → Decision Brief (brief v3 §6, §12). The AI never produces numbers: a brief may only cite values
 * from the `facts` object, by key. Post-validation rejects any number in the text that does not match a fact (or a
 * small set of structural numbers such as "72-hour" and "5 months"), and any claim without evidence refs.
 * In demo mode the brief is CACHED: built deterministically from the facts, keyed by (promptVersion, inputHash).
 */
export const BRIEF_PROMPT_VERSION = "brief.cached.v1";
export const QUICK_PROMPTS = [
  "Analyze this situation", "What happens next?", "Show me the risks", "Where is the opportunity?", "What assumptions are we making?", "Who has authority?",
  "What requires approval?", "Show me the 72-hour plan", "Show me the five-year implications", "Stress-test this recommendation", "Generate executive brief", "Create decision package",
] as const;

export interface Fact { key: string; label: string; value: number; unit: string; text: string; ref: string }
export type Facts = Record<string, Fact>;
export interface Claim { text: string; evidenceRefs: string[]; confidence: "high" | "medium" | "low" }
export interface DecisionBrief {
  question: string; situation: string;
  effects: { first: Claim[]; second: Claim[]; third: Claim[] };
  options: Array<{ title: string; tradeoffs: string; valueImpactKey: string; riskKey: string }>;
  recommendation: string; authorityRequired: string; approvalThreshold: string;
  plan72h: Array<{ action: string; owner: string; dueHours: number }>;
  fiveYearImplications: string[]; kpis: Array<{ key: string; target: string }>; assumptions: string[];
  meta: { promptVersion: string; model: "cache"; inputHash: string };
}

const pct = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}%`;
const bn = (v: number) => `$${(v / 1e9).toFixed(2)}B`;

/** Facts from the engines, each with its provenance ref (SimulationRun node, gap score, valuation). */
export function buildFacts(sim: SimRun, d: Diagnosis, v: Valuation, aumUsd: number): Facts {
  const f: Facts = {};
  const add = (key: string, label: string, value: number, unit: string, text: string, ref: string) => { f[key] = { key, label, value, unit, text, ref }; };
  for (const n of sim.nodes) {
    const text = n.unit === "%" ? pct(n.value) : n.unit === "pp" ? `${n.value > 0 ? "+" : ""}${n.value.toFixed(2)} pp` : n.unit === "days" ? `${n.value.toFixed(1)} days` : `${n.value.toFixed(0)}/100`;
    add(`sim.${n.id}`, n.label, n.value, n.unit, text, `SimulationRun:${sim.version}:${n.id}`);
  }
  add("sim.brent_usd", "Brent", sim.impact.brentUsd, "usd/bbl", `$${sim.impact.brentUsd.toFixed(1)}/bbl`, `SimulationRun:${sim.version}:impact.brent`);
  add("sim.buffer_days_level", "Buffer days", sim.impact.bufferDays, "days", `${sim.impact.bufferDays.toFixed(0)} days`, `SimulationRun:${sim.version}:impact.buffer`);
  add("sim.shift_pct", "Reallocation", sim.sleeves.shiftPct, "% of mandate", `${sim.sleeves.shiftPct.toFixed(2)}% of the mandate`, `SimulationRun:${sim.version}:sleeves`);
  add("sim.shift_usd", "Reallocation", (sim.sleeves.shiftPct / 100) * aumUsd, "usd", bn((sim.sleeves.shiftPct / 100) * aumUsd), `SimulationRun:${sim.version}:sleeves`);
  add("sim.duration", "Disruption duration", sim.params.durationDays, "days", `${sim.params.durationDays} days`, `SimulationRun:${sim.version}:params`);
  for (const g of d.gaps) if (g.score !== null) add(`gap.${g.key}`, g.name, g.score, "score", g.score.toFixed(1), `GapScore:${d.rubricVersion}:${g.id}`);
  if (d.indices.csai !== null) add("idx.csai", "CSAI", d.indices.csai, "index", d.indices.csai.toFixed(1), `GapScore:${d.rubricVersion}:csai`);
  if (d.indices.coordinationDebt !== null) add("idx.coordination", "Coordination debt", d.indices.coordinationDebt, "index", d.indices.coordinationDebt.toFixed(1), `GapScore:${d.rubricVersion}:1`);
  add("val.base", "Value at stake (base)", v.valueAtStakeUsd.base, "usd", bn(v.valueAtStakeUsd.base), "Valuation:base");
  add("val.ceiling", "Ceiling", v.ceilingUsd, "usd", bn(v.ceilingUsd), "Valuation:ceiling");
  return f;
}

export function inputHash(facts: Facts, question: string) {
  const s = question + "|" + Object.values(facts).map((x) => `${x.key}=${x.value}`).join(";");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The cached brief: every figure in it is a fact's own text, cited by key. */
export function cachedBrief(question: string, F: Facts): DecisionBrief {
  const t = (k: string) => F[k]?.text ?? "n/a";
  const ref = (...ks: string[]) => ks.filter((k) => F[k]).map((k) => F[k]!.ref);
  const shiftPct = F["sim.shift_pct"]?.value ?? 0;
  const auth = authorityFor("reallocation", shiftPct);
  return {
    question,
    situation: `A Hormuz disruption of ${t("sim.duration")} cuts tanker throughput ${t("sim.tanker")} and lifts freight ${t("sim.freight")}; Brent moves ${t("sim.brent")} to ${t("sim.brent_usd")}. Coordination debt stands at ${t("idx.coordination")} with no single owner for the response.`,
    effects: {
      first: [
        { text: `Freight costs rise ${t("sim.freight")} as transits fall ${t("sim.tanker")}.`, evidenceRefs: ref("sim.freight", "sim.tanker"), confidence: "medium" },
        { text: `War-risk insurance moves ${t("sim.warrisk")}; Brent ${t("sim.brent")}.`, evidenceRefs: ref("sim.warrisk", "sim.brent"), confidence: "medium" },
      ],
      second: [
        { text: `Import costs ${t("sim.imports")} and 90-day inflation risk ${t("sim.inflation")}.`, evidenceRefs: ref("sim.imports", "sim.inflation"), confidence: "medium" },
        { text: `Critical-category buffers fall to ${t("sim.buffer_days_level")}; exposed holdings mark ${t("sim.portfolio")}.`, evidenceRefs: ref("sim.buffer_days_level", "sim.portfolio"), confidence: "low" },
        { text: `Oil revenue changes ${t("sim.oilrev")}: higher price, lower volume.`, evidenceRefs: ref("sim.oilrev"), confidence: "low" },
      ],
      third: [
        { text: `Rebalance ${t("sim.shift_pct")} (${t("sim.shift_usd")}) from balanced toward resilience, liquidity and localization.`, evidenceRefs: ref("sim.shift_pct", "sim.shift_usd"), confidence: "medium" },
        { text: `Opportunities: alternative corridors ${t("sim.corridors")}, strategic storage ${t("sim.storage")}, industrial acceleration ${t("sim.industry")}.`, evidenceRefs: ref("sim.corridors", "sim.storage", "sim.industry"), confidence: "low" },
        { text: `Fiscal balance moves ${t("sim.fiscal")}.`, evidenceRefs: ref("sim.fiscal"), confidence: "low" },
      ],
    },
    options: [
      { title: "Rebalance within the standing envelope and name one owner", tradeoffs: "Fast and inside existing authority; smaller than the full modelled need if the disruption lasts longer.", valueImpactKey: "sim.shift_usd", riskKey: "sim.portfolio" },
      { title: "Convene an ad hoc committee", tradeoffs: "Broader mandate; slower, and coordination debt keeps rising while it meets.", valueImpactKey: "val.base", riskKey: "idx.coordination" },
      { title: "Hold and monitor", tradeoffs: "No commitment; buffers keep falling and no owner is named.", valueImpactKey: "sim.buffer_days_level", riskKey: "gap.coordination_debt" },
    ],
    recommendation: `Approve the rebalance of ${t("sim.shift_pct")} inside the standing envelope, name a single accountable owner, and start the 72-hour plan.`,
    authorityRequired: auth.authority,
    approvalThreshold: `${auth.approvals} approval${auth.approvals > 1 ? "s" : ""} (${auth.note.toLowerCase()})`,
    plan72h: [
      { action: "Name the single accountable owner for the Hormuz response", owner: "Governance Officer", dueHours: 4 },
      { action: "Confirm buffer stocks and release priorities for critical categories", owner: "Ministry of Finance liaison", dueHours: 24 },
      { action: "Prepare the sleeve rebalance tickets for approval", owner: "Chief Investment Officer", dueHours: 48 },
      { action: "Open talks on an alternative corridor and storage", owner: "Trade and energy desk", dueHours: 72 },
    ],
    fiveYearImplications: [
      `Corridor and storage capacity become standing capability, not an emergency response (priorities ${t("sim.corridors")} and ${t("sim.storage")}).`,
      `Closing coordination debt from ${t("idx.coordination")} supports the base value at stake of ${t("val.base")}, within a ceiling of ${t("val.ceiling")}.`,
    ],
    kpis: [{ key: "signal_to_owner_days", target: "under 1 day" }, { key: "time_to_governed_action_days", target: "3 days" }],
    assumptions: ["Transmission coefficients are placeholders until sourced.", "Rubric bands are placeholders until the client CTO signs them off.", "Scenario inputs follow the client sandbox narrative; they are not live data."],
    meta: { promptVersion: BRIEF_PROMPT_VERSION, model: "cache", inputHash: inputHash(F, question) },
  };
}

/** Numbers that may appear without being a fact: structural ("72-hour", "5 months", "3%" authority line, step counts). */
const STRUCTURAL = new Set(["1", "2", "3", "4", "5", "24", "48", "72", "90"]);

/** §12.2 post-validation. Returns the problems; an empty list means the brief may be shown. */
export function validateBrief(b: DecisionBrief, F: Facts): string[] {
  const problems: string[] = [];
  const allowed = new Set<string>(STRUCTURAL);
  for (const f of Object.values(F)) for (const m of f.text.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(m);
  for (const m of b.question.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(m);
  const texts = [b.situation, ...b.effects.first.map((c) => c.text), ...b.effects.second.map((c) => c.text), ...b.effects.third.map((c) => c.text), b.recommendation, ...b.fiveYearImplications, ...b.options.map((o) => o.tradeoffs)];
  for (const s of texts) for (const m of s.match(/\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(m)) problems.push(`Number ${m} is not a fact: "${s.slice(0, 80)}"`);
  for (const c of [...b.effects.first, ...b.effects.second, ...b.effects.third]) if (!c.evidenceRefs.length) problems.push(`Claim without evidence: "${c.text.slice(0, 80)}"`);
  for (const o of b.options) for (const k of [o.valueImpactKey, o.riskKey]) if (!F[k]) problems.push(`Option cites unknown fact ${k}`);
  return problems;
}
