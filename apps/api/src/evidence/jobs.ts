import { appPool, withTenant, type Tx } from "../db";
import { appendAudit } from "../audit";
import { PackageRejected, runJob } from "./pipeline";
import { putObject } from "./vault";
import { buildGraph } from "../graph/build";

/** Queues a job. The idempotency key (content hash) makes a repeated upload return the existing job (TR-003). */
export async function enqueue(tx: Tx, args: { institutionId: string; kind: "package_import" | "document_upload"; label: string; bytes: Buffer; actorId: string; actorLabel: string; actorRole: string }) {
  const stored = await putObject(args.institutionId, args.bytes);
  const key = `${args.kind}:${stored.sha256}`;
  const existing = (await tx.query("SELECT id, status FROM ingestion_jobs WHERE idempotency_key = $1", [key])).rows[0];
  if (existing) return { id: existing.id as string, status: existing.status as string, duplicate: true };
  const r = await tx.query<{ id: string }>(
    `INSERT INTO ingestion_jobs (institution_id, kind, idempotency_key, label, payload_ref, payload_sha256, created_by, created_by_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [args.institutionId, args.kind, key, args.label, stored.key, stored.sha256, args.actorId, args.actorLabel],
  );
  await appendAudit(tx, args.institutionId, {
    actorType: "human", actorId: args.actorId, actorLabel: args.actorLabel, actorRole: args.actorRole,
    action: `${args.kind}.queued`, resourceType: "ingestion_job", resourceId: r.rows[0]!.id, details: { label: args.label, sha256: stored.sha256, bytes: args.bytes.length },
  });
  return { id: r.rows[0]!.id, status: "queued", duplicate: false };
}

/** Claims and processes one due job. Returns false when the queue is empty. */
export async function processNext(): Promise<boolean> {
  const claimed = (await appPool.query("SELECT * FROM claim_next_ingestion_job()")).rows[0];
  if (!claimed) return false;
  const { job_id: jobId, institution_id: inst } = claimed;
  try {
    await withTenant(inst, async (tx) => {
      const job = (await tx.query("SELECT * FROM ingestion_jobs WHERE id = $1", [jobId])).rows[0];
      const result = await runJob(tx, job);
      // New package evidence updates the institution's graph in the same transaction (TR-022).
      if (job.kind === "package_import") result.graph = await buildGraph(tx, inst, "Graph builder (after import)");
      await tx.query("UPDATE ingestion_jobs SET status = 'succeeded', result = $2, finished_at = now(), error = NULL WHERE id = $1", [jobId, JSON.stringify(result)]);
      await appendAudit(tx, inst, { actorType: "service", actorId: "ingestion-worker", actorLabel: "Ingestion worker", action: `${job.kind}.completed`, resourceType: "ingestion_job", resourceId: jobId, details: { summary: result.summary } });
    });
  } catch (e) {
    const rejected = e instanceof PackageRejected;
    const message = rejected ? e.message : `Processing failed: ${(e as Error).message}`;
    await withTenant(inst, async (tx) => {
      const j = (await tx.query("SELECT attempts, max_attempts, kind FROM ingestion_jobs WHERE id = $1", [jobId])).rows[0];
      const retry = !rejected && j.attempts < j.max_attempts;
      await tx.query(
        `UPDATE ingestion_jobs SET status = $2, error = $3, run_after = now() + ($4 || ' seconds')::interval, finished_at = CASE WHEN $2 = 'failed' THEN now() END WHERE id = $1`,
        [jobId, retry ? "queued" : "failed", message, String(2 ** j.attempts)],
      );
      await appendAudit(tx, inst, { actorType: "service", actorId: "ingestion-worker", actorLabel: "Ingestion worker", action: rejected ? "package.rejected" : `${j.kind}.failed`, resourceType: "ingestion_job", resourceId: jobId, details: { error: message, willRetry: retry } });
    });
  }
  return true;
}

/** Drains the queue; used by tests and the seed so they do not depend on timing. */
export async function drainQueue(max = 50) {
  for (let i = 0; i < max && (await processNext()); i++);
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function startWorker(intervalMs = 750) {
  const tick = async () => {
    try {
      while (await processNext());
    } catch (e) {
      console.error("ingestion worker error", e);
    }
    timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
}
export const stopWorker = () => timer && clearTimeout(timer);
