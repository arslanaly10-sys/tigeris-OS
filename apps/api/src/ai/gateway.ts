import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { withTenant, type Tx } from "../db";
import { appendAudit } from "../audit";
import { config } from "../config";
import { PROVIDERS, costOf, keyConfigured, type ProviderKey, type ProviderSpec } from "./providers";

/**
 * Model gateway (TR-020..TR-024, Q061..Q063). The single path from the product to any model.
 * Order of checks for every call:
 *   1. allowlist        — the provider must be on the institution's model allowlist
 *   2. foreign switch   — foreign providers are cut unless the switch is on
 *   3. classification   — content above the foreign ceiling (never secret) may not leave
 *   4. egress           — outbound must be allowed, and only to the provider's own hosts
 *   5. key              — a foreign provider needs a key in the deployment environment
 * A refused call is recorded and audited, then the gateway falls back to the local model, and
 * if that is unavailable the caller's deterministic writer is used. Models only write text.
 */
export type Classification = "public" | "internal" | "confidential" | "secret";
const CLASS_RANK: Record<Classification, number> = { public: 0, internal: 1, confidential: 2, secret: 3 };

export interface Settings {
  foreign_models_enabled: boolean; outbound_allowed: boolean; allowed_providers: string[]; default_provider: string;
  foreign_max_classification: Classification; version: number; updated_by_label: string; updated_at: string;
}

export async function getSettings(tx: Tx): Promise<Settings> {
  const r = (await tx.query("SELECT * FROM sovereignty_settings LIMIT 1")).rows[0];
  return r ?? { foreign_models_enabled: false, outbound_allowed: false, allowed_providers: ["local", "deterministic"], default_provider: "local", foreign_max_classification: "internal", version: 0, updated_by_label: "system default", updated_at: new Date(0).toISOString() };
}

export interface Actor { id: string; label: string; role: string }
export interface CallRequest {
  agentKey: string;
  provider?: ProviderKey; // requested; defaults to the institution default
  system: string;
  user: string;
  maxTokens?: number;
  jsonSchema?: Record<string, unknown>;
  classification: Classification;
  runId?: string | null;
  stepSeq?: number | null;
  caseId?: string | null;
}
export interface Attempt { provider: ProviderKey; model: string; outcome: "ok" | "cached" | "blocked" | "unavailable" | "error"; reason?: string; check?: string }
export interface CallResult {
  ok: boolean;
  text: string;
  provider: ProviderKey; // provider that produced the text (deterministic when ok is false)
  model: string;
  tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number; cached: boolean;
  attempts: Attempt[];
  promptHash: string;
}

export function promptHash(provider: string, model: string, system: string, user: string, schema?: unknown): string {
  return createHash("sha256").update(JSON.stringify([provider, model, system, user, schema ?? null])).digest("hex");
}

/** Policy decision for one provider. Pure, so it is unit-tested directly. */
export function policyFor(p: ProviderSpec, s: Settings, classification: Classification): { allowed: true } | { allowed: false; check: string; reason: string } {
  if (!s.allowed_providers.includes(p.key)) return { allowed: false, check: "allowlist", reason: `${p.label} is not on this institution's model allowlist.` };
  if (p.foreign && !s.foreign_models_enabled) return { allowed: false, check: "foreign_switch", reason: "Foreign models are switched off for this institution." };
  if (p.foreign && (classification === "secret" || CLASS_RANK[classification] > CLASS_RANK[s.foreign_max_classification]))
    return { allowed: false, check: "classification", reason: `Content classified ${classification} may not be sent to a foreign model (ceiling: ${s.foreign_max_classification}).` };
  if (p.hosts.length && !s.outbound_allowed) return { allowed: false, check: "egress", reason: `Outbound access is off; ${p.hosts.join(", ")} is not reachable.` };
  if (!keyConfigured(p)) return { allowed: false, check: "credentials", reason: `No ${p.label} key is configured in this deployment.` };
  return { allowed: true };
}

/** Egress guard handed to the SDKs as their fetch: the only outbound path, limited to the provider's own hosts. */
function guardedFetch(p: ProviderSpec, s: Settings): typeof fetch {
  return (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!s.outbound_allowed || !p.hosts.includes(url.hostname)) {
      return Promise.reject(new Error(`Egress blocked: ${url.hostname} is not an allowed destination for ${p.label}.`));
    }
    return fetch(input, init);
  };
}

async function callProvider(p: ProviderSpec, s: Settings, req: CallRequest): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string }> {
  const maxTokens = req.maxTokens ?? 300;
  if (p.key === "local") {
    const res = await fetch(`${config.reasoningUrl}/llm/chat`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({ messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }], max_tokens: maxTokens, json_schema: req.jsonSchema }),
    });
    const j = (await res.json()) as { ok: boolean; text?: string; error?: string; tokens_in?: number; tokens_out?: number; model?: string };
    if (!j.ok) throw new Error(j.error ?? "Local model unavailable");
    return { text: j.text ?? "", tokensIn: j.tokens_in ?? 0, tokensOut: j.tokens_out ?? 0, model: j.model ?? p.model };
  }
  if (p.key === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, fetch: guardedFetch(p, s), maxRetries: 1, timeout: 60_000 });
    // Server-side refusal fallback is on by default for this model family.
    const r = await client.beta.messages.create({
      model: p.model, max_tokens: Math.max(1024, maxTokens * 4), betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "low" }, system: req.system, messages: [{ role: "user", content: req.user + (req.jsonSchema ? `\n\nReply with JSON only, matching this schema: ${JSON.stringify(req.jsonSchema)}` : "") }],
    });
    if (r.stop_reason === "refusal") throw new Error("The model declined this request.");
    const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return { text, tokensIn: r.usage.input_tokens, tokensOut: r.usage.output_tokens, model: r.model };
  }
  if (p.key === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, fetch: guardedFetch(p, s), maxRetries: 1, timeout: 60_000 });
    const r = await client.chat.completions.create({
      model: p.model, max_completion_tokens: Math.max(1024, maxTokens * 4),
      messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
      ...(req.jsonSchema ? { response_format: { type: "json_object" as const } } : {}),
    });
    return { text: r.choices[0]?.message?.content?.trim() ?? "", tokensIn: r.usage?.prompt_tokens ?? 0, tokensOut: r.usage?.completion_tokens ?? 0, model: r.model };
  }
  throw new Error("No model for the deterministic provider");
}

/**
 * Calls a model under the institution's sovereignty policy. Database work happens in short
 * transactions around the call, never while a model is generating.
 */
export async function complete(institutionId: string, actor: Actor, req: CallRequest): Promise<CallResult> {
  const settings = await withTenant(institutionId, getSettings);
  const requested = (req.provider ?? settings.default_provider) as ProviderKey;
  // "deterministic" means no model at all; anything else falls back to the local model.
  const chain: ProviderKey[] = requested === "deterministic" ? [] : [...new Set<ProviderKey>([requested, "local"])].filter((k) => k !== "deterministic");
  const attempts: Attempt[] = [];

  for (const key of chain) {
    const p = PROVIDERS[key];
    const hash = promptHash(p.key, p.model, req.system, req.user, req.jsonSchema);
    const decision = policyFor(p, settings, req.classification);
    if (!decision.allowed) {
      attempts.push({ provider: key, model: p.model, outcome: "blocked", reason: decision.reason, check: decision.check });
      await record(institutionId, actor, req, p, hash, { outcome: "blocked", reason: decision.reason, check: decision.check });
      continue;
    }
    const cached = await withTenant(institutionId, (tx) => tx.query("SELECT response_text, tokens_in, tokens_out FROM model_cache WHERE provider = $1 AND model = $2 AND prompt_hash = $3", [p.key, p.model, hash])).then((r) => r.rows[0]);
    if (cached) {
      attempts.push({ provider: key, model: p.model, outcome: "cached" });
      await record(institutionId, actor, req, p, hash, { outcome: "cached", reason: "Identical prompt answered earlier; response reused" });
      return { ok: true, text: cached.response_text, provider: key, model: p.model, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, cached: true, attempts, promptHash: hash };
    }
    const t0 = Date.now();
    try {
      const r = await callProvider(p, settings, req);
      const ms = Date.now() - t0;
      const cost = costOf(p, r.tokensIn, r.tokensOut);
      attempts.push({ provider: key, model: r.model, outcome: "ok" });
      await record(institutionId, actor, req, p, hash, { outcome: "ok", tokensIn: r.tokensIn, tokensOut: r.tokensOut, ms, cost: cost.usd, priced: cost.priced, model: r.model });
      await withTenant(institutionId, (tx) => tx.query("INSERT INTO model_cache (institution_id, provider, model, prompt_hash, response_text, tokens_in, tokens_out) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING", [institutionId, p.key, p.model, hash, r.text, r.tokensIn, r.tokensOut]));
      return { ok: true, text: r.text, provider: key, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: cost.usd, latencyMs: ms, cached: false, attempts, promptHash: hash };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const outcome = reason.startsWith("Egress blocked") ? "blocked" : "error";
      attempts.push({ provider: key, model: p.model, outcome, reason, check: outcome === "blocked" ? "egress" : undefined });
      await record(institutionId, actor, req, p, hash, { outcome, reason, check: outcome === "blocked" ? "egress" : undefined, ms: Date.now() - t0 });
    }
  }
  const d = PROVIDERS.deterministic;
  if (!chain.length) attempts.push({ provider: "deterministic", model: d.model, outcome: "unavailable", reason: "Deterministic writer chosen: no model was called" });
  return { ok: false, text: "", provider: "deterministic", model: d.model, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, cached: false, attempts, promptHash: promptHash(d.key, d.model, req.system, req.user) };
}

async function record(institutionId: string, actor: Actor, req: CallRequest, p: ProviderSpec, hash: string,
  r: { outcome: string; reason?: string; check?: string; tokensIn?: number; tokensOut?: number; ms?: number; cost?: number; priced?: boolean; model?: string }) {
  await withTenant(institutionId, async (tx) => {
    await tx.query(
      `INSERT INTO model_calls (institution_id, run_id, step_seq, agent_key, provider, model, prompt_hash, prompt_chars, classification, outcome, reason, tokens_in, tokens_out, latency_ms, cost_usd, priced)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [institutionId, req.runId ?? null, req.stepSeq ?? null, req.agentKey, p.key, r.model ?? p.model, hash, req.system.length + req.user.length, req.classification, r.outcome, r.reason ?? null,
        r.tokensIn ?? 0, r.tokensOut ?? 0, r.ms ?? 0, r.cost ?? 0, r.priced ?? true],
    );
    // Refusals by the sovereignty controls are security events and go on the audit chain (TR-024).
    if (r.outcome === "blocked") {
      await appendAudit(tx, institutionId, {
        actorType: "service", actorId: actor.id, actorLabel: `Model gateway (for ${actor.label})`, actorRole: actor.role,
        action: r.check === "egress" ? "egress.blocked" : "model.call_blocked", resourceType: "model_provider", resourceId: p.key, caseId: req.caseId ?? null,
        details: { agent: req.agentKey, check: r.check, reason: r.reason, classification: req.classification, promptHash: hash },
      });
    }
  });
}

/** What the gateway can use right now, for the Governance page and the header badge. */
export async function providerStatus(s: Settings) {
  let local: Record<string, unknown> = { present: false, error: "Reasoning service not reachable" };
  try {
    local = (await (await fetch(`${config.reasoningUrl}/llm/status`, { signal: AbortSignal.timeout(5000) })).json()) as Record<string, unknown>;
  } catch { /* reported as unavailable */ }
  return Object.values(PROVIDERS).map((p) => {
    const decision = policyFor(p, s, "internal");
    return {
      key: p.key, label: p.label, vendor: p.vendor, foreign: p.foreign, model: p.model, hosts: p.hosts, residency: p.residency,
      priceInPerM: p.priceInPerM, priceOutPerM: p.priceOutPerM,
      allowlisted: s.allowed_providers.includes(p.key),
      keyConfigured: keyConfigured(p),
      usable: p.key === "local" ? decision.allowed && local.present === true : decision.allowed,
      blockedBy: decision.allowed ? (p.key === "local" && local.present !== true ? "model_file" : null) : decision.check,
      reason: decision.allowed ? (p.key === "local" && local.present !== true ? String(local.error ?? "Model file missing") : null) : decision.reason,
      local: p.key === "local" ? local : undefined,
    };
  });
}
