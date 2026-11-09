import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { evaluate, type Action } from "../policy/engine";
import { activePolicy, brief, decide } from "../policy/store";
import type { Actor } from "./decisions";

/**
 * Decision envelopes (playbook "decision velocity"; FR-34, FR-35, TR-046). The committee pre-approves an
 * envelope once: the domain, the authority it delegates, a size limit on the option's remaining 90-day value at
 * risk, who may authorise inside it and an expiry. A decision that fits needs one named authoriser instead of the
 * committee's approvals; anything outside goes to the committee as before. The fit is decided by the active
 * policy (action decision.envelope), never by a model. Nothing executes.
 */
export interface EnvelopeRow {
  id: string; name: string; mandate: string; domain: string; authority: string; max_var_usd: string | number;
  authoriser_roles: string[]; expires_at: string | Date; status: "proposed" | "active" | "revoked"; proposed_by: string;
}

export const envelopeContext = (e: EnvelopeRow) => ({
  id: e.id, status: e.status, expired: new Date(e.expires_at).getTime() <= Date.now(), domain: e.domain, authority: e.authority,
  max_var_usd: Number(e.max_var_usd), authoriser_roles: e.authoriser_roles, proposed_by: e.proposed_by,
});

/** Refuses outright when the active policy has no rules for an envelope action: envelopes are then switched off. */
async function decideStrict(tx: Tx, action: Action, ctx: unknown) {
  const a = await activePolicy(tx);
  if (!a.policy.rules.some((r) => r.action === action)) return null;
  return decide(tx, action, ctx);
}

/** Does this option fit this envelope for this person? Pure policy evaluation over a built context. */
export async function envelopeFit(tx: Tx, e: EnvelopeRow, actor: Actor, c: { domain: string }, rec: { authority: string; effect: { var_90d: { with: number } } }) {
  const ctx = {
    actor: { id: actor.id, role: actor.role, may_authorise: e.authoriser_roles.includes(actor.role) },
    case: { domain: c.domain },
    recommendation: { authority: rec.authority, var_90d: Math.abs(Number(rec.effect.var_90d.with)) },
    envelope: envelopeContext(e),
  };
  const pol = await decideStrict(tx, "decision.envelope", ctx);
  return { ctx, pol };
}

/** The same check without a transaction-bound policy lookup, for previews on many options. */
export function envelopeFitPreview(policy: Parameters<typeof evaluate>[0], meta: { hash: string; version: number }, e: EnvelopeRow, actor: { id: string; role: string }, c: { domain: string }, rec: { authority: string; var_with: number }) {
  if (!policy.rules.some((r) => r.action === "decision.envelope")) return null;
  const ctx = {
    actor: { id: actor.id, role: actor.role, may_authorise: e.authoriser_roles.includes(actor.role) },
    case: { domain: c.domain }, recommendation: { authority: rec.authority, var_90d: Math.abs(rec.var_with) }, envelope: envelopeContext(e),
  };
  const r = evaluate(policy, "decision.envelope", ctx, meta);
  return { result: r.result, explanation: r.explanation, rule: r.rule };
}

export async function listEnvelopes(tx: Tx) {
  const rows = (await tx.query(
    `SELECT e.*, (SELECT count(*)::int FROM decisions d WHERE d.envelope_id = e.id) AS uses
       FROM decision_envelopes e ORDER BY (e.status = 'active') DESC, e.created_at DESC`)).rows;
  return rows.map((e) => ({ ...e, max_var_usd: Number(e.max_var_usd), expired: new Date(e.expires_at).getTime() <= Date.now() }));
}

export interface EnvelopeInput { name: string; mandate: string; domain: string; authority: string; maxVarUsd: number; authoriserRoles: string[]; validDays: number }

export async function proposeEnvelope(tx: Tx, inst: string, actor: Actor, b: EnvelopeInput) {
  const pol = await decideStrict(tx, "envelope.propose", { actor: { id: actor.id, role: actor.role } });
  if (!pol) return { status: 409 as const, message: "The active policy has no envelope rules, so envelopes are switched off." };
  if (pol.result !== "PASS") {
    await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "envelope.refused", resourceType: "decision_envelope", resourceId: null, details: { step: "propose", policy: brief(pol) } });
    return { status: (pol.result === "BLOCK" ? 403 : 409) as 403 | 409, policy: pol, message: pol.explanation };
  }
  const expires = new Date(Date.now() + b.validDays * 86_400_000).toISOString();
  const e = (await tx.query(
    `INSERT INTO decision_envelopes (institution_id, name, mandate, domain, authority, max_var_usd, authoriser_roles, expires_at, proposed_by, proposed_by_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [inst, b.name, b.mandate, b.domain, b.authority, b.maxVarUsd, b.authoriserRoles, expires, actor.id, actor.label])).rows[0]!;
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "envelope.proposed", resourceType: "decision_envelope", resourceId: e.id,
    details: { name: b.name, domain: b.domain, authority: b.authority, maxVarUsd: b.maxVarUsd, authoriserRoles: b.authoriserRoles, expiresAt: expires, policy: brief(pol) } });
  return { status: 200 as const, envelopeId: e.id as string };
}

export async function activateEnvelope(tx: Tx, inst: string, actor: Actor, id: string, note: string) {
  const e = (await tx.query("SELECT * FROM decision_envelopes WHERE id = $1 FOR UPDATE", [id])).rows[0] as EnvelopeRow | undefined;
  if (!e) return { status: 404 as const, message: "No such envelope." };
  const pol = await decideStrict(tx, "envelope.activate", { actor: { id: actor.id, role: actor.role }, envelope: envelopeContext(e) });
  if (!pol) return { status: 409 as const, message: "The active policy has no envelope rules, so envelopes are switched off." };
  if (pol.result !== "PASS") {
    await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "envelope.refused", resourceType: "decision_envelope", resourceId: id, details: { step: "activate", policy: brief(pol) } });
    return { status: (pol.result === "BLOCK" ? 403 : 409) as 403 | 409, policy: pol, message: pol.explanation };
  }
  await tx.query("UPDATE decision_envelopes SET status = 'active', activated_by = $2, activated_by_label = $3, activated_at = now(), activation_note = $4 WHERE id = $1", [id, actor.id, actor.label, note]);
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "envelope.activated", resourceType: "decision_envelope", resourceId: id, details: { name: e.name, note, policy: brief(pol) } });
  return { status: 200 as const };
}

export async function revokeEnvelope(tx: Tx, inst: string, actor: Actor, id: string, reason: string) {
  const e = (await tx.query("SELECT * FROM decision_envelopes WHERE id = $1 FOR UPDATE", [id])).rows[0] as EnvelopeRow | undefined;
  if (!e) return { status: 404 as const, message: "No such envelope." };
  if (e.status === "revoked") return { status: 409 as const, message: "This envelope is already revoked." };
  const pol = await decideStrict(tx, "envelope.revoke", { actor: { id: actor.id, role: actor.role }, envelope: envelopeContext(e) });
  if (!pol) return { status: 409 as const, message: "The active policy has no envelope rules, so envelopes are switched off." };
  if (pol.result !== "PASS") return { status: (pol.result === "BLOCK" ? 403 : 409) as 403 | 409, policy: pol, message: pol.explanation };
  await tx.query("UPDATE decision_envelopes SET status = 'revoked', revoked_by_label = $2, revoked_at = now(), revoke_reason = $3 WHERE id = $1", [id, actor.label, reason]);
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "envelope.revoked", resourceType: "decision_envelope", resourceId: id, details: { name: e.name, reason, policy: brief(pol) } });
  return { status: 200 as const };
}
