import { createHash } from "node:crypto";
import type { Tx } from "./db";

export const GENESIS_HASH = "0".repeat(64);

export interface AuditInput {
  actorType: "human" | "service";
  actorId: string;
  actorLabel: string;
  actorRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  caseId?: string | null;
  details?: Record<string, unknown>;
}

interface ChainFields {
  institution_id: string;
  seq: number;
  occurred_at: string;
  actor_type: string;
  actor_id: string;
  actor_label: string;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  case_id: string | null;
  details: unknown;
}

/** Stable JSON: object keys sorted recursively, so the hash does not depend on key order. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

export function chainHash(prevHash: string, fields: ChainFields): string {
  return createHash("sha256").update(prevHash).update(canonical(fields)).digest("hex");
}

/**
 * Appends one event to the institution's chain. Must run inside withTenant.
 * An advisory lock per institution serialises appends so seq and prev_hash stay consistent.
 */
export async function appendAudit(tx: Tx, institutionId: string, input: AuditInput): Promise<{ seq: number; hash: string }> {
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`audit:${institutionId}`]);
  const last = await tx.query<{ seq: string; hash: string }>(
    "SELECT seq, hash FROM audit_events WHERE institution_id = $1 ORDER BY seq DESC LIMIT 1",
    [institutionId],
  );
  const prevHash = last.rows[0]?.hash ?? GENESIS_HASH;
  const seq = last.rows[0] ? Number(last.rows[0].seq) + 1 : 1;
  const occurredAt = new Date().toISOString();
  const fields: ChainFields = {
    institution_id: institutionId,
    seq,
    occurred_at: occurredAt,
    actor_type: input.actorType,
    actor_id: input.actorId,
    actor_label: input.actorLabel,
    actor_role: input.actorRole ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    case_id: input.caseId ?? null,
    details: input.details ?? {},
  };
  const hash = chainHash(prevHash, fields);
  await tx.query(
    `INSERT INTO audit_events (institution_id, seq, occurred_at, actor_type, actor_id, actor_label, actor_role,
       action, resource_type, resource_id, case_id, details, prev_hash, hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [institutionId, seq, occurredAt, fields.actor_type, fields.actor_id, fields.actor_label, fields.actor_role,
      fields.action, fields.resource_type, fields.resource_id, fields.case_id, JSON.stringify(fields.details), prevHash, hash],
  );
  return { seq, hash };
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  headHash: string;
  firstBrokenSeq: number | null;
  reason: string | null;
}

/** Recomputes every hash in the institution's chain and reports the first break, if any. */
export async function verifyChain(tx: Tx, institutionId: string): Promise<VerifyResult> {
  const rows = await tx.query(
    `SELECT institution_id, seq, occurred_at, actor_type, actor_id, actor_label, actor_role, action,
            resource_type, resource_id, case_id, details, prev_hash, hash
       FROM audit_events WHERE institution_id = $1 ORDER BY seq`,
    [institutionId],
  );
  let prev = GENESIS_HASH;
  let expectedSeq = 1;
  for (const r of rows.rows) {
    const seq = Number(r.seq);
    if (seq !== expectedSeq) return { ok: false, checked: expectedSeq - 1, headHash: prev, firstBrokenSeq: seq, reason: "Sequence gap" };
    if (r.prev_hash !== prev) return { ok: false, checked: seq - 1, headHash: prev, firstBrokenSeq: seq, reason: "Previous hash does not match" };
    const fields: ChainFields = {
      institution_id: r.institution_id,
      seq,
      occurred_at: new Date(r.occurred_at).toISOString(),
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      actor_label: r.actor_label,
      actor_role: r.actor_role,
      action: r.action,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      case_id: r.case_id,
      details: r.details,
    };
    if (chainHash(prev, fields) !== r.hash) return { ok: false, checked: seq - 1, headHash: prev, firstBrokenSeq: seq, reason: "Event content changed after it was recorded" };
    prev = r.hash;
    expectedSeq++;
  }
  return { ok: true, checked: rows.rows.length, headHash: prev, firstBrokenSeq: null, reason: null };
}
