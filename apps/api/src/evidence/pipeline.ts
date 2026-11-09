import { createPublicKey, verify } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { PACKAGE_FORMAT, canonicalJson, type TransferPackage } from "@tigeris/shared";
import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { IMPORT_PURPOSE } from "./catalog";
import { parseEvidence, type FactDraft } from "./parsers";
import { ALLOWED_MEDIA, MAX_DOCUMENT_BYTES, RULE_SET_VERSION, outcomeOf, screenInjection, type Check } from "./validate";
import { getObject, putObject, sha256 } from "./vault";

interface Job { id: string; institution_id: string; kind: string; label: string; payload_ref: string; created_by: string | null; created_by_label: string }
interface SourceRow { id: string; key: string; status: string; allowed_purposes: string[]; freshness_limit_hours: number; source_class: string; name: string }

export interface FileOutcome { name: string; title: string; sourceKey: string; outcome: string; facts: number; evidenceId?: string; reasons: string[] }
export interface JobResult { summary: string; files: FileOutcome[]; conflicts: number; signer?: string; packageId?: string; graph?: { entities: number; relationships: number; hash: string } }

const svc = (job: Job) => ({ actorType: "service" as const, actorId: "ingestion-worker", actorLabel: `Ingestion worker for ${job.created_by_label}` });

async function sourceByKey(tx: Tx, key: string): Promise<SourceRow | undefined> {
  return (await tx.query<SourceRow>("SELECT id, key, status, allowed_purposes, freshness_limit_hours, source_class, name FROM sources WHERE key = $1", [key])).rows[0];
}

async function insertFacts(tx: Tx, institutionId: string, evidenceId: string, facts: FactDraft[]) {
  const chunk = 500;
  for (let i = 0; i < facts.length; i += chunk) {
    const part = facts.slice(i, i + chunk);
    const col = <K extends keyof FactDraft>(k: K, d: unknown = null) => part.map((f) => (f[k] ?? d) as unknown);
    await tx.query(
      `INSERT INTO evidence_facts (institution_id, evidence_id, subject, subject_label, predicate, predicate_label, value_num, value_text, unit, period, qualifier,
                                   claim_class, review_state, locator, excerpt, extraction_method, extraction_version)
       SELECT $1, $2, * FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::float8[], $8::text[], $9::text[], $10::text[], $11::text[],
                                    $12::text[], $13::text[], $14::text[], $15::text[], $16::text[], $17::text[])`,
      [institutionId, evidenceId, col("subject"), col("subjectLabel"), col("predicate"), col("predicateLabel"), col("valueNum"), col("valueText"), col("unit"),
        col("period"), col("qualifier"), col("claimClass"), col("reviewState", "accepted"), col("locator"), col("excerpt"), col("method"), part.map(() => "1")],
    );
  }
}

interface Candidate {
  sourceKey: string; name: string; title: string; originalUrl: string | null; mediaType: string; bytes: Buffer;
  retrievedAt: Date; eventTime: Date | null; sourceVersion: string | null; licence: string; transformations: unknown[];
  integrity: Check[]; dataClass?: string;
}

/** Validates, stores and parses one evidence object. Quarantined or rejected objects keep their record but yield no facts. */
async function ingestOne(tx: Tx, job: Job, c: Candidate): Promise<FileOutcome> {
  const checks: Check[] = [...c.integrity];
  const src = await sourceByKey(tx, c.sourceKey);
  checks.push(src
    ? { rule: "source.registered", label: "Source is registered", result: "pass", detail: src.name }
    : { rule: "source.registered", label: "Source is registered", result: "fail", detail: `No source "${c.sourceKey}" in this institution's registry` });
  if (src) {
    checks.push(src.status === "approved"
      ? { rule: "source.approved", label: "Source is approved for use", result: "pass", detail: "Approved" }
      : { rule: "source.approved", label: "Source is approved for use", result: "fail", detail: `Source status is ${src.status.replace("_", " ")}` });
    const purpose = IMPORT_PURPOSE[c.sourceKey] ?? "unspecified";
    checks.push(src.allowed_purposes.includes(purpose)
      ? { rule: "source.purpose", label: "Use is within the allowed purpose", result: "pass", detail: purpose.replace("_", " ") }
      : { rule: "source.purpose", label: "Use is within the allowed purpose", result: "fail", detail: `Purpose "${purpose}" is not allowed for this source` });
    const ageH = (Date.now() - c.retrievedAt.getTime()) / 3_600_000;
    checks.push(ageH <= src.freshness_limit_hours
      ? { rule: "freshness", label: "Within freshness limit", result: "pass", detail: `Retrieved ${Math.max(0, Math.round(ageH))} h ago; limit ${src.freshness_limit_hours} h` }
      : { rule: "freshness", label: "Within freshness limit", result: "warn", detail: `Retrieved ${Math.round(ageH / 24)} days ago; limit ${Math.round(src.freshness_limit_hours / 24)} days` });
  }
  checks.push(ALLOWED_MEDIA.includes(c.mediaType)
    ? { rule: "file.type", label: "Allowed file type", result: "pass", detail: c.mediaType }
    : { rule: "file.type", label: "Allowed file type", result: "fail", detail: `${c.mediaType} is not on the allowlist` });

  const hash = sha256(c.bytes);
  const dup = (await tx.query<{ id: string }>("SELECT id FROM evidence_objects WHERE sha256 = $1 AND duplicate_of IS NULL ORDER BY created_at LIMIT 1", [hash])).rows[0];
  if (dup) checks.push({ rule: "duplicate", label: "Not already imported", result: "warn", detail: "Identical content already imported; linked instead of re-extracted" });

  let facts: FactDraft[] = [];
  const blocked = checks.some((x) => x.result === "fail");
  if (!blocked && !dup) {
    try {
      const parsed = await parseEvidence(c.sourceKey, c.mediaType, c.bytes, c.retrievedAt);
      facts = parsed.facts;
      checks.push({ rule: "schema", label: "Content matches the expected structure", result: "pass", detail: `${facts.length} ${facts.length === 1 ? "fact" : "facts"} extracted` });
      if (parsed.text !== undefined) {
        const inj = screenInjection(parsed.text);
        checks.push(inj.hits.length
          ? { rule: "injection.screen", label: "No instructions aimed at AI systems", result: "fail", detail: `Document ${inj.hits.join("; ")}. Excerpt: "${inj.excerpt}"` }
          : { rule: "injection.screen", label: "No instructions aimed at AI systems", result: "pass", detail: "No instruction-like text found" });
      }
      if (parsed.signals?.hiddenTextChars !== undefined) {
        checks.push(parsed.signals.hiddenTextChars > 0
          ? { rule: "hidden.text", label: "No hidden text", result: "fail", detail: `${parsed.signals.hiddenTextChars} characters drawn below a legible size` }
          : { rule: "hidden.text", label: "No hidden text", result: "pass", detail: `${parsed.signals.pages} page(s) checked` });
      }
      if (facts.length === 0) checks.push({ rule: "content.facts", label: "Contains usable facts", result: "warn", detail: "No facts could be extracted" });
    } catch (e) {
      checks.push({ rule: "schema", label: "Content matches the expected structure", result: "fail", detail: (e as Error).message });
    }
  }

  const outcome = outcomeOf(checks);
  const stored = await putObject(job.institution_id, c.bytes);
  const dataClass = c.dataClass ?? (facts.some((f) => f.claimClass === "synthetic") ? "synthetic" : src?.source_class === "reference" ? "illustrative" : src?.source_class ?? "public");
  const ev = await tx.query<{ id: string }>(
    `INSERT INTO evidence_objects (institution_id, source_id, ingestion_job_id, external_key, title, original_url, media_type, size_bytes, sha256, vault_key,
       event_time, retrieved_at, source_version, data_class, classification, rights, transformations, validation_state, duplicate_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
    [job.institution_id, src?.id ?? (await sourceByKey(tx, "upload.documents"))!.id, job.id, c.name, c.title, c.originalUrl, c.mediaType, c.bytes.length, hash, stored.key,
      c.eventTime, c.retrievedAt, c.sourceVersion, dataClass, dataClass === "public" ? "public" : "internal", c.licence, JSON.stringify(c.transformations), outcome, dup?.id ?? null],
  );
  const evidenceId = ev.rows[0]!.id;
  await tx.query(
    "INSERT INTO validation_runs (institution_id, evidence_id, rule_set_version, checks, outcome, evaluator) VALUES ($1,$2,$3,$4,$5,$6)",
    [job.institution_id, evidenceId, RULE_SET_VERSION, JSON.stringify(checks), outcome, "ingestion-worker"],
  );
  const keep = outcome === "accepted" || outcome === "warning";
  if (keep && facts.length) await insertFacts(tx, job.institution_id, evidenceId, facts);
  await appendAudit(tx, job.institution_id, {
    ...svc(job), action: `evidence.${outcome}`, resourceType: "evidence", resourceId: evidenceId,
    details: { title: c.title, source: c.sourceKey, sha256: hash, facts: keep ? facts.length : 0, failed: checks.filter((x) => x.result === "fail").map((x) => x.rule) },
  });
  return { name: c.name, title: c.title, sourceKey: c.sourceKey, outcome, facts: keep ? facts.length : 0, evidenceId, reasons: checks.filter((x) => x.result !== "pass").map((x) => `${x.label}: ${x.detail}`) };
}

/**
 * Cross-source conflicts (TR-009): the same measure for the same place and period from two
 * different sources that disagree beyond a tolerance. Both values are kept; the newer evidence is flagged.
 */
async function flagConflicts(tx: Tx, job: Job): Promise<number> {
  // The facts this import just inserted are not in the table statistics yet, so the planner can guess "few rows"
  // and choose a nested loop that compares every fact with every other (minutes). A hash or merge join is fast at
  // any size, so nested loops are off for this one query and back on right after.
  await tx.query("SET LOCAL enable_nestloop = off");
  const rows = (await tx.query(
    `SELECT a.evidence_id, a.subject_label, a.predicate_label, a.period, a.value_num AS a_val, b.value_num AS b_val, a.unit,
            sa.name AS a_source, sb.name AS b_source, b.id AS other_fact
       FROM evidence_facts a
       JOIN evidence_objects ea ON ea.id = a.evidence_id AND ea.ingestion_job_id = $1
       -- institution_id is implied by row-level security; stating it lets the (institution, predicate, subject, period)
       -- index serve this join.
       JOIN evidence_facts b ON b.institution_id = a.institution_id AND b.predicate = a.predicate AND b.subject = a.subject AND b.period = a.period AND b.id <> a.id
       JOIN evidence_objects eb ON eb.id = b.evidence_id AND eb.source_id <> ea.source_id
       JOIN sources sa ON sa.id = ea.source_id JOIN sources sb ON sb.id = eb.source_id
      WHERE a.value_num IS NOT NULL AND b.value_num IS NOT NULL AND a.qualifier IS NULL AND b.qualifier IS NULL
        AND abs(a.value_num - b.value_num) > greatest(0.5, 0.1 * greatest(abs(a.value_num), abs(b.value_num)))
        AND sa.name < sb.name`,
    [job.id],
  )).rows;
  await tx.query("SET LOCAL enable_nestloop = on");
  const byEvidence = new Map<string, typeof rows>();
  for (const r of rows) byEvidence.set(r.evidence_id, [...(byEvidence.get(r.evidence_id) ?? []), r]);
  for (const [evidenceId, list] of byEvidence) {
    const checks: Check[] = list.slice(0, 25).map((r) => ({
      rule: "conflict.cross_source", label: "Agrees with other sources", result: "warn",
      detail: `${r.subject_label} · ${r.predicate_label} · ${r.period}: ${r.a_source} ${Number(r.a_val).toFixed(2)} vs ${r.b_source} ${Number(r.b_val).toFixed(2)} ${r.unit ?? ""}`.trim(),
    }));
    await tx.query("INSERT INTO validation_runs (institution_id, evidence_id, rule_set_version, checks, outcome, evaluator) VALUES ($1,$2,$3,$4,'warning','conflict-check')",
      [job.institution_id, evidenceId, `${RULE_SET_VERSION}.conflicts`, JSON.stringify(checks)]);
    await tx.query("UPDATE evidence_objects SET validation_state = 'warning' WHERE id = $1 AND validation_state = 'accepted'", [evidenceId]);
  }
  if (rows.length) {
    await appendAudit(tx, job.institution_id, { ...svc(job), action: "evidence.conflicts_flagged", resourceType: "ingestion_job", resourceId: job.id, details: { conflicts: rows.length, evidence: byEvidence.size } });
  }
  return rows.length;
}

async function runPackage(tx: Tx, job: Job): Promise<JobResult> {
  const raw = await getObject(job.institution_id, job.payload_ref);
  let pkg: TransferPackage;
  try {
    // Capped: a small crafted file must not expand to gigabytes and take the API down ("zip bomb").
    pkg = JSON.parse(gunzipSync(raw, { maxOutputLength: MAX_PACKAGE_BYTES }).toString("utf8"));
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new PackageRejected(`The package expands to more than ${MAX_PACKAGE_BYTES / 1024 / 1024} MB, the limit for one import.`);
    throw new PackageRejected("The file is not a TIGERIS transfer package (could not decompress and read it).");
  }
  if (pkg.format !== PACKAGE_FORMAT) throw new PackageRejected(`Unsupported package format "${String(pkg.format)}".`);
  const signer = (await tx.query("SELECT name, public_key_pem FROM trusted_signers WHERE fingerprint = $1 AND status = 'active'", [pkg.signature?.keyFingerprint])).rows[0];
  if (!signer) throw new PackageRejected(`The package is signed by key ${pkg.signature?.keyFingerprint ?? "(none)"}, which this institution does not trust.`);
  const ok = verify(null, Buffer.from(canonicalJson(pkg.manifest)), createPublicKey(signer.public_key_pem), Buffer.from(pkg.signature.value, "base64"));
  if (!ok) throw new PackageRejected("The signature does not match the manifest. The package was changed after it was signed.");
  await appendAudit(tx, job.institution_id, { ...svc(job), action: "package.signature_verified", resourceType: "package", resourceId: pkg.manifest.packageId, details: { signer: signer.name, fingerprint: pkg.signature.keyFingerprint, files: pkg.manifest.files.length } });

  const files: FileOutcome[] = [];
  const slug = (await tx.query("SELECT slug FROM institutions WHERE id = $1", [job.institution_id])).rows[0]?.slug;
  for (const f of pkg.manifest.files) {
    if (f.intendedInstitution && f.intendedInstitution !== slug) {
      files.push({ name: f.name, title: f.title, sourceKey: f.sourceKey, outcome: "skipped", facts: 0, reasons: ["Intended for another institution; not opened"] });
      continue;
    }
    const b64 = pkg.files[f.name];
    const bytes = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
    const actual = sha256(bytes);
    const integrity: Check[] = [
      actual === f.sha256 && bytes.length === f.size
        ? { rule: "integrity.hash", label: "File matches its signed hash", result: "pass", detail: `SHA-256 ${actual.slice(0, 16)}…` }
        : { rule: "integrity.hash", label: "File matches its signed hash", result: "fail", detail: b64 ? `Expected ${f.sha256.slice(0, 16)}…, got ${actual.slice(0, 16)}…` : "File missing from package" },
      { rule: "integrity.signature", label: "Package signature verified", result: "pass", detail: signer.name },
    ];
    files.push(await ingestOne(tx, job, {
      sourceKey: f.sourceKey, name: f.name, title: f.title, originalUrl: f.originalUrl, mediaType: f.mediaType, bytes,
      retrievedAt: new Date(f.retrievedAt), eventTime: f.eventTime ? new Date(f.eventTime) : null, sourceVersion: f.sourceVersion,
      licence: f.licence, transformations: f.transformations, integrity,
    }));
  }
  const conflicts = await flagConflicts(tx, job);
  const states = new Map((await tx.query("SELECT id, validation_state FROM evidence_objects WHERE ingestion_job_id = $1", [job.id])).rows.map((r) => [r.id, r.validation_state]));
  for (const f of files) if (f.evidenceId && states.get(f.evidenceId) === "warning" && f.outcome === "accepted") { f.outcome = "warning"; f.reasons.push("Disagrees with another source beyond tolerance"); }
  const n = (o: string) => files.filter((x) => x.outcome === o).length;
  return {
    summary: `${files.length - n("skipped")} files${n("skipped") ? ` (${n("skipped")} for another institution, skipped)` : ""}: ${n("accepted")} accepted, ${n("warning")} with warnings, ${n("quarantined")} quarantined, ${n("rejected")} rejected. ${files.reduce((s, x) => s + x.facts, 0)} facts. ${conflicts} cross-source conflicts flagged.`,
    files, conflicts, signer: signer.name, packageId: pkg.manifest.packageId,
  };
}

async function runDocument(tx: Tx, job: Job): Promise<JobResult> {
  const bytes = await getObject(job.institution_id, job.payload_ref);
  const isPdf = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  const integrity: Check[] = [
    isPdf ? { rule: "integrity.format", label: "File is a PDF", result: "pass", detail: "PDF header found" }
      : { rule: "integrity.format", label: "File is a PDF", result: "fail", detail: "The file does not start with a PDF header" },
    bytes.length <= MAX_DOCUMENT_BYTES ? { rule: "file.size", label: "Within size limit", result: "pass", detail: `${(bytes.length / 1024).toFixed(0)} KB` }
      : { rule: "file.size", label: "Within size limit", result: "fail", detail: `Larger than ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB` },
  ];
  const file = await ingestOne(tx, job, {
    sourceKey: "upload.documents", name: job.label, title: job.label.replace(/\.pdf$/i, ""), originalUrl: null, mediaType: "application/pdf", bytes,
    retrievedAt: new Date(), eventTime: null, sourceVersion: null, licence: "As stated in the document", transformations: [], integrity,
  });
  return { summary: `${file.title}: ${file.outcome}. ${file.facts} candidate figures for review.`, files: [file], conflicts: 0 };
}

export class PackageRejected extends Error {}

/** Largest a package may be once decompressed. */
export const MAX_PACKAGE_BYTES = 200 * 1024 * 1024;

export async function runJob(tx: Tx, job: Job): Promise<JobResult> {
  return job.kind === "package_import" ? runPackage(tx, job) : runDocument(tx, job);
}
