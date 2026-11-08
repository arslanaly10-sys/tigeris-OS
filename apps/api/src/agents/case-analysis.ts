import { randomUUID } from "node:crypto";
import type { Tx } from "../db";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import type { Actor, Classification } from "../ai/gateway";
import type { ProviderKey } from "../ai/providers";
import type { CheckedSentence, Source } from "../ai/verify";
import { impactPaths } from "../graph/traverse";
import { buildPayload, engine, persistRun, type EngineResult } from "../routes/scenarios";
import { AGENT_NAME, SECTOR_LENS } from "./registry";
import { finishRun, fmtNum, fmtUsd, sourceList, startRun, step, type RunCtx } from "./runtime";

/**
 * Case analysis (FR-17..FR-24, Q060..Q067): ten bounded agents in five phases.
 *   gather    triage, noise moderation, entity resolution, document extraction
 *   analyse   causal impact, financial impact, sector lens, scenario comparison
 *   challenge agents contest each other's claims; each challenge is accepted or rebutted with a reason
 *   recommend options measured with the scenario engine, ranked, then governance-checked
 *   compose   the executive brief, built only from checked step outputs
 */
type Level = "low" | "medium" | "high";
const RANK: Record<Level, number> = { low: 0, medium: 1, high: 2 };
const LEVELS: Level[] = ["low", "medium", "high"];
const URG: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export interface Challenge { id: string; challenger: string; target: string; claim: string; contention: string; response: string; status: "accepted" | "rebutted"; effect: string }

interface OptionSpec { key: string; title: string; description: string; change: (d: Record<string, number>) => Record<string, number>; burden: number; owner: string; authority: string; constraints: string[]; basis: string }

const OPTIONS: Record<string, OptionSpec> = {
  hold: { key: "hold", title: "Hold and monitor", description: "Make no change now; keep the case open and re-run the analysis when new evidence arrives.", change: () => ({}), burden: 0, owner: "analyst", authority: "Case owner", constraints: ["Exposure stays as modelled in the baseline"], basis: "No driver changes" },
  reroute: { key: "reroute", title: "Shift exports and imports to bypass routes", description: "Use pipeline bypass capacity and alternative ports to move more volume around the disrupted route.", change: (d) => ({ route_availability_pct: Math.min(100, d.route_availability_pct! + 15) }), burden: 6, owner: "operations_owner", authority: "Executive committee", constraints: ["Bypass capacity is shared with other exporters", "Port slots must be secured by the operations owner"], basis: "Assumed: rerouting adds 15 percentage points of route availability" },
  reserves: { key: "reserves", title: "Extend strategic reserve cover", description: "Draw on and replenish strategic stocks to hold staple and fuel cover through the disruption.", change: (d) => ({ reserve_buffer_days: Math.min(365, d.reserve_buffer_days! + 30) }), burden: 5, owner: "operations_owner", authority: "Executive committee", constraints: ["Replenishment cost is not in the engine", "Storage capacity limits must be confirmed"], basis: "Assumed: 30 more days of reserve cover" },
  insurance_pool: { key: "insurance_pool", title: "Back a war-risk insurance facility", description: "Support a facility that caps war-risk premiums for national tankers so transits continue.", change: (d) => ({ insurance_premium_pct: Math.max(0, d.insurance_premium_pct! - 0.4), route_availability_pct: Math.min(100, d.route_availability_pct! + 5) }), burden: 7, owner: "approver", authority: "Board investment committee", constraints: ["Creates a contingent liability", "Needs insurer and regulator agreement"], basis: "Assumed: premium 0.4 points lower and 5 points more transits" },
  demand: { key: "demand", title: "Coordinate demand restraint with partners", description: "Agree temporary demand measures with partners to soften the price spike.", change: (d) => ({ demand_change_pct: Math.max(-30, d.demand_change_pct! - 3) }), burden: 5, owner: "executive", authority: "Executive committee", constraints: ["Depends on partner agreement", "Effect on prices is an assumption"], basis: "Assumed: demand 3% lower" },
  hedge_price: { key: "hedge_price", title: "Hedge oil revenue for the next year", description: "Lock in prices for part of export revenue to limit the effect of a sustained low price.", change: (d) => ({ oil_price_usd: Math.min(200, d.oil_price_usd! + 10) }), burden: 4, owner: "analyst", authority: "Board investment committee", constraints: ["Hedge cost and counterparty limits are not in the engine", "Gives up upside if prices recover"], basis: "Assumed: hedged volumes realise USD 10 per barrel above the stress price" },
  hedge_rates: { key: "hedge_rates", title: "Hedge rate and FX exposure", description: "Reduce sensitivity of rate-linked holdings to the funding shock.", change: (d) => ({ rate_shock_bps: Math.round(d.rate_shock_bps! * 0.6) }), burden: 4, owner: "analyst", authority: "Board investment committee", constraints: ["Hedge cost is not in the engine"], basis: "Assumed: hedging removes 40% of the rate shock" },
  liquidity: { key: "liquidity", title: "Provide term liquidity to affected holdings", description: "Offer term funding lines to bank holdings to bridge the stress period.", change: (d) => ({ rate_shock_bps: Math.round(d.rate_shock_bps! * 0.75) }), burden: 6, owner: "approver", authority: "Board investment committee", constraints: ["Concentrates exposure to the banking sector", "Needs central bank coordination"], basis: "Assumed: funding lines remove 25% of the rate shock" },
};
const TEMPLATE_OPTIONS: Record<string, string[]> = {
  hormuz: ["hold", "reroute", "reserves", "insurance_pool", "demand"],
  resilience: ["hold", "reserves", "reroute", "insurance_pool"],
  oil45: ["hold", "hedge_price", "hedge_rates"],
  red_sea: ["hold", "reroute", "insurance_pool", "reserves"],
  banking: ["hold", "hedge_rates", "liquidity"],
  food: ["hold", "reserves", "reroute", "demand"],
  pandemic: ["hold", "reserves", "reroute", "hedge_rates"],
};

const metric = (r: EngineResult, key: string, h: string) => r.results.find((x) => x.key === key && x.horizon === h);

export async function startCaseAnalysis(inst: string, actor: Actor, caseKey: string, provider: ProviderKey): Promise<{ runId: string } | { error: string; status: number }> {
  const c = await withTenant(inst, async (tx) => {
    const row = (await tx.query("SELECT id, case_key, sensitivity FROM cases WHERE case_key = $1", [caseKey])).rows[0];
    if (!row) return null;
    const busy = (await tx.query("SELECT id FROM agent_runs WHERE case_id = $1 AND kind = 'case_analysis' AND status = 'running' AND started_at > now() - interval '15 minutes'", [row.id])).rows[0];
    return { ...row, busy: busy?.id as string | undefined };
  });
  if (!c) return { error: "No such case.", status: 404 };
  if (c.busy) return { error: "An analysis is already running for this case.", status: 409 };
  const runId = await startRun(inst, actor, { kind: "case_analysis", caseId: c.id, provider });
  const ctx: RunCtx = { inst, actor, runId, caseId: c.id, provider, classification: (c.sensitivity === "secret" ? "secret" : c.sensitivity) as Classification, seq: 0 };
  void runCaseAnalysis(ctx).catch(async (err) => {
    await finishRun(ctx, "failed", {}, err instanceof Error ? err.message : String(err)).catch(() => {});
  });
  return { runId };
}

async function caseRow(tx: Tx, id: string) {
  return (await tx.query("SELECT id, case_key, title, objective, domain, situation, scenario_template, sensitivity FROM cases WHERE id = $1", [id])).rows[0];
}

export async function runCaseAnalysis(ctx: RunCtx) {
  const caseId = ctx.caseId!;

  // ---------------- gather ----------------
  const triage = await step(ctx, { agent: "signal_triage", phase: "gather", title: "Rank the signals behind this case" }, async (tx, tools) => {
    const c = await caseRow(tx, caseId);
    const direct = await tools.run("case.signals", { case: c.case_key }, async () => (await tx.query("SELECT s.id, s.title, s.summary, s.urgency, s.impact, s.data_mode, s.confidence, s.event_time, 'attached' AS link FROM case_signals cs JOIN signals s ON s.id = cs.signal_id WHERE cs.case_id = $1", [caseId])).rows, (r) => `${r.length} signal(s) attached`);
    const related = await tools.run("signal.related_by_graph", { case: c.case_key }, async () => (await tx.query(
      `SELECT DISTINCT s.id, s.title, s.summary, s.urgency, s.impact, s.data_mode, s.confidence, s.event_time, 'shares an entity' AS link FROM signals s JOIN signal_entities se ON se.signal_id = s.id
        WHERE se.entity_id IN (SELECT entity_id FROM case_entities WHERE case_id = $1) AND s.id NOT IN (SELECT signal_id FROM case_signals WHERE case_id = $1) AND s.status <> 'dismissed' LIMIT 4`, [caseId])).rows, (r) => `${r.length} related signal(s) through shared entities`);
    const all = [...direct, ...related].map((s) => ({ ...s, band: (s.confidence?.band ?? "low") as Level, score: URG[s.urgency]! * 2 + RANK[s.impact as Level] + 1 + RANK[(s.confidence?.band ?? "low") as Level] + (s.link === "attached" ? 1 : 0) }));
    all.sort((a, b) => b.score - a.score);
    const sources = sourceList(all.length ? all.slice(0, 5).map((s) => ({ kind: "signal", ref: s.id, label: `Signal (${s.link})`, text: `"${s.title}". Urgency ${s.urgency}, impact ${s.impact}, confidence ${s.band}, ${s.data_mode} data.` }))
      : [{ kind: "case", ref: caseId, label: "Case objective", text: c.objective }]);
    return { sources, output: { ranked: all.map((s, i) => ({ rank: i + 1, id: s.id, title: s.title, urgency: s.urgency, impact: s.impact, band: s.band, data_mode: s.data_mode, link: s.link, score: s.score })) } };
  }, {
    instruction: "The sources are in ranked order and S1 ranks highest. Name the S1 signal by its title and say why it matters most for this case, using its urgency, impact and confidence.",
    fallback: (src, o) => o.ranked.length
      ? `The highest-priority input is "${o.ranked[0]!.title}", with ${o.ranked[0]!.urgency} urgency and ${o.ranked[0]!.band} confidence [S1].` + (o.ranked.length > 1 ? ` The next is "${o.ranked[1]!.title}" [S2].` : "")
      : `No signal is linked to this case; it was opened from an analyst question [S1].`,
  });

  const noise = await step(ctx, { agent: "noise_moderation", phase: "gather", title: "Flag inputs that should not be relied on alone" }, async (tx, tools) => {
    const flags: Array<{ kind: string; label: string; reason: string; ref: string | null }> = [];
    for (const s of triage.output.ranked) {
      if (s.data_mode !== "observed") flags.push({ kind: "signal", ref: s.id, label: s.title, reason: `${s.data_mode} data, labelled as such; not a live observation` });
    }
    const warn = await tools.run("evidence.validation", { case: caseId }, async () => (await tx.query("SELECT e.id, e.title, e.validation_state FROM case_evidence ce JOIN evidence_objects e ON e.id = ce.evidence_id WHERE ce.case_id = $1 AND e.validation_state <> 'accepted'", [caseId])).rows, (r) => `${r.length} case evidence record(s) with warnings`);
    for (const w of warn) flags.push({ kind: "evidence", ref: w.id, label: w.title, reason: `validation ${w.validation_state}` });
    const quarantined = await tools.run("evidence.quarantine", {}, async () => (await tx.query("SELECT e.id, e.title FROM evidence_objects e WHERE e.validation_state = 'quarantined' ORDER BY e.created_at DESC LIMIT 3")).rows, (r) => `${r.length} quarantined document(s) in the institution`);
    for (const q of quarantined) flags.push({ kind: "evidence", ref: q.id, label: q.title, reason: "quarantined by validation; excluded from every agent and model" });
    const sources = sourceList(flags.length ? [{ kind: "tool", ref: null, label: "Noise check result", text: `${flags.length} input(s) flagged: ${flags.filter((f) => f.kind === "signal").length} simulated or synthetic signal(s), ${quarantined.length} quarantined document(s).` }, ...flags.map((f) => ({ kind: f.kind, ref: f.ref, label: `Flagged ${f.kind}`, text: `"${f.label}": ${f.reason}.` }))] : [{ kind: "note", ref: null, label: "Noise check", text: "All inputs to this case are observed data with accepted validation." }]);
    return { sources, output: { flags, simulatedOrSynthetic: flags.filter((f) => f.kind === "signal").length, quarantined: quarantined.map((q) => q.title) } };
  }, {
    instruction: "Say which inputs are simulated, synthetic or quarantined and therefore must not be the sole basis for a decision.",
    fallback: (src, o) => o.flags.length
      ? `${o.flags.length} input(s) are flagged, starting with "${o.flags[0]!.label}" [S1][S2].` + (o.quarantined.length ? ` Quarantined document "${o.quarantined[0]}" is excluded from all analysis [S${o.flags.findIndex((f) => f.label === o.quarantined[0]) + 2}].` : "")
      : "All inputs to this case are observed data with accepted validation [S1].",
  });

  const resolution = await step(ctx, { agent: "entity_resolution", phase: "gather", title: "Match names in the inputs to graph entities" }, async (tx, tools) => {
    const texts = triage.output.ranked.map((s) => s.title).join(" ");
    const c = await caseRow(tx, caseId);
    const full = `${texts} ${c.situation ?? ""}`;
    const matched = await tools.run("graph.aliases", { textChars: full.length }, async () => (await tx.query(
      `SELECT DISTINCT ON (e.id) e.id, e.key, e.name, e.type, coalesce(a.alias, e.name) AS matched_on FROM entities e LEFT JOIN entity_aliases a ON a.entity_id = e.id
        WHERE e.type NOT IN ('holding','vessel','mandate') AND (position(regexp_replace(lower(e.name), '[[:space:]]+(port|terminal|refinery|field|plant|complex|hub|[(]fictional[)])$', '') in lower($1)) > 0 AND length(e.name) >= 4 OR (a.alias IS NOT NULL AND length(a.alias) >= 4 AND position(lower(a.alias) in lower($1)) > 0)) LIMIT 12`, [full])).rows, (r) => `${r.length} entity match(es)`);
    const stop = new Set(["The", "A", "An", "GCC", "Synthetic", "Simulated", "Gulf", "Sanctions", "OFAC", "UK", "Asian", "Container", "Wheat", "Overnight", "War", "Asia", "Europe", "Red", "Sea", "This", "Oil", "Institutional"]);
    const names = [...new Set([...full.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g)].map((m) => m[1]!))].filter((n) => !n.split(" ").every((w) => stop.has(w)));
    const bare = (x: string) => x.toLowerCase().replace(/\s+(port|terminal|refinery|field|plant|complex|hub|\(fictional\))$/, "");
    const unresolved = names.filter((n) => !matched.some((m) => n.toLowerCase().includes(bare(m.name)) || bare(m.name).includes(n.toLowerCase()) || n.toLowerCase().includes(String(m.matched_on).toLowerCase())));
    const sources = sourceList([
      { kind: "tool", ref: null, label: "Entity resolution result", text: `${matched.length} names matched to graph entities; ${unresolved.length} name(s) unresolved.` },
      ...matched.slice(0, 6).map((m) => ({ kind: "entity", ref: m.key, label: "Matched entity", text: `"${m.matched_on}" matched ${m.name} (${m.type}) in the graph.` })),
      ...unresolved.slice(0, 3).map((n) => ({ kind: "note", ref: null, label: "Unresolved name", text: `"${n}" has no entity in the graph.` })),
    ]);
    return { sources: sources.length ? sources : sourceList([{ kind: "note", ref: null, label: "Entity check", text: "No place or organisation names were found in the inputs." }]), output: { matched: matched.map((m) => ({ key: m.key, name: m.name, type: m.type })), unresolved } };
  }, {
    instruction: "Say which names were matched to graph entities and which could not be matched.",
    fallback: (src, o) => (o.matched.length ? `${o.matched.length} names were matched to graph entities, including ${o.matched[0]!.name} [S1][S2].` : "No names were matched to graph entities [S1].") + (o.unresolved.length ? ` "${o.unresolved[0]}" is not in the graph [S${Math.min(o.matched.length, 6) + 2}].` : ""),
  });

  const extraction = await step(ctx, { agent: "document_extraction", phase: "gather", title: "Summarise the facts extracted from the evidence" }, async (tx, tools) => {
    const facts = await tools.run("evidence.facts", { case: caseId }, async () => {
      const attached = (await tx.query(`SELECT f.id, f.subject_label, f.predicate_label, f.value_num, f.value_text, f.unit, f.period, f.claim_class, s.name AS source FROM case_evidence ce JOIN evidence_facts f ON f.id = ce.fact_id JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id WHERE ce.case_id = $1 LIMIT 6`, [caseId])).rows;
      const used = (await tx.query(`SELECT f.id, f.subject_label, f.predicate_label, f.value_num, f.value_text, f.unit, f.period, f.claim_class, s.name AS source FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
        WHERE s.key = 'eia.chokepoints' AND e.duplicate_of IS NULL AND f.predicate IN ('oil_transit_flow','share_global_liquids_consumption','bypass_capacity_available') ORDER BY f.created_at DESC LIMIT 3`)).rows;
      return [...attached, ...used.filter((u) => !attached.some((a) => a.id === u.id))];
    }, (r) => `${r.length} fact(s) with lineage`);
    const sources = sourceList(facts.map((f) => ({ kind: "fact", ref: f.id, label: `${f.source} (${f.claim_class})`, text: `${f.predicate_label} for ${f.subject_label}${f.period ? ` (${f.period})` : ""}: ${f.value_num !== null ? fmtNum(Number(f.value_num), 2) : f.value_text}${f.unit ? ` ${f.unit}` : ""}.` })));
    return { sources: sources.length ? sources : sourceList([{ kind: "note", ref: null, label: "Evidence", text: "No extracted facts are attached to this case yet." }]), output: { facts: facts.map((f) => ({ id: f.id, label: `${f.predicate_label} · ${f.subject_label}`, value: f.value_num, unit: f.unit, period: f.period, claimClass: f.claim_class, source: f.source })) } };
  }, {
    instruction: "Summarise the most important extracted facts and where they come from.",
    fallback: (src, o) => o.facts.length ? `${o.facts[0]!.label} is ${fmtNum(Number(o.facts[0]!.value), 2)}${o.facts[0]!.unit ? ` ${o.facts[0]!.unit}` : ""}, from ${o.facts[0]!.source} [S1].` + (o.facts[1] ? ` ${o.facts[1].label} is ${fmtNum(Number(o.facts[1].value), 2)}${o.facts[1].unit ? ` ${o.facts[1].unit}` : ""} [S2].` : "") : "No extracted facts are attached to this case yet [S1].",
  });

  // ---------------- analyse ----------------
  const causal = await step(ctx, { agent: "causal_impact", phase: "analyse", title: "Trace propagation through the graph" }, async (tx, tools) => {
    const origin = (await tx.query("SELECT e.key, e.name FROM case_entities ce JOIN entities e ON e.id = ce.entity_id WHERE ce.case_id = $1 AND ce.role = 'origin' ORDER BY (e.type = 'chokepoint') DESC LIMIT 1", [caseId])).rows[0] ?? { key: "chokepoint:hormuz", name: "Strait of Hormuz" };
    const paths = await tools.run("graph.impact_paths", { from: origin.key, maxDepth: 4 }, () => impactPaths(tx, origin.key, { maxDepth: 4, maxNodes: 400 }), (r) => `${r?.hops.length ?? 0} reachable entities`);
    const hops = (paths?.hops ?? []).filter((h) => h.depth > 0);
    const names = new Map(hops.map((h) => [h.entity.key, h.entity.name]));
    names.set(origin.key, origin.name);
    const holdings = hops.filter((h) => h.entity.type === "holding").sort((a, b) => b.cumulativeWeight - a.cumulativeWeight);
    const byType: Record<string, number> = {};
    for (const h of hops) byType[h.entity.type] = (byType[h.entity.type] ?? 0) + 1;
    const weak = hops.filter((h) => ["inferred", "assumed", "synthetic"].includes(h.via.class)).length;
    const top = [...holdings.slice(0, 3), ...hops.filter((h) => ["country", "mandate", "commodity"].includes(h.entity.type)).slice(0, 2)];
    const sources = sourceList([
      { kind: "graph", ref: origin.key, label: "Impact traversal", text: `From ${origin.name}, ${hops.length} entities are reachable within 4 steps, including ${holdings.length} holdings and ${byType.country ?? 0} countries.` },
      ...top.map((h) => ({ kind: "relationship", ref: h.via.relationshipId, label: `Path to ${h.entity.name}`, text: `${[...h.path, h.entity.key].map((k) => names.get(k) ?? k).join(" → ")}; path strength ${h.cumulativeWeight.toFixed(2)}; last link "${h.via.label}" is ${h.via.class} with ${h.via.evidenceCount} evidence record(s).` })),
    ]);
    return { sources, output: { origin, reachable: hops.length, holdings: holdings.length, byType, weakShare: hops.length ? weak / hops.length : 0, topHoldings: holdings.slice(0, 5).map((h) => ({ key: h.entity.key, name: h.entity.name, strength: h.cumulativeWeight })) } };
  }, {
    instruction: "Explain how the event reaches the institution's holdings and the countries it depends on.",
    fallback: (src, o) => `From ${o.origin.name}, ${o.reachable} entities are reachable within 4 steps, including ${o.holdings} holdings [S1].` + (o.topHoldings[0] ? ` The strongest path reaches ${o.topHoldings[0].name} with path strength ${o.topHoldings[0].strength.toFixed(2)} [S2].` : ""),
  });

  const financial = await step(ctx, { agent: "financial_impact", phase: "analyse", title: "Read value at risk and revenue effects from the engine" }, async (tx, tools) => {
    let group = (await tx.query("SELECT group_id FROM scenario_runs WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1", [caseId])).rows[0]?.group_id as string | undefined;
    let ranBaseline = false;
    if (!group) {
      const c = await caseRow(tx, caseId);
      group = await tools.run("scenario.run_baseline", { template: c.scenario_template }, async () => {
        const { payload, snapshot } = await buildPayload(tx, c);
        const g = randomUUID();
        const t0 = Date.now();
        const input = { ...payload, drivers: {} };
        const r = await engine<EngineResult>("/scenarios/run", input);
        await persistRun(tx, ctx.inst, caseId, g, "baseline", "Baseline (run by the agents)", input, snapshot, r, Date.now() - t0, { id: ctx.actor.id, label: `Agents for ${ctx.actor.label}` });
        await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'scenario_run',$3,$4,$5,$6)", [ctx.inst, caseId, ctx.actor.id, `Agents for ${ctx.actor.label}`, ctx.actor.role, JSON.stringify({ groupId: g, variants: ["Baseline (run by the agents)"] })]);
        await appendAudit(tx, ctx.inst, { actorType: "service", actorId: ctx.actor.id, actorLabel: `Financial impact agent (for ${ctx.actor.label})`, actorRole: ctx.actor.role, action: "scenario.run", resourceType: "scenario_group", resourceId: g, caseId, details: { variants: 1, template: c.scenario_template, by: "agent_run", runId: ctx.runId } });
        return g;
      }, () => "No scenario on the case; baseline run with template drivers");
      ranBaseline = true;
    }
    const base = await tools.run("scenario.latest", { group }, async () => (await tx.query("SELECT id, name, payload, resilience, top_exposures, sensitivity FROM scenario_runs WHERE group_id = $1 AND variant = 'baseline'", [group])).rows[0], (r) => `baseline "${r.name}"`);
    const res = (await tx.query("SELECT id, key, label, horizon, unit, value, p10, p90 FROM scenario_results WHERE run_id = $1", [base.id])).rows;
    const get = (k: string, h: string) => res.find((r) => r.key === k && r.horizon === h);
    const fmt = (r: { unit: string; value: number }) => (r.unit === "USD" ? fmtUsd(r.value) : `${fmtNum(r.value, 1)} ${r.unit}`);
    const picks = [get("portfolio_value_at_risk_usd", "90d"), get("gcc_export_revenue_change_usd", "1y"), get("avg_oil_price_usd", "72h"), get("avg_net_shortfall_mbd", "72h")].filter(Boolean) as Array<{ id: string; label: string; horizon: string; unit: string; value: number; p10: number | null; p90: number | null }>;
    const hz: Record<string, string> = { "72h": "the first 72 hours", "90d": "90 days", "1y": "one year", "5y": "five years" };
    const sources = sourceList([
      // One figure per source line: small models mix up values and ranges that share a line.
      ...picks.flatMap((p) => [
        { kind: "scenario_result", ref: p.id, label: `Scenario "${base.name}"`, text: `${p.label} over ${hz[p.horizon]}: ${fmt(p)}.` },
        ...(p.p10 !== null && p.p90 !== null && p.horizon === "90d" ? [{ kind: "scenario_result", ref: p.id, label: `Range for ${p.label.toLowerCase()}`, text: `The P10 to P90 range of ${p.label.toLowerCase()} over ${hz[p.horizon]} is ${fmt({ unit: p.unit, value: p.p10 })} to ${fmt({ unit: p.unit, value: p.p90 })}.` }] : []),
      ]),
      { kind: "scenario_run", ref: base.id, label: "Resilience score", text: `Structural resilience score ${fmtNum(Number(base.resilience.score), 0)} out of 100.` },
      ...(base.top_exposures as Array<{ name: string; value_usd: number; path_strength: number }>).slice(0, 2).map((e) => ({ kind: "scenario_run", ref: base.id, label: "Top exposure", text: `${e.name}: ${fmtUsd(e.value_usd)} held, path strength ${e.path_strength.toFixed(2)}.` })),
    ]);
    return { sources, output: { group, baselineRunId: base.id, baselineName: base.name, ranBaseline, payload: base.payload, resilience: base.resilience, var90: get("portfolio_value_at_risk_usd", "90d"), sensitivity: base.sensitivity } };
  }, {
    instruction: "Report the 90-day value at risk with its range, and the one-year export revenue change.",
    fallback: (src) => src.slice(0, 3).map((s, i) => `${s.text.replace(/\.$/, "")} [S${i + 1}].`).join(" "),
    maxSentences: 3, maxTokens: 200,
  });

  const c0 = await withTenant(ctx.inst, (tx) => caseRow(tx, caseId));
  const lens = SECTOR_LENS[c0.domain] ?? SECTOR_LENS.energy!;
  const focus: Record<string, string[]> = { energy: ["alternatives", "impact"], infrastructure: ["buffers", "recovery"], supply_chain: ["buffers", "alternatives"], food: ["buffers", "alternatives"], banking: ["impact", "concentration"], sovereign_capital: ["impact", "concentration"], insurance: ["alternatives", "recovery"] };
  const sector = await step(ctx, { agent: "sector", agentName: lens.name, phase: "analyse", title: `${lens.name}: ${lens.focus}` }, async (tx, tools) => {
    const comps = (financial.output.resilience.components as Array<{ key: string; label: string; score: number; basis: string }>);
    const chosen = await tools.run("domain.facts", { domain: c0.domain, components: focus[c0.domain] ?? focus.energy }, async () => comps.filter((x) => (focus[c0.domain] ?? focus.energy!).includes(x.key)), (r) => `${r.length} resilience component(s) for the ${c0.domain} lens`);
    const sources = sourceList(chosen.map((x) => ({ kind: "scenario_run", ref: financial.output.baselineRunId, label: `Resilience: ${x.label}`, text: `${x.label} scores ${fmtNum(x.score, 0)} out of 100. ${x.basis}.` })));
    return { sources, output: { lens: lens.name, components: chosen } };
  }, {
    instruction: `Give the ${lens.focus} view of this event in plain terms.`,
    fallback: (src) => src.map((s, i) => `${s.text.split(". ")[0]} [S${i + 1}].`).join(" "),
  });

  const compare = await step(ctx, { agent: "scenario_analyst", phase: "analyse", title: "Compare the baseline with the alternatives" }, async (tx, tools) => {
    const runs = await tools.run("scenario.compare", { group: financial.output.group }, async () => (await tx.query("SELECT r.id, r.variant, r.name, (r.resilience->>'score')::float AS score, (SELECT value FROM scenario_results WHERE run_id = r.id AND key = 'portfolio_value_at_risk_usd' AND horizon = '90d') AS var90 FROM scenario_runs r WHERE r.group_id = $1 ORDER BY r.variant", [financial.output.group])).rows, (r) => `${r.length} variant(s) in the comparison`);
    const sens = await tools.run("scenario.sensitivity", { run: financial.output.baselineRunId }, async () => (financial.output.sensitivity as Array<{ label: string; low: number; high: number; spread: number }>).slice(0, 3), (r) => `top ${r.length} drivers by spread`);
    const sources = sourceList([
      ...runs.map((r) => ({ kind: "scenario_run", ref: r.id, label: `Variant: ${r.name}`, text: `"${r.name}": 90-day value at risk ${fmtUsd(Number(r.var90))}; resilience ${fmtNum(r.score, 0)} out of 100.` })),
      ...sens.map((s) => ({ kind: "scenario_run", ref: financial.output.baselineRunId, label: "Sensitivity", text: `Varying ${s.label.toLowerCase()} down and up gives a 90-day value at risk of ${fmtUsd(s.low)} and ${fmtUsd(s.high)}.` })),
    ]);
    return { sources, output: { variants: runs, topDrivers: sens } };
  }, {
    instruction: "Say how the alternatives differ from the baseline and which driver matters most.",
    fallback: (src, o) => (o.variants.length > 1 ? `${src[1]!.text.replace(/\.$/, "")} [S2].` : `Only the baseline has been run for this case [S1].`) + (o.topDrivers[0] ? ` ${o.topDrivers[0].label} is the driver that moves value at risk most [S${o.variants.length + 1}].` : ""),
  });

  // ---------------- challenge (debate) ----------------
  const debate = await step(ctx, { agent: "governance_checker", phase: "challenge", title: "Agents challenge each other's claims" }, async (tx, tools) => {
    const challenges: Challenge[] = [];
    const add = (c: Omit<Challenge, "id">) => challenges.push({ id: `C${challenges.length + 1}`, ...c });
    const topSignal = triage.output.ranked[0];
    if (topSignal && topSignal.data_mode !== "observed") add({ challenger: "noise_moderation", target: "signal_triage", claim: `"${topSignal.title}" ranks first.`, contention: `It is ${topSignal.data_mode} data, not a live observation.`, response: "Accepted. It stays as context but cannot be the only basis for a decision; evidence quality is capped at medium.", status: "accepted", effect: "Evidence quality capped at medium" });
    const param = await tools.run("scenario.assumptions", { run: financial.output.baselineRunId }, async () => (await tx.query("SELECT label, value_num, unit, basis FROM scenario_assumptions WHERE run_id = $1 AND key = 'param.price_premium_usd_per_pct'", [financial.output.baselineRunId])).rows[0], (r) => (r ? `price response ${r.value_num} ${r.unit}` : "no price parameter"));
    if (param) add({ challenger: "sector", target: "financial_impact", claim: "Value at risk and revenue figures are reported.", contention: `They depend on the price response of ${param.value_num} ${param.unit}, which is ${String(param.basis).toLowerCase()}.`, response: "Accepted. Figures are shown as scenario outputs with their P10–P90 range, and model calibration is rated low until back-testing.", status: "accepted", effect: "Model calibration rated low" });
    if (causal.output.weakShare > 0.3) add({ challenger: "governance_checker", target: "causal_impact", claim: `${causal.output.holdings} holdings are reachable from ${causal.output.origin.name}.`, contention: `${Math.round(causal.output.weakShare * 100)}% of the links on these paths are inferred, assumed or synthetic rather than sourced.`, response: "Accepted in part. Sourced links carry the strongest paths; weaker links are shown with their class and lower graph support.", status: "accepted", effect: "Graph support lowered one step" });
    const v = financial.output.var90 as { value: number; p10: number | null; p90: number | null } | undefined;
    if (v && v.p10 !== null && v.p90 !== null && Math.abs(v.p90) > 2 * Math.max(1, Math.abs(v.p10))) add({ challenger: "scenario_analyst", target: "financial_impact", claim: `90-day value at risk is ${fmtUsd(v.value)}.`, contention: `The P10–P90 range runs from ${fmtUsd(v.p10)} to ${fmtUsd(v.p90)}, so the single value is fragile.`, response: "Rebutted for ranking purposes. Options are compared on the same draws, and each option's effect is reported at the deterministic value with the range shown.", status: "rebutted", effect: "Range shown with every option" });
    if (c0.scenario_template === "red_sea") add({ challenger: "governance_checker", target: "financial_impact", claim: "Red Sea flows drive the shortfall.", contention: "The Red Sea flow of 8.6 mb/d is an assumption, not a sourced fact.", response: "Accepted. It stays labelled as an assumption until a sourced figure is in the evidence base.", status: "accepted", effect: "Evidence quality capped at medium" });
    if (resolution.output.unresolved.length) add({ challenger: "entity_resolution", target: "causal_impact", claim: "Propagation covers the names in the inputs.", contention: `"${resolution.output.unresolved[0]}" is not in the graph, so it cannot be traced.`, response: "Accepted. It is listed as an open question for an analyst to add to the graph.", status: "accepted", effect: "Open question added" });
    if (noise.output.quarantined.length) add({ challenger: "noise_moderation", target: "document_extraction", claim: "All relevant documents were read.", contention: `"${noise.output.quarantined[0]}" was quarantined for instruction-like text.`, response: "Confirmed. It was excluded before any agent or model could read it.", status: "accepted", effect: "No effect on outputs" });
    const sources = sourceList(challenges.length ? [{ kind: "tool", ref: null, label: "Debate result", text: `${challenges.length} challenges raised: ${challenges.filter((c) => c.status === "accepted").length} accepted, ${challenges.filter((c) => c.status === "rebutted").length} rebutted.` }, ...challenges.map((c) => ({ kind: "challenge", ref: c.id, label: `${AGENT_NAME[c.challenger] ?? c.challenger} challenges ${AGENT_NAME[c.target] ?? c.target}`, text: `${c.contention} Response: ${c.response}` }))] : []);
    return { sources: sources.length ? sources : sourceList([{ kind: "note", ref: null, label: "Debate", text: "No agent raised a challenge." }]), output: { challenges } };
  }, {
    instruction: "Summarise the challenges the agents raised against each other and how they were resolved.",
    fallback: (src, o) => o.challenges.length ? `${o.challenges.length} challenges were raised; ${o.challenges.filter((c) => c.status === "accepted").length} were accepted and ${o.challenges.filter((c) => c.status === "rebutted").length} rebutted [S1]. The first: ${o.challenges[0]!.contention.replace(/\.$/, "")} [S2].` : "No agent raised a challenge [S1].",
    maxTokens: 200,
  });

  // Confidence components shared by all options (Q065): no bare percentage, only a band with its parts.
  const challenges = debate.output.challenges;
  const signalBand: Level = triage.output.ranked[0]?.band ?? "low";
  const evidenceQ: Level = challenges.some((c) => c.effect === "Evidence quality capped at medium") ? (LEVELS[Math.min(1, RANK[signalBand])] as Level) : signalBand;
  const calibration: Level = challenges.some((c) => c.effect === "Model calibration rated low") ? "low" : "medium";
  const graphSupport: Level = causal.output.weakShare > 0.3 ? "medium" : "high";

  // ---------------- recommend ----------------
  const recommend = await step(ctx, { agent: "scenario_analyst", phase: "recommend", title: "Measure each option with the scenario engine and rank" }, async (tx, tools) => {
    const payload = financial.output.payload as Record<string, unknown> & { drivers?: Record<string, number> };
    const baseInput = { ...payload, monte_carlo_runs: 60 };
    const baseR = await tools.run("engine.run_option", { option: "baseline" }, () => engine<EngineResult>("/scenarios/run", baseInput), (r) => `baseline input ${r.input_hash.slice(0, 10)}`);
    const learned = await tools.run("feedback.learned_weights", {}, async () => Object.fromEntries((await tx.query("SELECT option_key, sum(vote)::int AS v, count(*)::int AS n FROM recommendation_feedback GROUP BY option_key")).rows.map((r) => [r.option_key, { v: r.v, n: r.n }])), (r) => `${Object.keys(r).length} option kind(s) with feedback`);
    const opts = [];
    for (const k of TEMPLATE_OPTIONS[c0.scenario_template] ?? TEMPLATE_OPTIONS.hormuz!) {
      const o = OPTIONS[k]!;
      const changes = o.change(baseR.drivers);
      const r = k === "hold" ? baseR : await tools.run("engine.run_option", { option: k, drivers: changes }, () => engine<EngineResult>("/scenarios/run", { ...baseInput, drivers: { ...(payload.drivers ?? {}), ...changes } }), (x) => `input ${x.input_hash.slice(0, 10)}`);
      const vb = Math.abs(metric(baseR, "portfolio_value_at_risk_usd", "90d")!.value), vo = Math.abs(metric(r, "portfolio_value_at_risk_usd", "90d")!.value);
      const pb = metric(baseR, "portfolio_value_at_risk_usd", "90d")!, po = metric(r, "portfolio_value_at_risk_usd", "90d")!;
      const rb = baseR.resilience as { score: number }, ro = r.resilience as { score: number };
      const sb = metric(baseR, "avg_net_shortfall_mbd", "72h")!.value, so = metric(r, "avg_net_shortfall_mbd", "72h")!.value;
      const varGain = vb > 0 ? ((vb - vo) / vb) * 100 : 0;
      const base = Math.round((varGain * 0.6 + (ro.score - rb.score) * 1.0 + (sb > 0 ? ((sb - so) / sb) * 10 : 0) - o.burden) * 10) / 10;
      const robust: Level = pb.p10 !== null && po.p10 !== null && pb.p90 !== null && po.p90 !== null ? (Math.sign(Math.abs(pb.p10) - Math.abs(po.p10)) === Math.sign(vb - vo) && Math.sign(Math.abs(pb.p90) - Math.abs(po.p90)) === Math.sign(vb - vo) ? "high" : "medium") : "medium";
      const components = [
        { key: "evidence", label: "Evidence quality", level: evidenceQ, basis: `Top signal confidence is ${signalBand}${evidenceQ !== signalBand ? "; capped after a challenge" : ""}` },
        { key: "calibration", label: "Model calibration", level: calibration, basis: calibration === "low" ? "Price response is an analyst assumption until back-testing" : "Parameters recorded with their basis" },
        { key: "graph", label: "Graph support", level: graphSupport, basis: `${Math.round(causal.output.weakShare * 100)}% of path links are inferred, assumed or synthetic` },
        { key: "robustness", label: "Effect robustness", level: k === "hold" ? "high" : robust, basis: k === "hold" ? "No change against the baseline" : robust === "high" ? "Effect has the same direction at P10 and P90" : "Effect direction differs across the range" },
      ];
      const core = Math.min(RANK[components[0]!.level], RANK[components[1]!.level] + 1);
      const band: Level = LEVELS[Math.max(0, Math.min(2, Math.min(core, RANK[components[2]!.level], RANK[components[3]!.level])))]!;
      const fb = learned[k];
      opts.push({ key: k, spec: o, changes, base, band, components, feedback: fb ?? { v: 0, n: 0 },
        effect: { var_90d: { base: pb.value, with: po.value, delta: vb - vo, p10: [pb.p10, po.p10], p90: [pb.p90, po.p90] }, resilience: { base: rb.score, with: ro.score, delta: ro.score - rb.score }, shortfall_72h: { base: sb, with: so, delta: sb - so }, input_hash: r.input_hash, basis: o.basis, burden: o.burden, score_formula: "0.6 × % reduction in 90-day value at risk + resilience points gained + 10 × share of 72-hour shortfall avoided − implementation burden (assumed)" } });
    }
    opts.sort((a, b) => b.base - a.base);
    const sources = sourceList(opts.map((o) => ({ kind: "option", ref: o.key, label: `Option: ${o.spec.title}`, text: `"${o.spec.title}" changes 90-day value at risk from ${fmtUsd(o.effect.var_90d.base)} to ${fmtUsd(o.effect.var_90d.with)} and resilience from ${fmtNum(o.effect.resilience.base, 0)} to ${fmtNum(o.effect.resilience.with, 0)}; score ${fmtNum(o.base, 1)}.` })));
    return { sources, output: { options: opts } };
  }, {
    instruction: "Say which option scores best and what it changes, compared with holding.",
    fallback: (src, o) => `"${o.options[0]!.spec.title}" scores highest [S1].` + (o.options[1] ? ` "${o.options[1].spec.title}" is second [S2].` : ""),
    maxTokens: 200,
  });

  const govern = await step(ctx, { agent: "governance_checker", phase: "govern", title: "Check every option against policy" }, async (tx, tools) => {
    const approvers = await tools.run("case.participants", { roles: ["approver", "executive"] }, async () => (await tx.query("SELECT p.display_name, pr.role_key FROM principals p JOIN principal_roles pr ON pr.principal_id = p.id WHERE pr.role_key IN ('approver','executive')")).rows, (r) => `${r.length} person(s) with decision authority`);
    const checked = recommend.output.options.map((o) => {
      const checks = [
        { rule: "no_external_action", result: "PASS", detail: "Recommendation only. Nothing executes from TIGERIS; a named human decision and an operations handoff are required." },
        { rule: "authority", result: approvers.length ? "PASS" : "HOLD", detail: `Decision authority: ${o.spec.authority}${approvers.length ? `; ${approvers.length} person(s) in this institution hold it` : "; nobody holds it"}.` },
        { rule: "separation_of_duties", result: "PASS", detail: `Drafted by agents for ${ctx.actor.label}; the drafter cannot approve it.` },
        { rule: "evidence_sufficiency", result: o.band === "low" ? "HOLD" : "PASS", detail: o.band === "low" ? "Confidence band is low: an expert must review before a decision." : `Confidence band is ${o.band}.` },
        { rule: "assumption_disclosure", result: "PASS", detail: `Effect rests on: ${o.spec.basis}. Shown with the option.` },
      ];
      return { key: o.key, result: checks.some((x) => x.result === "HOLD") ? "HOLD" : "PASS", checks };
    });
    await tools.run("policy.rules", { ruleSet: "policy rules v0" }, async () => checked.length, (n) => `${n} option(s) checked against 5 rules (policy-as-code editor arrives in week 7)`);
    const sources = sourceList([{ kind: "tool", ref: null, label: "Policy result", text: `${checked.filter((g) => g.result === "PASS").length} of ${checked.length} options pass all five policy rules; ${checked.filter((g) => g.result === "HOLD").length} on hold.` }, ...checked.map((g) => ({ kind: "governance", ref: g.key, label: `Policy check: ${OPTIONS[g.key]!.title}`, text: `${OPTIONS[g.key]!.title}: ${g.result}. ${g.checks.filter((x) => x.result === "HOLD").map((x) => x.detail).join(" ") || "All five rules pass."}` }))]);
    return { sources, output: { checked } };
  }, {
    instruction: "Say how many options pass the policy checks and why any are on hold.",
    fallback: (src, o) => `${o.checked.filter((g) => g.result === "PASS").length} of ${o.checked.length} options pass all policy checks [S1].` + (o.checked.some((g) => g.result === "HOLD") ? ` Options on hold need expert review because their confidence is low [S${o.checked.findIndex((g) => g.result === "HOLD") + 2}].` : ""),
  });

  // Persist ranked recommendations.
  await withTenant(ctx.inst, async (tx) => {
    for (const o of recommend.output.options) {
      const g = govern.output.checked.find((x) => x.key === o.key)!;
      await tx.query(
        `INSERT INTO recommendations (institution_id, case_id, run_id, option_key, title, description, driver_changes, effect, base_score, confidence, constraints, owner_role, authority, governance, sources)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [ctx.inst, caseId, ctx.runId, o.key, o.spec.title, o.spec.description, JSON.stringify(o.changes), JSON.stringify(o.effect), o.base, JSON.stringify({ band: o.band, components: o.components }), o.spec.constraints, o.spec.owner, o.spec.authority, JSON.stringify(g), JSON.stringify([{ kind: "scenario_run", ref: financial.output.baselineRunId, label: `Baseline "${financial.output.baselineName}"` }])],
      );
    }
  });

  // ---------------- compose ----------------
  const top = recommend.output.options[0]!;
  const brief = await step(ctx, { agent: "brief_writer", phase: "compose", title: "Draft the executive brief" }, async (tx, tools) => {
    const sources = await tools.run("agent_run.outputs", { run: ctx.runId }, async () => sourceList([
      ...(triage.output.ranked[0] ? [{ kind: "signal", ref: triage.output.ranked[0].id, label: "Top signal", text: `"${triage.output.ranked[0].title}" (${triage.output.ranked[0].data_mode} data, confidence ${triage.output.ranked[0].band}).` }] : [{ kind: "case", ref: caseId, label: "Case objective", text: c0.objective }]),
      ...financial.sources.slice(0, 1),
      { kind: "option", ref: top.key, label: "Top option", text: `"${top.spec.title}" scores highest; it changes 90-day value at risk from ${fmtUsd(top.effect.var_90d.base)} to ${fmtUsd(top.effect.var_90d.with)}; confidence ${top.band}.` },
      { kind: "governance", ref: top.key, label: "Policy", text: `${govern.output.checked.filter((g) => g.result === "PASS").length} of ${govern.output.checked.length} options pass policy checks; every option needs a named human decision.` },
    ]), (r) => `${r.length} checked outputs`);
    return { sources, output: {} };
  }, {
    instruction: "Write the bottom line for an executive: what happened, what it means for the institution, and the leading option.",
    maxSentences: 3, maxTokens: 220,
    fallback: (src) => `${src[0]!.text.replace(/\.$/, "")} is the main input [S1]. ${src[1]!.text.replace(/\.$/, "")} [S2]. ${src[2]!.text.split(";")[0]} [S3].`,
  });

  const briefId = await saveBrief(ctx, c0, { triage, noise, causal, financial, sector, compare, debate, recommend, govern, brief });
  await finishRun(ctx, "completed", {
    steps: ctx.seq, challenges: challenges.length, accepted: challenges.filter((c) => c.status === "accepted").length, rebutted: challenges.filter((c) => c.status === "rebutted").length,
    options: recommend.output.options.length, topOption: top.spec.title, topBand: top.band, briefId, ranBaseline: financial.output.ranBaseline,
  });
}

type AnyStep = { text: CheckedSentence[]; sources: Source[]; writer: string };

/** The brief keeps every sentence's check status and resolves its tags to the underlying records. */
async function saveBrief(ctx: RunCtx, c: { id: string; title: string; sensitivity: string }, s: Record<string, AnyStep>) {
  const section = (heading: string, st: AnyStep) => ({
    heading, writer: st.writer,
    sentences: st.text.map((t) => ({ text: t.sentence.replace(/\s*\[S\d+\]/g, "").trim(), status: t.status, reason: t.reason ?? null, sources: t.tags.map((tag) => st.sources.find((x) => x.tag === tag)).filter(Boolean).map((x) => ({ kind: x!.kind, ref: x!.ref, label: x!.label, text: x!.text })) })),
  });
  const content = {
    title: c.title, classification: c.sensitivity, generatedFor: ctx.actor.label,
    sections: [
      section("Bottom line", s.brief!), section("Situation", s.triage!), section("Inputs to treat with care", s.noise!), section("How it reaches us", s.causal!),
      section("What it means for the portfolio", s.financial!), section("Sector view", s.sector!), section("Scenario comparison", s.compare!),
      section("Challenges between agents", s.debate!), section("Options", s.recommend!), section("Governance", s.govern!),
    ],
    status: "Draft for a named human decision. No action executes from TIGERIS.",
  };
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return withTenant(ctx.inst, async (tx) => {
    const v = (await tx.query("SELECT coalesce(max(version),0)::int + 1 AS v FROM case_briefs WHERE case_id = $1", [c.id])).rows[0].v;
    const r = await tx.query<{ id: string }>("INSERT INTO case_briefs (institution_id, case_id, run_id, version, content, content_hash, created_by_label) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [ctx.inst, c.id, ctx.runId, v, JSON.stringify(content), hash, `Brief writer agent for ${ctx.actor.label}`]);
    await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, payload) VALUES ($1,$2,'agent_analysis',$3,$4,$5,$6)", [ctx.inst, c.id, ctx.actor.id, `Agents for ${ctx.actor.label}`, ctx.actor.role, JSON.stringify({ runId: ctx.runId, briefVersion: v })]);
    await tx.query("UPDATE cases SET last_activity_at = now() WHERE id = $1", [c.id]);
    return r.rows[0]!.id;
  });
}
