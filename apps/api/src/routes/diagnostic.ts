import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DIAGNOSTIC_METHOD_VERSION, EVIDENCE_LEVELS, GAPS, VALUE_ASSUMPTIONS, assess, canonicalJson, reportMarkdown, validateAnswers, type DiagnosticAnswer } from "@tigeris/shared";
import { withTenant, type Tx } from "../db";
import { appendAudit } from "../audit";
import { requirePermission } from "../session";

/**
 * Sovereign gap diagnostic (commercial model, steps 1 to 3). The score and the value-at-stake range are
 * computed here, deterministically, from the shared method; the client never supplies them. Every saved
 * assessment and every exported report is on the audit chain.
 */
const answerSchema = z.object({ questionId: z.string().max(40), score: z.number().int().min(0).max(4), evidence: z.enum(EVIDENCE_LEVELS) });
const createBody = z.object({
  title: z.string().trim().min(3).max(120),
  subjectLabel: z.string().trim().min(2).max(120),
  priority: z.string().trim().max(500).optional(),
  aumUsd: z.number().positive().max(1e14).nullable().optional(),
  answers: z.array(answerSchema).min(1).max(40),
});

const inputHash = (aumUsd: number | null, answers: DiagnosticAnswer[]) =>
  createHash("sha256").update(canonicalJson({ method: DIAGNOSTIC_METHOD_VERSION, aumUsd, answers: [...answers].sort((a, b) => a.questionId.localeCompare(b.questionId)) })).digest("hex");

const COLUMNS = "id, title, subject_label, priority, aum_usd, data_mode, method_version, answers, result, input_hash, created_by_label, created_by_role, created_at";
const shape = (r: Record<string, unknown>) => ({ ...r, aum_usd: r.aum_usd === null ? null : Number(r.aum_usd) });

/** Saves one assessment and writes its audit event, in the caller's transaction. Used by the route and the demo seed. */
export async function saveAssessment(tx: Tx, institutionId: string, actor: { id: string; label: string; role: string }, input: { title: string; subjectLabel: string; priority?: string | null; aumUsd: number | null; answers: DiagnosticAnswer[]; dataMode: "self_assessment" | "synthetic" }) {
  const result = assess(input.answers, { aumUsd: input.aumUsd });
  const hash = inputHash(input.aumUsd, input.answers);
  const row = (await tx.query(
    `INSERT INTO diagnostic_assessments (institution_id, title, subject_label, aum_usd, data_mode, method_version, answers, result, input_hash, created_by, created_by_label, created_by_role, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING ${COLUMNS}`,
    [institutionId, input.title, input.subjectLabel, input.aumUsd, input.dataMode, DIAGNOSTIC_METHOD_VERSION, JSON.stringify(input.answers), JSON.stringify(result), hash, actor.id, actor.label, actor.role, input.priority ?? null],
  )).rows[0];
  await appendAudit(tx, institutionId, {
    actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role,
    action: "diagnostic.assessed", resourceType: "diagnostic_assessment", resourceId: row.id,
    details: { title: input.title, subject: input.subjectLabel, dataMode: input.dataMode, answered: result.answered, readinessPct: result.readinessPct, bpLow: result.valueAtStake.bpLow, bpHigh: result.valueAtStake.bpHigh, inputHash: hash },
  });
  return shape(row);
}

export async function diagnosticRoutes(app: FastifyInstance) {
  /** The method: gaps, questions, scale and the planning assumptions behind the value range. */
  app.get("/diagnostic/model", { preHandler: requirePermission("case.read") }, async () => ({
    method: DIAGNOSTIC_METHOD_VERSION, gaps: GAPS, evidenceLevels: EVIDENCE_LEVELS, assumptions: VALUE_ASSUMPTIONS,
  }));

  app.get("/diagnostic/assessments", { preHandler: requirePermission("case.read") }, async (req) => {
    const p = req.principal!;
    return withTenant(p.institutionId, async (tx) => ({
      assessments: (await tx.query(`SELECT ${COLUMNS} FROM diagnostic_assessments ORDER BY created_at DESC LIMIT 50`)).rows.map(shape),
    }));
  });

  app.get("/diagnostic/assessments/:id", { preHandler: requirePermission("case.read") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const row = await withTenant(p.institutionId, async (tx) => (await tx.query(`SELECT ${COLUMNS} FROM diagnostic_assessments WHERE id = $1`, [id])).rows[0]);
    return row ? shape(row) : reply.code(404).send({ error: "not_found", message: "No such assessment in this institution." });
  });

  app.post("/diagnostic/assessments", { preHandler: requirePermission("diagnostic.run") }, async (req, reply) => {
    const p = req.principal!;
    const body = createBody.parse(req.body);
    const errors = validateAnswers(body.answers);
    if (errors.length) return reply.code(400).send({ error: "invalid_answers", message: errors[0], issues: errors });
    return withTenant(p.institutionId, (tx) => saveAssessment(tx, p.institutionId, { id: p.principalId, label: p.displayName, role: p.role },
      { title: body.title, subjectLabel: body.subjectLabel, aumUsd: body.aumUsd ?? null, answers: body.answers, dataMode: "self_assessment", priority: body.priority || null }));
  });

  /** The report as Markdown, for the briefing pack. Exporting is audited. */
  app.get("/diagnostic/assessments/:id/report", { preHandler: requirePermission("export.create") }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const p = req.principal!;
    const out = await withTenant(p.institutionId, async (tx) => {
      const r = (await tx.query(`SELECT ${COLUMNS} FROM diagnostic_assessments WHERE id = $1`, [id])).rows[0];
      if (!r) return null;
      // Recomputed from the stored answers, so the report always follows the method that produced it.
      const result = assess(r.answers, { aumUsd: r.aum_usd === null ? null : Number(r.aum_usd) });
      const md = (r.priority ? `Stated priority: ${r.priority}\n\n` : "") + reportMarkdown(result, { title: r.title, subject: r.subject_label, date: new Date(r.created_at).toISOString().slice(0, 10), dataMode: r.data_mode === "synthetic" ? "Synthetic sample answers" : "Self-assessment" });
      await appendAudit(tx, p.institutionId, { actorType: "human", actorId: p.principalId, actorLabel: p.displayName, actorRole: p.role, action: "diagnostic.report_exported", resourceType: "diagnostic_assessment", resourceId: id, details: { inputHash: r.input_hash } });
      return { md, title: r.title as string };
    });
    if (!out) return reply.code(404).send({ error: "not_found", message: "No such assessment in this institution." });
    const file = out.title.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60) || "gap-diagnostic";
    return reply.header("content-type", "text/markdown; charset=utf-8").header("content-disposition", `attachment; filename="${file}.md"`).send(out.md);
  });
}
