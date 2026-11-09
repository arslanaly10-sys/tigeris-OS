import { createHash } from "node:crypto";
import type { Tx } from "../db";
import { canonicalJson } from "@tigeris/shared";
import { appendAudit } from "../audit";
import { evaluate, compile, approvalFor } from "../policy/engine";
import { activePolicy, brief, decide } from "../policy/store";
import { buildPayload, engine, type EngineResult } from "../routes/scenarios";
import { notifyRole } from "./notify";

/**
 * Named decisions (FR-33..FR-36, Q096..Q101). A decision is taken by a person on one ranked option.
 * The active policy decides who may record it and how many approvals it needs; a snapshot freezes the
 * inputs (option effect, confidence, baseline scenario, facts, brief, policy context) so the decision
 * can be replayed and checked for drift. Approval creates operations handoff tasks; nothing executes.
 */
export interface Actor { id: string; label: string; role: string }
const sha = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");

async function recommendationFor(tx: Tx, caseId: string, recId: string) {
  return (await tx.query(
    `SELECT r.*, ar.requested_by AS drafted_by,
            coalesce((SELECT to_band FROM confidence_adjustments a WHERE a.target_type = 'recommendation' AND a.target_id = r.id ORDER BY created_at DESC LIMIT 1), r.confidence->>'band') AS effective_band
       FROM recommendations r JOIN agent_runs ar ON ar.id = r.run_id WHERE r.id = $1 AND r.case_id = $2`, [recId, caseId])).rows[0];
}

export function recordContext(actor: Actor, outcome: string, rationale: string, c: { state: string; created_by: string }, rec: { option_key: string; authority: string; governance: { result: string }; effective_band: string; drafted_by: string }) {
  return {
    actor: { id: actor.id, role: actor.role }, outcome, rationale: { length: rationale.trim().length },
    case: { state: c.state, created_by: c.created_by },
    recommendation: { option_key: rec.option_key, authority: rec.authority, governance: rec.governance.result, confidence_band: rec.effective_band, drafted_by: rec.drafted_by },
  };
}

/** Everything the decision rested on, frozen at the moment it was recorded. */
async function snapshot(tx: Tx, caseId: string, rec: Record<string, unknown> & { run_id: string; effect: unknown; confidence: unknown; governance: unknown; driver_changes: unknown; effective_band: string }, ctx: unknown) {
  const base = (await tx.query("SELECT r.id, r.name, r.input_hash, r.payload, r.graph_snapshot_id, (SELECT value FROM scenario_results WHERE run_id = r.id AND key = 'portfolio_value_at_risk_usd' AND horizon = '90d') AS var90 FROM scenario_runs r WHERE r.case_id = $1 AND r.variant = 'baseline' ORDER BY r.created_at DESC LIMIT 1", [caseId])).rows[0];
  const factIds: string[] = [];
  const f = (base?.payload?.facts ?? {}) as Record<string, { fact_id?: string } | Record<string, { fact_id?: string }>>;
  for (const v of Object.values(f)) {
    if (v && typeof v === "object" && "fact_id" in v && v.fact_id) factIds.push(v.fact_id as string);
    else if (v && typeof v === "object") for (const w of Object.values(v as Record<string, { fact_id?: string }>)) if (w?.fact_id) factIds.push(w.fact_id);
  }
  const facts = factIds.length ? (await tx.query("SELECT id, subject, predicate, predicate_label, subject_label, value_num, unit, period FROM evidence_facts WHERE id = ANY($1)", [factIds])).rows : [];
  const b = (await tx.query("SELECT id, version, content_hash FROM case_briefs WHERE run_id = $1 ORDER BY version DESC LIMIT 1", [rec.run_id])).rows[0];
  const graph = base?.graph_snapshot_id ? (await tx.query("SELECT id, content_hash, entity_count, relationship_count FROM graph_snapshots WHERE id = $1", [base.graph_snapshot_id])).rows[0] : null;
  const signals = (await tx.query("SELECT s.id, s.title FROM case_signals cs JOIN signals s ON s.id = cs.signal_id WHERE cs.case_id = $1", [caseId])).rows;
  return {
    takenAt: new Date().toISOString(),
    recommendation: { id: rec.id, option_key: rec.option_key, title: rec.title, effect: rec.effect, confidence: rec.confidence, effective_band: rec.effective_band, governance: rec.governance, driver_changes: rec.driver_changes, base_score: rec.base_score },
    baseline: base ? { runId: base.id, name: base.name, inputHash: base.input_hash, drivers: base.payload?.drivers ?? {}, var90: Number(base.var90) } : null,
    facts, brief: b ?? null, graph, signals, policyContext: ctx,
  };
}

async function createHandoffs(tx: Tx, inst: string, d: { id: string; case_id: string; option_title: string }, rec: { description: string; constraints: string[] }) {
  const due = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const tasks = [
    { title: `Prepare the execution plan: ${d.option_title}`, description: rec.description, days: 7 },
    ...rec.constraints.slice(0, 2).map((c) => ({ title: `Confirm constraint: ${c}`, description: `Check and record how this constraint will be handled before execution: ${c}.`, days: 3 })),
  ];
  for (const t of tasks) await tx.query("INSERT INTO handoffs (institution_id, case_id, decision_id, title, description, owner_role, due_at) VALUES ($1,$2,$3,$4,$5,'operations_owner',$6)", [inst, d.case_id, d.id, t.title, t.description, due(t.days)]);
  return tasks.length;
}

export async function recordDecision(tx: Tx, inst: string, actor: Actor, caseKey: string, b: { recommendationId: string; outcome: "approve" | "reject" | "defer"; rationale: string }) {
  const c = (await tx.query("SELECT id, case_key, title, state, created_by FROM cases WHERE case_key = $1 FOR UPDATE", [caseKey])).rows[0];
  if (!c) return { status: 404 as const, message: "No such case." };
  const rec = await recommendationFor(tx, c.id, b.recommendationId);
  if (!rec) return { status: 404 as const, message: "No such option on this case." };
  const ctx = recordContext(actor, b.outcome, b.rationale, c, rec);
  const pol = await decide(tx, "decision.record", ctx);
  if (pol.result !== "PASS") {
    await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "decision.refused", resourceType: "recommendation", resourceId: rec.id, caseId: c.id, details: { outcome: b.outcome, policy: brief(pol) } });
    return { status: (pol.result === "BLOCK" ? 403 : 409) as 403 | 409, policy: pol, message: pol.explanation };
  }
  const active = await activePolicy(tx);
  const appr = b.outcome === "approve" ? approvalFor(active.policy, ctx) : { id: "none", required: 1, roles: [actor.role], description: "No approvals needed to reject or defer" };
  const snap = await snapshot(tx, c.id, rec, ctx);
  const status = b.outcome === "approve" ? (appr.required <= 1 ? "approved" : "pending") : b.outcome === "reject" ? "rejected" : "deferred";
  const d = (await tx.query(
    `INSERT INTO decisions (institution_id, case_id, recommendation_id, option_key, option_title, outcome, status, rationale, required_approvals, approval_roles, approval_rule, policy_version_id, policy_hash, policy_trace, snapshot, snapshot_hash, proposed_by, proposed_by_label, proposed_by_role, finalised_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id, case_id, option_title`,
    [inst, c.id, rec.id, rec.option_key, rec.title, b.outcome, status, b.rationale, appr.required, appr.roles, appr.id, pol.policyVersionId, pol.policyHash, JSON.stringify(pol.trace), JSON.stringify(snap), sha(snap), actor.id, actor.label, actor.role, status === "pending" ? null : new Date().toISOString()],
  )).rows[0];
  if (b.outcome === "approve") await tx.query("INSERT INTO decision_approvals (institution_id, decision_id, approver_id, approver_label, approver_role, vote, rationale, policy_trace) VALUES ($1,$2,$3,$4,$5,'approve',$6,$7)", [inst, d.id, actor.id, actor.label, actor.role, b.rationale, JSON.stringify(pol.trace)]);
  const handoffs = status === "approved" ? await createHandoffs(tx, inst, d, rec) : 0;
  await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, rationale, payload) VALUES ($1,$2,'decision_recorded',$3,$4,$5,$6,$7)", [inst, c.id, actor.id, actor.label, actor.role, b.rationale, JSON.stringify({ decisionId: d.id, option: rec.title, outcome: b.outcome, status, required: appr.required, label: `Decision: ${b.outcome} "${rec.title}"` })]);
  await tx.query("UPDATE cases SET last_activity_at = now() WHERE id = $1", [c.id]);
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "decision.recorded", resourceType: "decision", resourceId: d.id, caseId: c.id,
    details: { option: rec.option_key, outcome: b.outcome, status, requiredApprovals: appr.required, approvalRule: appr.id, policy: brief(pol), snapshotHash: sha(snap), handoffs } });
  if (status === "pending") await notifyRole(tx, inst, appr.roles as never, { kind: "approval_needed", title: `${c.case_key}: a second approval is needed`, body: `${actor.label} approved "${rec.title}". ${appr.description}.`, link: `/cases/${c.case_key}?tab=Decision and memory` }, actor.id);
  if (handoffs) await notifyRole(tx, inst, ["operations_owner"], { kind: "handoff", title: `${c.case_key}: ${handoffs} handoff task(s)`, body: `Decision approved: ${rec.title}.`, link: `/cases/${c.case_key}?tab=Decision and memory` }, actor.id);
  return { status: 200 as const, decisionId: d.id, decisionStatus: status, required: appr.required, policy: pol, handoffs };
}

export async function approveDecision(tx: Tx, inst: string, actor: Actor, decisionId: string, b: { vote: "approve" | "reject"; rationale: string }) {
  const d = (await tx.query("SELECT d.*, c.case_key FROM decisions d JOIN cases c ON c.id = d.case_id WHERE d.id = $1 FOR UPDATE OF d", [decisionId])).rows[0];
  if (!d) return { status: 404 as const, message: "No such decision." };
  const ctx = { actor: { id: actor.id, role: actor.role }, decision: { proposed_by: d.proposed_by, status: d.status }, vote: b.vote, rationale: { length: b.rationale.trim().length } };
  const pol = await decide(tx, "decision.approve", ctx);
  const already = (await tx.query("SELECT 1 FROM decision_approvals WHERE decision_id = $1 AND approver_id = $2", [decisionId, actor.id])).rows[0];
  if (pol.result !== "PASS" || already) {
    await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "decision.approval_refused", resourceType: "decision", resourceId: decisionId, caseId: d.case_id, details: { policy: brief(pol), duplicate: !!already } });
    return { status: (already || pol.result === "BLOCK" ? 403 : 409) as 403 | 409, policy: pol, message: already ? "You have already voted on this decision." : pol.explanation };
  }
  await tx.query("INSERT INTO decision_approvals (institution_id, decision_id, approver_id, approver_label, approver_role, vote, rationale, policy_trace) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [inst, decisionId, actor.id, actor.label, actor.role, b.vote, b.rationale, JSON.stringify(pol.trace)]);
  const n = (await tx.query("SELECT count(*)::int AS n FROM decision_approvals WHERE decision_id = $1 AND vote = 'approve' AND approver_role = ANY($2)", [decisionId, d.approval_roles])).rows[0].n;
  let status = d.status as string;
  let handoffs = 0;
  if (b.vote === "reject") status = "rejected";
  else if (n >= d.required_approvals) status = "approved";
  if (status !== d.status) {
    await tx.query("UPDATE decisions SET status = $2, finalised_at = now() WHERE id = $1", [decisionId, status]);
    if (status === "approved") {
      const rec = (await tx.query("SELECT description, constraints FROM recommendations WHERE id = $1", [d.recommendation_id])).rows[0];
      handoffs = await createHandoffs(tx, inst, d, rec);
      await notifyRole(tx, inst, ["operations_owner"], { kind: "handoff", title: `${d.case_key}: ${handoffs} handoff task(s)`, body: `Decision approved: ${d.option_title}.`, link: `/cases/${d.case_key}?tab=Decision and memory` }, actor.id);
    }
  }
  await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, rationale, payload) VALUES ($1,$2,'decision_approval',$3,$4,$5,$6,$7)", [inst, d.case_id, actor.id, actor.label, actor.role, b.rationale, JSON.stringify({ decisionId, vote: b.vote, approvals: n, required: d.required_approvals, status, label: `${b.vote === "approve" ? "Approved" : "Rejected"} decision (${n}/${d.required_approvals})` })]);
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "decision.approval", resourceType: "decision", resourceId: decisionId, caseId: d.case_id, details: { vote: b.vote, approvals: n, required: d.required_approvals, status, policy: brief(pol), handoffs } });
  return { status: 200 as const, decisionStatus: status, approvals: n, required: d.required_approvals, handoffs };
}

export async function updateHandoff(tx: Tx, inst: string, actor: Actor, handoffId: string, b: { status: "open" | "in_progress" | "done" | "blocked"; note: string }) {
  const h = (await tx.query("SELECT h.*, c.case_key FROM handoffs h JOIN cases c ON c.id = h.case_id WHERE h.id = $1 FOR UPDATE OF h", [handoffId])).rows[0];
  if (!h) return { status: 404 as const, message: "No such handoff task." };
  const pol = await decide(tx, "handoff.update", { actor: { id: actor.id, role: actor.role }, handoff: { status: h.status, owner_role: h.owner_role }, to_status: b.status, note: { length: b.note.trim().length } });
  if (pol.result !== "PASS") return { status: (pol.result === "BLOCK" ? 403 : 409) as 403 | 409, policy: pol, message: pol.explanation };
  await tx.query("UPDATE handoffs SET status = $2, updated_at = now() WHERE id = $1", [handoffId, b.status]);
  await tx.query("INSERT INTO handoff_updates (institution_id, handoff_id, status, note, actor_label, actor_role) VALUES ($1,$2,$3,$4,$5,$6)", [inst, handoffId, b.status, b.note, actor.label, actor.role]);
  await tx.query("INSERT INTO case_events (institution_id, case_id, kind, actor_id, actor_label, actor_role, rationale, payload) VALUES ($1,$2,'handoff_update',$3,$4,$5,$6,$7)", [inst, h.case_id, actor.id, actor.label, actor.role, b.note, JSON.stringify({ handoffId, from: h.status, to: b.status, label: `Handoff "${h.title}": ${b.status.replace("_", " ")}` })]);
  await appendAudit(tx, inst, { actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: "handoff.updated", resourceType: "handoff", resourceId: handoffId, caseId: h.case_id, details: { from: h.status, to: b.status, policy: brief(pol) } });
  const open = (await tx.query("SELECT count(*)::int AS n FROM handoffs WHERE case_id = $1 AND status <> 'done'", [h.case_id])).rows[0].n;
  return { status: 200 as const, open };
}

/**
 * Drift (Q097): has anything the decision rested on changed since? Recomputes the baseline with today's
 * facts and graph, and compares facts, signals, confidence and the active policy.
 */
export async function decisionDrift(tx: Tx, decisionId: string) {
  const d = (await tx.query("SELECT d.*, c.scenario_template, c.id AS cid FROM decisions d JOIN cases c ON c.id = d.case_id WHERE d.id = $1", [decisionId])).rows[0];
  if (!d) return null;
  const snap = d.snapshot;
  const items: Array<{ check: string; level: "none" | "minor" | "material"; detail: string }> = [];
  if (snap.baseline) {
    const { payload } = await buildPayload(tx, { id: d.cid, scenario_template: d.scenario_template });
    const now = await engine<EngineResult>("/scenarios/run", { ...payload, drivers: snap.baseline.drivers });
    const v = Math.abs(now.results.find((r) => r.key === "portfolio_value_at_risk_usd" && r.horizon === "90d")!.value);
    const was = Math.abs(snap.baseline.var90);
    const rel = was ? Math.abs(v - was) / was : 0;
    items.push({ check: "Baseline recomputed with today's facts and graph", level: rel > 0.1 ? "material" : rel > 0.02 ? "minor" : "none",
      detail: `90-day value at risk was ${(was / 1e6).toFixed(1)} million, now ${(v / 1e6).toFixed(1)} million (${(rel * 100).toFixed(1)}% change). Input hash ${now.input_hash === snap.baseline.inputHash ? "unchanged" : "changed"}.` });
  }
  const changed = [];
  for (const f of snap.facts as Array<{ id: string; subject: string; predicate: string; predicate_label: string; subject_label: string; value_num: number }>) {
    const latest = (await tx.query("SELECT value_num, period FROM evidence_facts WHERE subject = $1 AND predicate = $2 AND id <> $3 AND created_at > $4 ORDER BY created_at DESC LIMIT 1", [f.subject, f.predicate, f.id, snap.takenAt])).rows[0];
    if (latest && Number(latest.value_num) !== Number(f.value_num)) changed.push(`${f.predicate_label} (${f.subject_label}): ${f.value_num} → ${latest.value_num}`);
  }
  items.push({ check: "Facts the decision used", level: changed.length ? "material" : "none", detail: changed.length ? changed.join("; ") : `${snap.facts.length} fact(s) unchanged since the decision.` });
  const newSignals = (await tx.query(
    `SELECT DISTINCT s.title, s.data_mode FROM signals s JOIN signal_entities se ON se.signal_id = s.id WHERE se.entity_id IN (SELECT entity_id FROM case_entities WHERE case_id = $1) AND s.detected_at > $2 AND s.status <> 'dismissed'`, [d.cid, snap.takenAt])).rows;
  items.push({ check: "New signals on the case's entities", level: newSignals.length ? "minor" : "none", detail: newSignals.length ? newSignals.map((s) => `${s.title} (${s.data_mode})`).join("; ") : "None since the decision." });
  const adj = (await tx.query("SELECT from_band, to_band, actor_label, reason FROM confidence_adjustments WHERE target_type = 'recommendation' AND target_id = $1 AND created_at > $2 ORDER BY created_at", [d.recommendation_id, snap.takenAt])).rows;
  items.push({ check: "Confidence in the chosen option", level: adj.length ? "minor" : "none", detail: adj.length ? adj.map((a) => `${a.from_band} → ${a.to_band} by ${a.actor_label}: ${a.reason}`).join("; ") : `Still ${snap.recommendation.effective_band}.` });
  const active = await activePolicy(tx);
  if (active.id !== d.policy_version_id) {
    const now = evaluate(active.policy, "decision.record", snap.policyContext, { hash: active.hash, version: active.version });
    items.push({ check: "Policy", level: now.result === "PASS" ? "minor" : "material", detail: `Policy v${active.version} is now active. Under it this decision would be ${now.result}${now.result === "PASS" ? "" : `: ${now.explanation}`}.` });
  } else items.push({ check: "Policy", level: "none", detail: "The policy version used is still active." });
  const overall = items.some((i) => i.level === "material") ? "material" : items.some((i) => i.level === "minor") ? "minor" : "none";
  return { decisionId, overall, checkedAt: new Date().toISOString(), items };
}

/**
 * Replay (FR-43, Q098): rebuilds the decision from its frozen record and checks each part again:
 * the policy result under the policy version used, the baseline scenario from its stored input, the
 * snapshot hash, the brief hash and the audit chain.
 */
export async function replayDecision(tx: Tx, decisionId: string, verifyChain: () => Promise<{ ok: boolean; checked: number }>) {
  const d = (await tx.query("SELECT d.*, p.source, p.version AS pversion, p.content_hash AS phash FROM decisions d JOIN policy_versions p ON p.id = d.policy_version_id WHERE d.id = $1", [decisionId])).rows[0];
  if (!d) return null;
  const checks: Array<{ check: string; ok: boolean; detail: string }> = [];
  const pol = compile(d.source);
  const again = evaluate(pol.policy!, "decision.record", d.snapshot.policyContext, { hash: pol.hash, version: d.pversion });
  const stored = d.policy_trace as Array<{ rule: string; passed: boolean }>;
  const same = again.result === "PASS" && stored.length === again.trace.length && again.trace.every((t, i) => t.rule === stored[i]!.rule && t.passed === stored[i]!.passed);
  checks.push({ check: `Policy v${d.pversion} re-evaluated on the stored context`, ok: same && pol.hash === d.policy_hash, detail: `${again.trace.filter((t) => t.applied).length} rules applied; result ${again.result}; policy hash ${pol.hash === d.policy_hash ? "matches" : "differs"}.` });
  checks.push({ check: "Decision snapshot integrity", ok: sha(d.snapshot) === d.snapshot_hash, detail: `Snapshot hash ${d.snapshot_hash.slice(0, 16)}… ${sha(d.snapshot) === d.snapshot_hash ? "matches" : "does not match"} its contents.` });
  if (d.snapshot.baseline) {
    const run = (await tx.query("SELECT payload, input_hash FROM scenario_runs WHERE id = $1", [d.snapshot.baseline.runId])).rows[0];
    const r = await engine<EngineResult>("/scenarios/run", run.payload);
    const v = r.results.find((x) => x.key === "portfolio_value_at_risk_usd" && x.horizon === "90d")!.value;
    const ok = r.input_hash === d.snapshot.baseline.inputHash && Math.abs(v - d.snapshot.baseline.var90) < 1e-6;
    checks.push({ check: "Baseline scenario recomputed from its stored input", ok, detail: `Input hash ${r.input_hash.slice(0, 12)}; 90-day value at risk ${ok ? "identical" : "differs"}.` });
  }
  if (d.snapshot.brief) {
    const b = (await tx.query("SELECT content_hash FROM case_briefs WHERE id = $1", [d.snapshot.brief.id])).rows[0];
    checks.push({ check: `Brief v${d.snapshot.brief.version} unchanged`, ok: b?.content_hash === d.snapshot.brief.content_hash, detail: `Content hash ${String(d.snapshot.brief.content_hash).slice(0, 16)}…` });
  }
  const audit = (await tx.query("SELECT seq FROM audit_events WHERE resource_id = $1 AND action = 'decision.recorded'", [decisionId])).rows[0];
  const chain = await verifyChain();
  checks.push({ check: "Audit chain", ok: chain.ok && !!audit, detail: `Decision recorded at audit event ${audit?.seq ?? "?"}; ${chain.checked} events verified.` });
  return { decisionId, identical: checks.every((c) => c.ok), checks, replayedAt: new Date().toISOString() };
}
