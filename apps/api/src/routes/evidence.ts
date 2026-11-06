import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withTenant } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";
import { enqueue } from "../evidence/jobs";

const DATA_DIR = path.resolve(import.meta.dirname, "../../../../data");
const PACKAGES = path.join(DATA_DIR, "packages");
const DEMO_DOCS = path.join(DATA_DIR, "demo-documents");

const fileName = (h: unknown, fallback: string) => {
  const n = typeof h === "string" ? decodeURIComponent(h) : fallback;
  return path.basename(n).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || fallback;
};

export async function latestBundledPackage(): Promise<string | undefined> {
  const files = (await readdir(PACKAGES).catch(() => [])).filter((f) => f.startsWith("public-snapshot") && f.endsWith(".tigpkg")).sort();
  return files.at(-1);
}

/** Every bundled package, in import order: public data, then reference geography, then synthetic context. */
export async function allBundledPackages(): Promise<string[]> {
  const order = (f: string) => (f.startsWith("public") ? 0 : f.startsWith("reference") ? 1 : 2);
  return (await readdir(PACKAGES).catch(() => [])).filter((f) => f.endsWith(".tigpkg")).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
}

export async function evidenceRoutes(app: FastifyInstance) {
  for (const type of ["application/octet-stream", "application/pdf", "application/gzip"]) {
    app.addContentTypeParser(type, { parseAs: "buffer", bodyLimit: 60 * 1024 * 1024 }, (_req, body, done) => done(null, body));
  }

  app.get("/sources", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      sources: (await tx.query(
        `SELECT s.*, (SELECT max(e.retrieved_at) FROM evidence_objects e WHERE e.source_id = s.id) AS last_retrieved_at,
                (SELECT count(*)::int FROM evidence_objects e WHERE e.source_id = s.id) AS evidence_count,
                (SELECT count(*)::int FROM evidence_objects e WHERE e.source_id = s.id AND e.validation_state IN ('quarantined','rejected')) AS quarantined_count,
                (SELECT count(*)::int FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id WHERE e.source_id = s.id) AS fact_count
           FROM sources s ORDER BY CASE s.status WHEN 'approved' THEN 0 WHEN 'pending_review' THEN 1 ELSE 2 END, s.name`,
      )).rows.map((s) => {
        const ageH = s.last_retrieved_at ? (Date.now() - new Date(s.last_retrieved_at).getTime()) / 3_600_000 : null;
        return { ...s, freshness: ageH === null ? "no_data" : ageH <= s.freshness_limit_hours ? "fresh" : "stale" };
      }),
      signers: (await tx.query("SELECT name, fingerprint, status, created_at FROM trusted_signers ORDER BY created_at")).rows,
      bundledPackage: await latestBundledPackage(),
    }));
  });

  app.get("/jobs", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      jobs: (await tx.query("SELECT id, kind, status, label, attempts, result, error, created_by_label, created_at, finished_at FROM ingestion_jobs ORDER BY created_at DESC LIMIT 30")).rows,
    }));
  });

  app.get("/jobs/:id", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const job = await withTenant(p.institutionId, async (tx) => (await tx.query("SELECT id, kind, status, label, attempts, result, error, created_at, finished_at FROM ingestion_jobs WHERE id = $1", [id])).rows[0]);
    return job ?? reply.code(404).send({ error: "not_found", message: "No such import in this institution." });
  });

  /** Air-gap import: a signed transfer package carried in from outside the boundary (TR-017, Q092). */
  app.post("/sources/packages", { preHandler: requirePermission("source.manage") }, async (req, reply) => {
    const p = req.principal!;
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(400).send({ error: "empty", message: "Choose a .tigpkg file to import." });
    const body = req.body;
    const label = fileName(req.headers["x-file-name"], "package.tigpkg");
    return withTenant(p.institutionId, (tx) => enqueue(tx, { institutionId: p.institutionId, kind: "package_import", label, bytes: body, actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role }));
  });

  app.post("/sources/packages/bundled", { preHandler: requirePermission("source.manage") }, async (req, reply) => {
    const p = req.principal!;
    const name = await latestBundledPackage();
    if (!name) return reply.code(404).send({ error: "no_package", message: "No snapshot package is bundled with this installation. Run the collector first." });
    const bytes = await readFile(path.join(PACKAGES, name));
    return withTenant(p.institutionId, (tx) => enqueue(tx, { institutionId: p.institutionId, kind: "package_import", label: name, bytes, actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role }));
  });

  /** Live document upload by an analyst or presenter (Q051, Q052). */
  app.post("/evidence/documents", { preHandler: requirePermission("evidence.upload") }, async (req, reply) => {
    const p = req.principal!;
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return reply.code(400).send({ error: "empty", message: "Choose a PDF to upload." });
    const body = req.body;
    const label = fileName(req.headers["x-file-name"], "document.pdf");
    return withTenant(p.institutionId, (tx) => enqueue(tx, { institutionId: p.institutionId, kind: "document_upload", label, bytes: body, actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role }));
  });

  app.get("/evidence/demo-documents", { preHandler: requirePermission("evidence.read") }, async () => ({
    documents: (await readdir(DEMO_DOCS).catch(() => [])).filter((f) => f.endsWith(".pdf")).sort(),
  }));

  /** Uploads one of the bundled demonstration PDFs, so a presenter does not need the file at hand. */
  app.post("/evidence/demo-documents/:name", { preHandler: requirePermission("evidence.upload") }, async (req, reply) => {
    const { name } = z.object({ name: z.string().regex(/^[\w.-]+\.pdf$/) }).parse(req.params);
    const bytes = await readFile(path.join(DEMO_DOCS, name)).catch(() => undefined);
    if (!bytes) return reply.code(404).send({ error: "not_found", message: "That demonstration document is not bundled." });
    const p = req.principal!;
    return withTenant(p.institutionId, (tx) => enqueue(tx, { institutionId: p.institutionId, kind: "document_upload", label: name, bytes, actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role }));
  });

  app.get("/evidence", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const q = z.object({ state: z.enum(["accepted", "warning", "quarantined", "rejected"]).optional() }).parse(req.query);
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      evidence: (await tx.query(
        `SELECT e.id, e.title, e.media_type, e.size_bytes, e.sha256, e.event_time, e.retrieved_at, e.data_class, e.classification, e.validation_state, e.duplicate_of,
                s.name AS source_name, s.key AS source_key, (SELECT count(*)::int FROM evidence_facts f WHERE f.evidence_id = e.id) AS fact_count
           FROM evidence_objects e JOIN sources s ON s.id = e.source_id
          WHERE ($1::text IS NULL OR e.validation_state = $1) ORDER BY e.created_at DESC LIMIT 200`,
        [q.state ?? null],
      )).rows,
    }));
  });

  app.get("/evidence/:id", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const data = await withTenant(p.institutionId, async (tx) => {
      const ev = (await tx.query(
        `SELECT e.*, s.name AS source_name, s.publisher, s.key AS source_key, s.licence AS source_licence, j.label AS job_label, j.created_by_label, j.kind AS job_kind
           FROM evidence_objects e JOIN sources s ON s.id = e.source_id JOIN ingestion_jobs j ON j.id = e.ingestion_job_id WHERE e.id = $1`, [id])).rows[0];
      if (!ev) return undefined;
      const validations = (await tx.query("SELECT rule_set_version, checks, outcome, evaluator, created_at FROM validation_runs WHERE evidence_id = $1 ORDER BY created_at", [id])).rows;
      const facts = (await tx.query("SELECT id, subject_label, predicate_label, value_num, value_text, unit, period, qualifier, claim_class, review_state, locator, excerpt FROM evidence_facts WHERE evidence_id = $1 ORDER BY predicate, subject, period DESC LIMIT 100", [id])).rows;
      return { evidence: ev, validations, facts };
    });
    return data ?? reply.code(404).send({ error: "not_found", message: "No such evidence in this institution." });
  });

  /** Lineage for one fact: source → package/upload → evidence → validation → extraction (FR-08, AC-03, TR-038). */
  app.get("/facts/:id/lineage", { preHandler: requirePermission("evidence.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const data = await withTenant(p.institutionId, async (tx) => {
      const fact = (await tx.query("SELECT * FROM evidence_facts WHERE id = $1", [id])).rows[0];
      if (!fact) return undefined;
      const evidence = (await tx.query(
        `SELECT e.id, e.title, e.original_url, e.media_type, e.size_bytes, e.sha256, e.event_time, e.retrieved_at, e.source_version, e.data_class, e.classification, e.rights, e.transformations, e.validation_state,
                j.id AS job_id, j.kind AS job_kind, j.label AS job_label, j.created_by_label, j.created_at AS imported_at, j.result->>'signer' AS signer, j.result->>'packageId' AS package_id
           FROM evidence_objects e JOIN ingestion_jobs j ON j.id = e.ingestion_job_id WHERE e.id = $1`, [fact.evidence_id])).rows[0];
      const source = (await tx.query("SELECT s.key, s.name, s.publisher, s.source_class, s.licence, s.url, s.cadence, s.owner_label, s.status FROM sources s JOIN evidence_objects e ON e.source_id = s.id WHERE e.id = $1", [fact.evidence_id])).rows[0];
      const validations = (await tx.query("SELECT rule_set_version, checks, outcome, created_at FROM validation_runs WHERE evidence_id = $1 ORDER BY created_at", [fact.evidence_id])).rows;
      const others = (await tx.query(
        `SELECT f.id, f.value_num, f.unit, f.qualifier, s.name AS source_name FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
          WHERE f.subject = $1 AND f.predicate = $2 AND f.period IS NOT DISTINCT FROM $3 AND f.id <> $4 LIMIT 10`, [fact.subject, fact.predicate, fact.period, id])).rows;
      return { fact, evidence, source, validations, otherSources: others };
    });
    return data ?? reply.code(404).send({ error: "not_found", message: "No such fact in this institution." });
  });

  /** Curated public indicators for the six GCC states, each value carrying its fact id for lineage. */
  app.get("/indicators", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => {
      const latest = async (predicate: string, sourceKey: string, opts: { actualOnly?: boolean } = {}) =>
        (await tx.query(
          `SELECT DISTINCT ON (f.subject) f.id, f.subject, f.subject_label, f.value_num, f.unit, f.period, f.qualifier, f.claim_class, s.name AS source_name, e.validation_state,
                  EXISTS (SELECT 1 FROM evidence_facts o JOIN evidence_objects oe ON oe.id = o.evidence_id
                           WHERE o.predicate = f.predicate AND o.subject = f.subject AND o.period = f.period AND oe.source_id <> e.source_id
                             AND o.qualifier IS NULL AND abs(o.value_num - f.value_num) > greatest(0.5, 0.1 * greatest(abs(o.value_num), abs(f.value_num)))) AS conflict
             FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
            WHERE f.predicate = $1 AND s.key = $2 AND f.value_num IS NOT NULL AND ($3::bool IS FALSE OR f.qualifier IS NULL) AND e.duplicate_of IS NULL
            ORDER BY f.subject, f.period DESC`, [predicate, sourceKey, opts.actualOnly ?? false])).rows;
      const columns = [
        { key: "gdp", label: "GDP", rows: await latest("gdp_current_usd", "worldbank.wdi") },
        { key: "growth", label: "Real GDP growth", rows: await latest("real_gdp_growth_pct", "imf.weo", { actualOnly: true }) },
        { key: "inflation_wb", label: "Inflation (World Bank)", rows: await latest("inflation_cpi_pct", "worldbank.wdi") },
        { key: "inflation_imf", label: "Inflation (IMF)", rows: await latest("inflation_cpi_pct", "imf.weo", { actualOnly: true }) },
        { key: "reserves", label: "Reserves", rows: await latest("reserves_usd", "worldbank.wdi") },
        { key: "food", label: "Food imports share", rows: await latest("food_imports_pct_merch", "worldbank.wdi") },
        { key: "crude", label: "Crude production", rows: await latest("crude_production_kbd", "jodi.oil") },
        { key: "crude_exports", label: "Crude exports", rows: await latest("crude_exports_kbd", "jodi.oil") },
      ];
      const hormuz = (await tx.query(
        `SELECT f.id, f.subject_label, f.predicate_label, f.value_num, f.unit, f.period, f.excerpt, f.claim_class, s.name AS source_name
           FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
          WHERE s.key = 'eia.chokepoints' AND f.predicate <> 'stated_figure' AND e.duplicate_of IS NULL ORDER BY f.subject, f.predicate`)).rows;
      const sanctions = (await tx.query(
        `SELECT s.name AS source_name, count(*)::int AS vessels FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id JOIN sources s ON s.id = e.source_id
          WHERE f.predicate = 'sanctions_designation' AND e.duplicate_of IS NULL GROUP BY s.name ORDER BY s.name`)).rows;
      return { countries: ["SAU", "ARE", "QAT", "KWT", "OMN", "BHR"], columns, hormuz, sanctions };
    });
  });

  app.get("/facts/review", { preHandler: requirePermission("evidence.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      facts: (await tx.query(
        `SELECT f.id, f.value_num, f.value_text, f.unit, f.locator, f.claim_class, f.review_state, e.title AS evidence_title, e.id AS evidence_id
           FROM evidence_facts f JOIN evidence_objects e ON e.id = f.evidence_id
          WHERE f.review_state = 'needs_review' AND e.duplicate_of IS NULL ORDER BY e.created_at DESC, f.locator LIMIT 50`)).rows,
    }));
  });

  /** Analyst accepts or rejects a candidate figure; recorded in the audit trail (FR-10). */
  app.post("/facts/:id/review", { preHandler: requirePermission("evidence.dispose") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { decision, rationale } = z.object({ decision: z.enum(["accepted", "rejected"]), rationale: z.string().max(500).optional() }).parse(req.body);
    const p = req.principal!;
    const ok = await withTenant(p.institutionId, async (tx) => {
      const r = await tx.query("UPDATE evidence_facts SET review_state = $2 WHERE id = $1 AND review_state = 'needs_review' RETURNING id", [id, decision]);
      if (!r.rowCount) return false;
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: `fact.${decision}`, resourceType: "fact", resourceId: id, details: { rationale: rationale ?? null } });
      return true;
    });
    return ok ? { status: decision } : reply.code(409).send({ error: "not_pending", message: "This figure has already been reviewed." });
  });
}
