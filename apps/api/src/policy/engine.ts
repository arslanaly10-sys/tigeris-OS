import { createHash } from "node:crypto";
import { parse } from "yaml";
import { z } from "zod";

/**
 * Policy-as-code (FR-29..FR-32, TR-041..TR-045, Q090..Q095).
 * A policy is a YAML document with four parts:
 *   rules      conditions on an action; a failed requirement gives BLOCK or HOLD with a message
 *   approvals  how many distinct people, in which roles, must approve a decision of a given kind
 *   redaction  export audiences: who may export each one and what is removed
 *   tests      example contexts with the expected result; a version can only be activated if all pass
 * Evaluation is deterministic and returns a trace of every rule that applied. No model is involved.
 */
export const ACTIONS = ["case.transition", "decision.record", "decision.approve", "handoff.update", "export.create", "memory.approve"] as const;
export type Action = (typeof ACTIONS)[number];
export type Result = "PASS" | "HOLD" | "BLOCK";

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const condition = z.union([
  scalar,
  z.object({
    equals: scalar.optional(), not_equals: scalar.optional(), in: z.array(scalar).optional(), not_in: z.array(scalar).optional(),
    gte: z.union([z.number(), z.string()]).optional(), lte: z.union([z.number(), z.string()]).optional(), gt: z.union([z.number(), z.string()]).optional(), lt: z.union([z.number(), z.string()]).optional(),
    exists: z.boolean().optional(),
  }).strict(),
]);
const conditions = z.record(z.string(), condition);
const ruleSchema = z.object({
  id: z.string().regex(/^[a-z0-9_.]+$/, "Rule ids use lower case, digits, dots and underscores"),
  description: z.string().default(""),
  action: z.enum(ACTIONS),
  when: conditions.default({}),
  require: conditions,
  effect: z.enum(["BLOCK", "HOLD"]),
  message: z.string(),
}).strict();
const approvalSchema = z.object({
  id: z.string(), description: z.string().default(""), when: conditions.default({}),
  required: z.number().int().min(1).max(5), roles: z.array(z.string()).min(1),
}).strict();
const audienceSchema = z.object({
  key: z.string(), label: z.string(), roles: z.array(z.string()).min(1),
  redact: z.array(z.enum(["holding_names", "holding_values", "people", "internal_sources", "unverified", "raw_model_text"])).default([]),
}).strict();
const testSchema = z.object({
  name: z.string(), action: z.enum(ACTIONS), context: z.record(z.string(), z.unknown()), expect: z.enum(["PASS", "HOLD", "BLOCK"]), rule: z.string().optional(),
}).strict();
export const policySchema = z.object({
  title: z.string(),
  rules: z.array(ruleSchema).min(1),
  approvals: z.array(approvalSchema).default([]),
  redaction: z.object({ audiences: z.array(audienceSchema).min(1) }),
  tests: z.array(testSchema).default([]),
}).strict();
export type Policy = z.infer<typeof policySchema>;
export type Rule = z.infer<typeof ruleSchema>;

export interface CompileResult { ok: boolean; policy?: Policy; errors: string[]; hash: string }

/** Parses and validates YAML. Errors name the line or the field so the editor can show them. */
export function compile(source: string): CompileResult {
  const hash = createHash("sha256").update(source).digest("hex");
  let raw: unknown;
  try {
    raw = parse(source, { prettyErrors: true });
  } catch (e) {
    return { ok: false, errors: [`YAML: ${(e as Error).message.split("\n")[0]}`], hash };
  }
  const r = policySchema.safeParse(raw);
  if (!r.success) return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "document"}: ${i.message}`), hash };
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const rule of r.data.rules) {
    if (ids.has(rule.id)) errors.push(`rules: duplicate id ${rule.id}`);
    ids.add(rule.id);
  }
  for (const t of r.data.tests) if (t.rule && !ids.has(t.rule)) errors.push(`tests.${t.name}: names unknown rule ${t.rule}`);
  return { ok: errors.length === 0, policy: errors.length ? undefined : r.data, errors, hash };
}

export function get(ctx: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o !== null && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx);
}
/** A value that starts with "$" refers to another field in the context, e.g. "$case.created_by". */
const resolve = (ctx: unknown, v: unknown) => (typeof v === "string" && v.startsWith("$") ? get(ctx, v.slice(1)) : v);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

export function holds(ctx: unknown, path: string, c: z.infer<typeof condition>): boolean {
  const v = get(ctx, path);
  if (c === null || typeof c !== "object") return v === resolve(ctx, c);
  if (c.exists !== undefined && (v !== undefined && v !== null) !== c.exists) return false;
  if (c.equals !== undefined && v !== resolve(ctx, c.equals)) return false;
  if (c.not_equals !== undefined && v === resolve(ctx, c.not_equals)) return false;
  if (c.in && !c.in.map((x) => resolve(ctx, x)).includes(v as never)) return false;
  if (c.not_in && c.not_in.map((x) => resolve(ctx, x)).includes(v as never)) return false;
  if (c.gte !== undefined && !(num(v) >= num(resolve(ctx, c.gte)))) return false;
  if (c.lte !== undefined && !(num(v) <= num(resolve(ctx, c.lte)))) return false;
  if (c.gt !== undefined && !(num(v) > num(resolve(ctx, c.gt)))) return false;
  if (c.lt !== undefined && !(num(v) < num(resolve(ctx, c.lt)))) return false;
  return true;
}
const allHold = (ctx: unknown, cs: Record<string, z.infer<typeof condition>>) => Object.entries(cs).every(([p, c]) => holds(ctx, p, c));

const fill = (msg: string, ctx: unknown) => msg.replace(/\{([a-z0-9_.]+)\}/gi, (_m, p: string) => {
  const v = get(ctx, p);
  return Array.isArray(v) ? v.join(", ") : v === undefined ? `{${p}}` : String(v);
});

export interface RuleTrace { rule: string; description: string; applied: boolean; passed: boolean; effect: Result | null; message: string | null }
export interface Evaluation { result: Result; rule: string; explanation: string; trace: RuleTrace[]; policyHash: string; version: number | null }

/** Evaluates every rule for the action. BLOCK beats HOLD beats PASS; the first failing rule of the worst kind explains. */
export function evaluate(policy: Policy, action: Action, ctx: unknown, meta: { hash: string; version: number | null }): Evaluation {
  const trace: RuleTrace[] = policy.rules.filter((r) => r.action === action).map((r) => {
    const applied = allHold(ctx, r.when);
    const passed = !applied || allHold(ctx, r.require);
    return { rule: r.id, description: r.description, applied, passed, effect: passed ? null : r.effect, message: passed ? null : fill(r.message, ctx) };
  });
  const worst = trace.find((t) => t.effect === "BLOCK") ?? trace.find((t) => t.effect === "HOLD");
  return worst
    ? { result: worst.effect!, rule: worst.rule, explanation: worst.message!, trace, policyHash: meta.hash, version: meta.version }
    : { result: "PASS", rule: "policy", explanation: `All ${trace.filter((t) => t.applied).length} applicable rules pass.`, trace, policyHash: meta.hash, version: meta.version };
}

/** The approval requirement for a decision: the first matching entry, or one approval by default. */
export function approvalFor(policy: Policy, ctx: unknown): { id: string; required: number; roles: string[]; description: string } {
  const a = policy.approvals.find((x) => allHold(ctx, x.when));
  return a ? { id: a.id, required: a.required, roles: a.roles, description: a.description } : { id: "default", required: 1, roles: ["approver", "executive"], description: "One approval by a person with decision authority" };
}

export function runTests(policy: Policy, hash: string) {
  return policy.tests.map((t) => {
    const e = evaluate(policy, t.action, t.context, { hash, version: null });
    const pass = e.result === t.expect && (!t.rule || e.rule === t.rule || (t.expect === "PASS"));
    return { name: t.name, action: t.action, expect: t.expect, got: e.result, rule: e.rule, expectedRule: t.rule ?? null, pass, explanation: e.explanation };
  });
}
