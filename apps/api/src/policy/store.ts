import type { Tx } from "../db";
import { compile, evaluate, type Action, type Evaluation, type Policy } from "./engine";

/** Active policy for the current institution (RLS scope), compiled once per content hash. */
const cache = new Map<string, Policy>();

export interface Active { id: string; version: number; hash: string; policy: Policy }

export async function activePolicy(tx: Tx): Promise<Active> {
  const row = (await tx.query("SELECT id, version, source, content_hash FROM policy_versions WHERE status = 'active' LIMIT 1")).rows[0];
  if (!row) throw new Error("No active policy for this institution");
  let p = cache.get(row.content_hash);
  if (!p) {
    const c = compile(row.source);
    if (!c.ok || !c.policy) throw new Error(`Active policy v${row.version} does not compile: ${c.errors.join("; ")}`);
    p = c.policy;
    cache.set(row.content_hash, p);
  }
  return { id: row.id, version: row.version, hash: row.content_hash, policy: p };
}

export async function decide(tx: Tx, action: Action, ctx: unknown): Promise<Evaluation & { policyVersionId: string }> {
  const a = await activePolicy(tx);
  return { ...evaluate(a.policy, action, ctx, { hash: a.hash, version: a.version }), policyVersionId: a.id };
}

/** Compact form for audit details and case history. */
export const brief = (e: Evaluation) => ({ result: e.result, rule: e.rule, version: e.version, hash: e.policyHash.slice(0, 16), failed: e.trace.filter((t) => !t.passed).map((t) => t.rule) });
