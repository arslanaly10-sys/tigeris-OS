import { withTenant, type Tx } from "../db";
import { appendAudit } from "../audit";
import { complete, type Actor, type Classification } from "../ai/gateway";
import type { ProviderKey } from "../ai/providers";
import { citedShare, verifyText, type CheckedSentence, type Source } from "../ai/verify";
import { screenInjection } from "../evidence/validate";
import { AGENT_NAME } from "./registry";

/**
 * Agent run runtime: every step records its tool calls, the sources it saw, its structured
 * output, the text and how that text was checked, and which writer produced it (TR-025, Q064).
 */
export interface RunCtx {
  inst: string;
  actor: Actor;
  runId: string;
  caseId: string | null;
  provider: ProviderKey;
  classification: Classification;
  seq: number;
}

export interface ToolCall { tool: string; input: unknown; summary: string; ms: number }
export interface Gathered<T> { sources: Source[]; output: T; excluded?: Array<{ label: string; reason: string }> }

export class Tools {
  calls: ToolCall[] = [];
  async run<T>(tool: string, input: unknown, fn: () => Promise<T>, summarise: (r: T) => string): Promise<T> {
    const t0 = Date.now();
    const r = await fn();
    this.calls.push({ tool, input, summary: summarise(r), ms: Date.now() - t0 });
    return r;
  }
}

export interface WriteSpec<T> {
  instruction: string; // what to write, in one line
  maxSentences?: number;
  maxTokens?: number;
  fallback: (sources: Source[], output: T) => string; // deterministic, cited text
  skip?: (output: T) => string | null; // reason to not call a model at all
}

export interface StepResult<T> { seq: number; output: T; text: CheckedSentence[]; sources: Source[]; writer: string }

export async function startRun(inst: string, actor: Actor, a: { kind: string; caseId: string | null; provider: ProviderKey; question?: string }): Promise<string> {
  return withTenant(inst, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "INSERT INTO agent_runs (institution_id, case_id, kind, provider_requested, question, requested_by, requested_by_label) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [inst, a.caseId, a.kind, a.provider, a.question ?? null, actor.id, actor.label],
    );
    await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "agent_run.started", resourceType: "agent_run", resourceId: r.rows[0]!.id, caseId: a.caseId, details: { kind: a.kind, provider: a.provider } });
    return r.rows[0]!.id;
  });
}

export async function finishRun(ctx: RunCtx, status: "completed" | "failed", summary: Record<string, unknown>, error?: string) {
  await withTenant(ctx.inst, async (tx) => {
    const t = (await tx.query("SELECT coalesce(sum(tokens_in),0)::int AS i, coalesce(sum(tokens_out),0)::int AS o, coalesce(sum(cost_usd),0)::float AS c, count(*) FILTER (WHERE outcome IN ('ok','cached'))::int AS n FROM model_calls WHERE run_id = $1", [ctx.runId])).rows[0];
    await tx.query("UPDATE agent_runs SET status = $2, summary = $3, error = $4, finished_at = now(), tokens_in = $5, tokens_out = $6, cost_usd = $7, model_calls = $8 WHERE id = $1",
      [ctx.runId, status, JSON.stringify(summary), error ?? null, t.i, t.o, t.c, t.n]);
    await appendAudit(tx, ctx.inst, { actorType: "service", actorId: ctx.actor.id, actorLabel: `Agent orchestrator (for ${ctx.actor.label})`, actorRole: ctx.actor.role, action: `agent_run.${status}`, resourceType: "agent_run", resourceId: ctx.runId, caseId: ctx.caseId, details: { ...summary, tokensIn: t.i, tokensOut: t.o, costUsd: t.c, modelCalls: t.n, error } });
  });
}

/** Small models write tags in many shapes: [S1, S2], (S1), [1], S1. Normalise to [S1][S2]. */
export function normaliseTags(text: string): string {
  return text
    .replace(/\[\s*S?(\d+)\s*(?:[,;]\s*S?(\d+)\s*)+\]/g, (m) => [...m.matchAll(/\d+/g)].map((d) => `[S${d[0]}]`).join(""))
    .replace(/\(\s*S(\d+)\s*\)/g, "[S$1]")
    .replace(/\[(\d+)\]/g, "[S$1]")
    .replace(/(?<!\[)\bS(\d+)\b(?!\])/g, "[S$1]")
    .replace(/\*\*/g, "")
    .replace(/\.\s*\./g, ".")
    .trim();
}

function renderSources(sources: Source[]): string {
  return sources.map((s) => `[${s.tag}] ${s.label}: ${s.text}`).join("\n");
}

/** Sources are data. Any that read like instructions are excluded before a model sees them. */
export function screenSources(sources: Source[]): { kept: Source[]; excluded: Array<{ label: string; reason: string }> } {
  const kept: Source[] = [];
  const excluded: Array<{ label: string; reason: string }> = [];
  for (const s of sources) {
    const hit = screenInjection(s.text);
    if (hit.hits.length) excluded.push({ label: s.label, reason: `Excluded before the model: ${hit.hits.join("; ")}` });
    else kept.push(s);
  }
  return { kept, excluded };
}

/** Runs one agent step: tools, then (optionally) a checked text written by a model or the deterministic writer. */
export async function step<T>(ctx: RunCtx, a: { agent: string; agentName?: string; phase: string; title: string }, gather: (tx: Tx, tools: Tools) => Promise<Gathered<T>>, write?: WriteSpec<T>): Promise<StepResult<T>> {
  const seq = ++ctx.seq;
  const t0 = Date.now();
  const tools = new Tools();
  const g = await withTenant(ctx.inst, (tx) => gather(tx, tools));
  const { kept, excluded } = screenSources(g.sources);
  let checked: CheckedSentence[] = [];
  let writer = "none";
  let fallbackReason: string | null = null;
  let attempts: unknown[] = [];
  let modelText: string | null = null;
  const skipReason = write?.skip?.(g.output) ?? null;
  if (write && skipReason) fallbackReason = skipReason;
  if (write && !skipReason) {
    const name = a.agentName ?? AGENT_NAME[a.agent] ?? a.agent;
    const n = write.maxSentences ?? 2;
    // Small local models follow a worked example far better than abstract rules.
    const system = `You are the ${name} agent inside TIGERIS, a decision-support system for a sovereign institution. ${write.instruction}
Rules:
- Use only the facts in the numbered sources. Do not recommend, approve or instruct anyone.
- Copy numbers exactly as written in the source; do not calculate new numbers.
- Put the source tag at the end of each sentence, like this: [S2].
- At most ${n} short sentences. No headings, lists or advice.

Example sources:
[S1] Port throughput: Jebel Ali handled 14.5 million containers in 2024.
[S2] Resilience: Alternatives available scores 40 out of 100.
Example answer:
Jebel Ali handled 14.5 million containers in 2024 [S1]. Alternatives available scores 40 out of 100 [S2].`;
    const user = `Sources:\n${renderSources(kept)}\n\nAnswer:`;
    const r = await complete(ctx.inst, ctx.actor, { agentKey: a.agent, provider: ctx.provider, system, user, maxTokens: write.maxTokens ?? 160, classification: ctx.classification, runId: ctx.runId, stepSeq: seq, caseId: ctx.caseId });
    attempts = r.attempts;
    const refused = r.attempts.filter((x) => x.outcome !== "ok" && x.outcome !== "cached").map((x) => `${x.provider}: ${x.reason ?? x.outcome}`);
    if (r.ok) {
      modelText = r.text;
      checked = verifyText(normaliseTags(r.text), kept);
      // Drop a sentence cut off by the token limit, and anything past the sentence limit.
      if (checked.length && !/[.!?\]]["”']?$/.test(checked.at(-1)!.sentence)) checked = checked.slice(0, -1);
      if (checked.length > n + 1) checked = checked.slice(0, n + 1);
      writer = r.cached ? `${r.provider} (cached)` : r.provider;
      if (refused.length) fallbackReason = `Routed to ${r.provider} after ${refused.join(" · ")}`;
      if (citedShare(checked) < 0.5) {
        fallbackReason = `Model text failed the citation check (${checked.filter((c) => c.status === "cited").length} of ${checked.length} sentences cited); the deterministic writer was used instead.`;
        checked = [];
      }
    } else {
      fallbackReason = refused.length ? refused.join(" · ") : "No model available";
    }
  }
  if (write && !checked.length) {
    checked = kept.length ? verifyText(write.fallback(kept, g.output), kept) : [{ sentence: "No usable source remained after screening.", tags: [], status: "unverified", reason: "Every source was excluded" }];
    writer = "deterministic";
  }
  const ms = Date.now() - t0;
  await withTenant(ctx.inst, (tx) => tx.query(
    `INSERT INTO agent_steps (institution_id, run_id, seq, agent_key, phase, title, tool_calls, sources, output, text, writer, fallback_reason, ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [ctx.inst, ctx.runId, seq, a.agent, a.phase, a.title, JSON.stringify(tools.calls), JSON.stringify(kept), JSON.stringify({ ...g.output as object, excluded: [...(g.excluded ?? []), ...excluded], attempts, modelText }), JSON.stringify(checked), writer, fallbackReason, ms],
  ));
  return { seq, output: g.output, text: checked, sources: kept, writer };
}

/** Builds numbered sources. */
export function sourceList(items: Array<Omit<Source, "tag">>): Source[] {
  return items.map((s, i) => ({ ...s, tag: `S${i + 1}` }));
}

export const fmtNum = (v: number, d = 1) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-GB") : Number(v.toFixed(d)).toString());
export const fmtUsd = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `USD ${(v / 1e9).toFixed(1)} billion`;
  if (a >= 1e6) return `USD ${(v / 1e6).toFixed(1)} million`;
  return `USD ${Math.round(v).toLocaleString("en-GB")}`;
};
