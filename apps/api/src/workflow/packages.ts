import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { DEFAULT_SHOCK, authorityFor, buildFacts, cachedBrief, simulate, validateBrief } from "@tigeris/shared";
import { loadEngagement } from "./engagements";
import type { Actor } from "./decisions";

/**
 * Governed decision loop (brief v3 §6): question → Decision Brief (cached in demo mode, numbers only from engine
 * facts, post-validated) → Decision Package with required authority → approve / reject / request changes by the role
 * the authority matrix names → owners and tasks from the 72-hour plan → the measured signal-to-owner latency written
 * back to the diagnosis, so coordination debt moves. Every step is a Ledger (audit) event. Nothing executes.
 */
async function briefFor(tx: Tx, engagementId: string, question: string) {
  const e = await loadEngagement(tx, engagementId);
  if (!e) return null;
  const aum = Number(e.assumptions.find((a: { key: string }) => a.key === "aum_usd")?.value);
  const facts = buildFacts(simulate(DEFAULT_SHOCK), e.diagnosis, e.value, aum);
  const brief = cachedBrief(question, facts);
  return { e, facts, brief, problems: validateBrief(brief, facts) };
}

export async function generateBrief(tx: Tx, inst: string, actor: Actor, engagementId: string, question: string) {
  const r = await briefFor(tx, engagementId, question);
  if (!r) return { status: 404 as const, message: "No such engagement." };
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "brief.generated", resourceType: "engagement", resourceId: engagementId,
    details: { question, model: r.brief.meta.model, promptVersion: r.brief.meta.promptVersion, inputHash: r.brief.meta.inputHash, validation: r.problems.length ? r.problems : "passed" } });
  if (r.problems.length) return { status: 422 as const, message: "Brief unavailable, see the modelled panel.", problems: r.problems };
  return { status: 200 as const, brief: r.brief, facts: r.facts };
}

export async function createPackage(tx: Tx, inst: string, actor: Actor, engagementId: string, question: string) {
  const r = await briefFor(tx, engagementId, question);
  if (!r) return { status: 404 as const, message: "No such engagement." };
  if (r.problems.length) return { status: 422 as const, message: "The brief failed validation; no package can be made from it.", problems: r.problems };
  const rule = authorityFor("reallocation", r.facts["sim.shift_pct"]!.value);
  const p = (await tx.query(
    `INSERT INTO decision_packages (institution_id, engagement_id, question, brief, facts, recommended, authority_required, authority_rule, authority_role, approval_threshold, prompt_version, model, input_hash, created_by_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [inst, engagementId, question, JSON.stringify(r.brief), JSON.stringify(r.facts), r.brief.recommendation, rule.authority, rule.id, rule.role, r.brief.approvalThreshold, r.brief.meta.promptVersion, r.brief.meta.model, r.brief.meta.inputHash, actor.label])).rows[0]!;
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "package.created", resourceType: "decision_package", resourceId: p.id,
    details: { engagementId, authority: rule.authority, rule: rule.id, inputHash: r.brief.meta.inputHash } });
  return { status: 200 as const, packageId: p.id as string };
}

export async function decidePackage(tx: Tx, inst: string, actor: Actor, id: string, decision: "approve" | "reject" | "request_changes", comment: string) {
  const p = (await tx.query("SELECT * FROM decision_packages WHERE id = $1 FOR UPDATE", [id])).rows[0];
  if (!p) return { status: 404 as const, message: "No such decision package." };
  if (p.status !== "proposed") return { status: 409 as const, message: `This package is already ${p.status.replace("_", " ")}.` };
  if (actor.role !== p.authority_role) {
    await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "package.refused", resourceType: "decision_package", resourceId: id, details: { reason: "authority", required: p.authority_required } });
    return { status: 403 as const, message: `This package needs ${p.authority_required}.` };
  }
  if (decision !== "approve" && comment.trim().length < 5) return { status: 400 as const, message: "A comment is required to reject or request changes." };
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "changes_requested";
  await tx.query("UPDATE decision_packages SET status = $2, decided_by_label = $3, decided_at = now(), decision_comment = $4 WHERE id = $1", [id, status, actor.label, comment]);
  let owners = 0, coordination: { from: number | null; to: number | null } | null = null;
  if (status === "approved") {
    const plan = p.brief.plan72h as Array<{ action: string; owner: string; dueHours: number }>;
    for (const t of plan) await tx.query("INSERT INTO package_tasks (institution_id, package_id, action, owner_label, due_at) VALUES ($1,$2,$3,$4, now() + make_interval(hours => $5))", [inst, id, t.action, t.owner, t.dueHours]);
    owners = plan.length;
    // Measured, not assumed: the time from package to named owner becomes the engagement's signal-to-owner latency.
    const before = (await loadEngagement(tx, p.engagement_id))!.diagnosis.indices.coordinationDebt;
    const days = Math.max(0.01, (Date.now() - new Date(p.created_at).getTime()) / 86_400_000);
    await tx.query("UPDATE engagement_inputs SET value = $3, label = 'measured', source = $4, updated_by_label = $5, updated_at = now() WHERE engagement_id = $1 AND metric_id = $2",
      [p.engagement_id, "signal_to_owner_days", Number(days.toFixed(3)), `Measured: owner named ${(days * 24).toFixed(1)} h after the package was raised`, actor.label]);
    const after = (await loadEngagement(tx, p.engagement_id))!.diagnosis.indices.coordinationDebt;
    coordination = { from: before, to: after };
  }
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: `package.${status}`, resourceType: "decision_package", resourceId: id,
    details: { comment, owners, coordination, authority: p.authority_required } });
  return { status: 200 as const, packageStatus: status, owners, coordination };
}

export async function listPackages(tx: Tx, engagementId: string) {
  const ps = (await tx.query("SELECT id, question, recommended, authority_required, approval_threshold, status, created_by_label, created_at, decided_by_label, decided_at, decision_comment, input_hash, model, prompt_version FROM decision_packages WHERE engagement_id = $1 ORDER BY created_at DESC", [engagementId])).rows;
  for (const p of ps) p.tasks = (await tx.query("SELECT action, owner_label, due_at, status FROM package_tasks WHERE package_id = $1 ORDER BY due_at", [p.id])).rows;
  return ps;
}

/** The Ledger for an engagement: its audit events and those of its packages, newest last, with hashes. */
export async function ledger(tx: Tx, engagementId: string) {
  return (await tx.query(
    `SELECT seq, occurred_at, actor_label, actor_role, action, resource_type, resource_id, details, hash, prev_hash FROM audit_events
      WHERE resource_id = $1::text OR resource_id IN (SELECT id::text FROM decision_packages WHERE engagement_id = $1::uuid) ORDER BY seq`, [engagementId])).rows;
}
