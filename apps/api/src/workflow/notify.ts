import type { Tx } from "../db";

export interface Note { kind: string; title: string; body: string; link: string }

export async function notifyPeople(tx: Tx, institutionId: string, principalIds: string[], n: Note) {
  if (!principalIds.length) return;
  await tx.query(
    `INSERT INTO notifications (institution_id, recipient_id, kind, title, body, link) SELECT $1, unnest($2::uuid[]), $3, $4, $5, $6`,
    [institutionId, principalIds, n.kind, n.title.slice(0, 200), n.body.slice(0, 500), n.link],
  );
}

export async function notifyRole(tx: Tx, institutionId: string, roles: string[], n: Note, exceptId?: string) {
  const ids = (await tx.query("SELECT principal_id FROM principal_roles WHERE role_key = ANY($1)", [roles])).rows.map((r) => r.principal_id as string).filter((id) => id !== exceptId);
  await notifyPeople(tx, institutionId, ids, n);
}
