import type { Tx } from "../db";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { complete, type Actor, type Classification } from "../ai/gateway";
import type { ProviderKey } from "../ai/providers";
import type { Source } from "../ai/verify";
import { screenInjection } from "../evidence/validate";
import { impactPaths } from "../graph/traverse";
import { finishRun, fmtNum, fmtUsd, sourceList, startRun, step, type RunCtx } from "./runtime";

/**
 * Ask TIGERIS inside a case (Q059, FR-21) and plain-language graph questions (Q062).
 * Answers are grounded: retrieval is deterministic over the case's own records, the model may
 * only phrase what the retrieved records say, and every sentence is checked for citations.
 * A question the case's records cannot answer gets a plain "not in this case's evidence".
 */
const STOP = new Set("the a an of to in on for and or is are was be what which who how why when does do this that it its with by as at from our we us there their any about should would could can will much many".split(" "));
const SYN: Record<string, string[]> = { range: ["p10", "p90"], "90-day": ["90", "days"], price: ["oil", "usd"], risk: ["value", "risk", "var"], revenue: ["export", "revenue"], reserve: ["reserve", "cover", "buffer"], option: ["option", "score"], insurance: ["war-risk", "insurance", "premium"], shortfall: ["shortfall", "supply", "mb/d"], confidence: ["confidence", "band"], challenge: ["challenge", "contention", "response"] };

export function tokens(s: string): string[] {
  const base = s.toLowerCase().replace(/[^a-z0-9%/.\- ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(base.flatMap((w) => [w, ...(SYN[w.replace(/s$/, "")] ?? [])]))];
}

export function rank(question: string, items: Array<Omit<Source, "tag">>, k = 6) {
  const q = tokens(question);
  return items
    .map((it) => {
      const t = ` ${`${it.label} ${it.text}`.toLowerCase()} `;
      const score = q.reduce((s, w) => s + (t.includes(w) ? (w.length > 5 ? 2 : 1) : 0), 0);
      return { it, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.it);
}

async function caseRecords(tx: Tx, caseId: string): Promise<Array<Omit<Source, "tag">>> {
  const c = (await tx.query("SELECT objective, situation, why_it_matters FROM cases WHERE id = $1", [caseId])).rows[0];
  const out: Array<Omit<Source, "tag">> = [
    { kind: "case", ref: caseId, label: "Case objective", text: c.objective },
    ...(c.situation ? [{ kind: "case", ref: caseId, label: "Case situation", text: c.situation }] : []),
    ...(c.why_it_matters ? [{ kind: "case", ref: caseId, label: "Why it matters", text: c.why_it_matters }] : []),
  ];
  for (const s of (await tx.query("SELECT s.id, s.title, s.summary, s.data_mode, s.confidence FROM case_signals cs JOIN signals s ON s.id = cs.signal_id WHERE cs.case_id = $1", [caseId])).rows)
    out.push({ kind: "signal", ref: s.id, label: `Signal (${s.data_mode})`, text: `${s.title}. ${s.summary} Confidence ${s.confidence?.band ?? "unrated"}.` });
  for (const f of (await tx.query("SELECT f.id, f.subject_label, f.predicate_label, f.value_num, f.unit, f.period, s.name FROM case_evidence ce JOIN evidence_facts f ON f.id = ce.fact_id JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id WHERE ce.case_id = $1", [caseId])).rows)
    out.push({ kind: "fact", ref: f.id, label: f.name, text: `${f.predicate_label} for ${f.subject_label}${f.period ? ` (${f.period})` : ""}: ${fmtNum(Number(f.value_num), 2)} ${f.unit ?? ""}.` });
  const run = (await tx.query("SELECT id, name, group_id FROM scenario_runs WHERE case_id = $1 AND variant = 'baseline' ORDER BY created_at DESC LIMIT 1", [caseId])).rows[0];
  if (run) {
    const hz: Record<string, string> = { "72h": "the first 72 hours", "90d": "90 days", "1y": "one year", "5y": "five years" };
    for (const r of (await tx.query("SELECT id, label, horizon, unit, value, p10, p90 FROM scenario_results WHERE run_id = $1 AND horizon IN ('72h','90d','1y')", [run.id])).rows) {
      const f = (v: number) => (r.unit === "USD" ? fmtUsd(v) : `${fmtNum(v, 1)} ${r.unit}`);
      out.push({ kind: "scenario_result", ref: r.id, label: `Scenario "${run.name}"`, text: `${r.label} over ${hz[r.horizon]}: ${f(Number(r.value))}${r.p10 !== null ? ` (P10 ${f(Number(r.p10))}, P90 ${f(Number(r.p90))})` : ""}.` });
    }
  }
  const lastRun = (await tx.query("SELECT id FROM agent_runs WHERE case_id = $1 AND kind = 'case_analysis' AND status = 'completed' ORDER BY started_at DESC LIMIT 1", [caseId])).rows[0];
  if (lastRun) {
    for (const r of (await tx.query("SELECT id, title, effect, base_score, confidence, governance FROM recommendations WHERE run_id = $1", [lastRun.id])).rows)
      out.push({ kind: "recommendation", ref: r.id, label: `Option: ${r.title}`, text: `"${r.title}" option: 90-day value at risk ${fmtUsd(r.effect.var_90d.base)} becomes ${fmtUsd(r.effect.var_90d.with)}; confidence ${r.confidence.band}; policy ${r.governance.result}; score ${fmtNum(Number(r.base_score), 1)}.` });
    const d = (await tx.query("SELECT output FROM agent_steps WHERE run_id = $1 AND phase = 'challenge'", [lastRun.id])).rows[0];
    for (const ch of (d?.output?.challenges ?? []) as Array<{ id: string; contention: string; response: string }>)
      out.push({ kind: "challenge", ref: ch.id, label: "Agent challenge", text: `${ch.contention} Response: ${ch.response}` });
  }
  return out;
}

export async function askCase(inst: string, actor: Actor, caseKey: string, question: string, provider: ProviderKey) {
  const c = await withTenant(inst, (tx) => tx.query("SELECT id, case_key, sensitivity FROM cases WHERE case_key = $1", [caseKey]).then((r) => r.rows[0]));
  if (!c) return { status: 404 as const };
  const injection = screenInjection(question);
  const runId = await startRun(inst, actor, { kind: "ask", caseId: c.id, provider, question });
  const ctx: RunCtx = { inst, actor, runId, caseId: c.id, provider, classification: c.sensitivity as Classification, seq: 0 };
  if (injection.hits.length) {
    await withTenant(inst, (tx) => appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "ask.refused_instruction", resourceType: "agent_run", resourceId: runId, caseId: c.id, details: { patterns: injection.hits } }));
  }
  let answerable = true;
  const r = await step(ctx, { agent: "ask", agentName: "Ask TIGERIS", phase: "answer", title: question.slice(0, 160) }, async (tx, tools) => {
    if (injection.hits.length) {
      answerable = false;
      return { sources: sourceList([{ kind: "note", ref: null, label: "Gateway", text: `The question was not sent to a model because it reads as an instruction to the system (${injection.hits.length} pattern(s) matched).` }]), output: { refused: true, retrieved: 0 } };
    }
    const all = await tools.run("case.records", { case: c.case_key }, () => caseRecords(tx, c.id), (x) => `${x.length} records in this case`);
    const top = await tools.run("retrieval.keyword", { question }, async () => rank(question, all), (x) => `${x.length} relevant record(s)`);
    if (!top.length) {
      answerable = false;
      return { sources: sourceList([{ kind: "note", ref: null, label: "Retrieval", text: "No record in this case matches the question." }]), output: { refused: false, retrieved: 0 } };
    }
    return { sources: sourceList(top), output: { refused: false, retrieved: top.length } };
  }, {
    instruction: `Answer this question for an executive: "${question.replace(/"/g, "'")}". If the sources do not answer it, say that the case's evidence does not answer it.`,
    maxSentences: 3, maxTokens: 220,
    skip: (o) => (o.refused ? "Not sent to a model: the question reads as an instruction." : o.retrieved === 0 ? "Not sent to a model: no record in this case matches the question." : null),
    fallback: (src) => (answerable ? `${src[0]!.text.replace(/\.$/, "")} [S1].` + (src[1] ? ` ${src[1].text.replace(/\.$/, "")} [S2].` : "") : `${src[0]!.text.replace(/\.$/, "")} [S1].`),
  });
  await finishRun(ctx, "completed", { answerable, cited: r.text.filter((t) => t.status === "cited").length, sentences: r.text.length, writer: r.writer });
  return { status: 200 as const, runId, answerable, writer: r.writer, text: r.text, sources: r.sources };
}

// ---------------- graph questions ----------------
type Intent = "path" | "exposure" | "neighbours";
const INTENT_SCHEMA = { type: "object", properties: { intent: { type: "string", enum: ["path", "exposure", "neighbours"] }, from: { type: "string" }, to: { type: "string" } }, required: ["intent", "from"] };

export function parseRules(q: string): { intent: Intent; from: string; to?: string } | null {
  const s = q.trim().replace(/[?.!]+$/, "");
  let m = s.match(/(?:path|route|connection|link(?:ed)?|connected)\s+(?:between|from)\s+(.+?)\s+(?:and|to)\s+(.+)$/i) ?? s.match(/how (?:does|do|is|are)\s+(.+?)\s+(?:connect(?:ed)?|link(?:ed)?|reach|affect|relate)\s+(?:to\s+)?(.+)$/i);
  if (m) return { intent: "path", from: m[1]!, to: m[2]! };
  m = s.match(/(?:exposed to|exposure to|depends? on|affected by|impact of|reaches|downstream of)\s+(?:a\s+|the\s+)?(?:disruption\s+(?:at|in|of)\s+)?(.+)$/i);
  if (m) return { intent: "exposure", from: m[1]! };
  m = s.match(/(?:connected to|neighbou?rs of|linked to|around|next to|related to)\s+(.+)$/i);
  if (m) return { intent: "neighbours", from: m[1]! };
  return null;
}

async function resolve(tx: Tx, name: string) {
  const n = name.replace(/^(the|a)\s+/i, "").trim();
  return (await tx.query(
    `SELECT e.id, e.key, e.name, e.type FROM entities e LEFT JOIN entity_aliases a ON a.entity_id = e.id
      WHERE lower(e.name) = lower($1) OR lower(a.alias) = lower($1) OR e.name ILIKE '%' || $1 || '%' OR a.alias ILIKE '%' || $1 || '%'
      ORDER BY (lower(e.name) = lower($1) OR lower(a.alias) = lower($1)) DESC, array_position(ARRAY['chokepoint','country','city','port','route','terminal'], e.type) NULLS LAST, (e.type IN ('vessel','holding')) ASC, length(e.name) LIMIT 1`, [n])).rows[0] as { id: string; key: string; name: string; type: string } | undefined;
}

async function shortestPath(tx: Tx, fromId: string, toId: string) {
  const edges = (await tx.query("SELECT r.id, r.subject_id, r.object_id, r.predicate_label, r.relationship_class, (SELECT count(*)::int FROM relationship_evidence re WHERE re.relationship_id = r.id) AS ev FROM entity_relationships r WHERE r.status = 'active'")).rows;
  const adj = new Map<string, Array<{ to: string; e: (typeof edges)[number] }>>();
  for (const e of edges) {
    (adj.get(e.subject_id) ?? adj.set(e.subject_id, []).get(e.subject_id)!).push({ to: e.object_id, e });
    (adj.get(e.object_id) ?? adj.set(e.object_id, []).get(e.object_id)!).push({ to: e.subject_id, e });
  }
  const prev = new Map<string, { from: string; e: (typeof edges)[number] }>();
  const seen = new Set([fromId]);
  let frontier = [fromId];
  for (let d = 0; d < 6 && frontier.length && !seen.has(toId); d++) {
    const next: string[] = [];
    for (const n of frontier) for (const { to, e } of adj.get(n) ?? []) if (!seen.has(to)) { seen.add(to); prev.set(to, { from: n, e }); next.push(to); }
    frontier = next;
  }
  if (!seen.has(toId)) return null;
  const chain: Array<{ from: string; to: string; e: (typeof edges)[number] }> = [];
  for (let cur = toId; cur !== fromId;) { const p = prev.get(cur)!; chain.unshift({ from: p.from, to: cur, e: p.e }); cur = p.from; }
  const names = new Map((await tx.query("SELECT id, name FROM entities WHERE id = ANY($1)", [[fromId, ...chain.map((c) => c.to)]])).rows.map((r) => [r.id, r.name]));
  return chain.map((c) => ({ relationshipId: c.e.id, from: names.get(c.from), to: names.get(c.to), label: c.e.predicate_label, class: c.e.relationship_class, evidence: c.e.ev, forward: c.e.subject_id === c.from }));
}

export async function askGraph(inst: string, actor: Actor, question: string, provider: ProviderKey) {
  const runId = await startRun(inst, actor, { kind: "graph_question", caseId: null, provider, question });
  const ctx: RunCtx = { inst, actor, runId, caseId: null, provider, classification: "internal", seq: 0 };
  // 1. Interpret: the model may only fill a fixed schema; rules are the fallback; names are resolved deterministically.
  let parser = "rules";
  let parsed = parseRules(question);
  if (!screenInjection(question).hits.length) {
    const m = await complete(inst, actor, { agentKey: "graph_query", provider, classification: "internal", runId, stepSeq: 0, maxTokens: 60, jsonSchema: INTENT_SCHEMA,
      system: "Convert the user's question about a network of places, routes, assets and holdings into JSON. intent is 'path' for how two things connect, 'exposure' for what is affected by or depends on something, 'neighbours' for what is directly connected to something. from and to are place or asset names copied from the question.",
      user: question });
    if (m.ok) {
      try {
        const j = JSON.parse(m.text) as { intent: Intent; from: string; to?: string };
        if (["path", "exposure", "neighbours"].includes(j.intent) && j.from && (j.intent !== "path" || j.to)) { parsed = j.intent === "path" ? j : { intent: j.intent, from: j.from }; parser = m.cached ? `${m.provider} (cached)` : m.provider; }
      } catch { /* keep the rule parse */ }
    }
  }
  let interpretation: Record<string, unknown> = { parser, ...(parsed ?? {}) };
  const r = await step<{ found: boolean } & Record<string, unknown>>(ctx, { agent: "causal_impact", phase: "answer", title: question.slice(0, 160) }, async (tx, tools) => {
    if (!parsed) return { sources: sourceList([{ kind: "note", ref: null, label: "Interpretation", text: "The question could not be read as a path, exposure or neighbour question about the graph." }]), output: { found: false } };
    const from = await tools.run("graph.resolve", { name: parsed.from }, () => resolve(tx, parsed!.from), (e) => (e ? `${e.name} (${e.type})` : "not found"));
    const to = parsed.to ? await tools.run("graph.resolve", { name: parsed.to }, () => resolve(tx, parsed!.to!), (e) => (e ? `${e.name} (${e.type})` : "not found")) : undefined;
    interpretation = { ...interpretation, fromEntity: from ?? null, toEntity: to ?? null };
    if (!from || (parsed.intent === "path" && !to)) return { sources: sourceList([{ kind: "note", ref: null, label: "Resolution", text: `No entity in the graph matches "${!from ? parsed.from : parsed.to}".` }]), output: { found: false } };
    if (parsed.intent === "path") {
      const chain = await tools.run("graph.shortest_path", { from: from.key, to: to!.key }, () => shortestPath(tx, from.id, to!.id), (c) => (c ? `${c.length} link(s)` : "no path within 6 links"));
      if (!chain) return { sources: sourceList([{ kind: "note", ref: null, label: "Path", text: `No path connects ${from.name} and ${to!.name} within 6 links.` }]), output: { found: false } };
      return { sources: sourceList(chain.map((c) => ({ kind: "relationship", ref: c.relationshipId, label: "Relationship", text: `${c.forward ? c.from : c.to} ${c.label} ${c.forward ? c.to : c.from} (${c.class}, ${c.evidence} evidence record(s)).` }))), output: { found: true, intent: "path", chain } };
    }
    if (parsed.intent === "exposure") {
      const p = await tools.run("graph.impact_paths", { from: from.key, maxDepth: 4 }, () => impactPaths(tx, from.key, { maxDepth: 4, maxNodes: 400 }), (x) => `${x?.hops.length ?? 0} reachable`);
      const hops = (p?.hops ?? []).filter((h) => h.depth > 0);
      const holdings = hops.filter((h) => h.entity.type === "holding").sort((a, b) => b.cumulativeWeight - a.cumulativeWeight);
      const pick = [...holdings.slice(0, 4), ...hops.filter((h) => h.entity.type === "country").slice(0, 2)];
      return { sources: sourceList([{ kind: "graph", ref: from.key, label: "Impact traversal", text: `${hops.length} entities depend on ${from.name} within 4 links, including ${holdings.length} holdings.` },
        ...pick.map((h) => ({ kind: "relationship", ref: h.via.relationshipId, label: `Exposure: ${h.entity.name}`, text: `${h.entity.name} (${h.entity.type}) is reached with path strength ${h.cumulativeWeight.toFixed(2)}; last link "${h.via.label}" is ${h.via.class}.` }))]),
        output: { found: true, intent: "exposure", reachable: hops.length, holdings: holdings.slice(0, 10).map((h) => ({ key: h.entity.key, name: h.entity.name, strength: h.cumulativeWeight })) } };
    }
    const rels = await tools.run("graph.neighbourhood", { entity: from.key }, async () => (await tx.query(
      `SELECT r.id, r.predicate_label, r.relationship_class, s.name AS s_name, o.name AS o_name FROM entity_relationships r JOIN entities s ON s.id = r.subject_id JOIN entities o ON o.id = r.object_id
        WHERE (r.subject_id = $1 OR r.object_id = $1) AND r.status = 'active' ORDER BY (o.type = 'holding' OR s.type = 'holding'), r.predicate_label LIMIT 8`, [from.id])).rows, (x) => `${x.length} direct relationship(s)`);
    return { sources: sourceList(rels.map((x) => ({ kind: "relationship", ref: x.id, label: "Relationship", text: `${x.s_name} ${x.predicate_label} ${x.o_name} (${x.relationship_class}).` }))), output: { found: rels.length > 0, intent: "neighbours", count: rels.length } };
  }, {
    instruction: `Answer the question "${question.replace(/"/g, "'")}" from the graph records.`,
    maxSentences: 3, maxTokens: 200,
    skip: (o) => (o.found ? null : "Not sent to a model: the graph query found nothing to describe."),
    fallback: (src) => src.slice(0, 3).map((s, i) => `${s.text.replace(/\.$/, "")} [S${i + 1}].`).join(" "),
  });
  await finishRun(ctx, "completed", { interpretation, writer: r.writer });
  return { runId, interpretation, writer: r.writer, text: r.text, sources: r.sources, output: r.output };
}
