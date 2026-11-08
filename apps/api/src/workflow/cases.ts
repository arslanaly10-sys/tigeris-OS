import type { CaseState, PolicyResult, Role } from "@tigeris/shared";
import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { notifyPeople, notifyRole } from "./notify";
import { brief, decide } from "../policy/store";
import type { RuleTrace } from "../policy/engine";

/**
 * Case lifecycle (App Flow §4, Q105). Transitions are enforced on the server and return a policy-style
 * result: PASS lets the move happen; HOLD names the missing condition; BLOCK explains why the role may not.
 * The lifecycle graph lives here; who may move a case, and under which conditions, is the active
 * policy-as-code version (week 7), evaluated on the server for every move.
 */
export interface Transition { to: CaseState; label: string; roles: Role[]; closure?: "resolved" | "dismissed" | "non_actionable"; needsRationale?: boolean; returnsToAnalysis?: boolean }

export const TRANSITIONS: Record<CaseState, Transition[]> = {
  detected: [
    { to: "triaged", label: "Triage", roles: ["analyst", "domain_expert"] },
    { to: "closed", label: "Dismiss", roles: ["analyst"], closure: "dismissed", needsRationale: true },
  ],
  triaged: [
    { to: "analysis", label: "Start analysis", roles: ["analyst"] },
    { to: "closed", label: "Close as non-actionable", roles: ["analyst"], closure: "non_actionable", needsRationale: true },
  ],
  analysis: [{ to: "scenario", label: "Move to scenarios", roles: ["analyst"] }],
  scenario: [
    { to: "review", label: "Send for expert review", roles: ["analyst"] },
    { to: "analysis", label: "Back to analysis", roles: ["analyst"], returnsToAnalysis: true },
  ],
  review: [
    { to: "decision", label: "Endorse for decision", roles: ["domain_expert", "approver"], needsRationale: true },
    { to: "analysis", label: "Request more evidence", roles: ["domain_expert", "approver"], needsRationale: true, returnsToAnalysis: true },
  ],
  decision: [
    { to: "handoff", label: "Approve and hand off", roles: ["approver", "executive"], needsRationale: true },
    { to: "analysis", label: "Defer and request evidence", roles: ["approver", "executive"], needsRationale: true, returnsToAnalysis: true },
    { to: "closed", label: "Reject", roles: ["approver", "executive"], closure: "dismissed", needsRationale: true },
  ],
  handoff: [{ to: "closed", label: "Record outcome and close", roles: ["operations_owner"], closure: "resolved", needsRationale: true }],
  closed: [],
};

/** Who is expected to act next, used by the Command Centre queue. */
export const NEXT_ACTOR: Record<CaseState, Role[]> = {
  detected: ["analyst"], triaged: ["analyst"], analysis: ["analyst"], scenario: ["analyst"],
  review: ["domain_expert", "approver"], decision: ["approver", "executive"], handoff: ["operations_owner"], closed: [],
};

export interface PolicyOutcome { result: PolicyResult; rule: string; explanation: string; trace?: RuleTrace[]; version?: number | null; hash?: string }

/** Facts the policy may test for a case move. */
export async function transitionContext(tx: Tx, c: { id: string; state: CaseState; created_by: string }, to: CaseState, t: Transition | undefined, actor: { id: string; role: Role }, rationale: string | undefined) {
  const x = (await tx.query(
    `SELECT c.owner_id, c.depth, c.sensitivity,
            (SELECT count(*) FROM case_evidence WHERE case_id = c.id)::int + (SELECT count(*) FROM case_signals WHERE case_id = c.id)::int AS inputs,
            EXISTS (SELECT 1 FROM agent_runs WHERE case_id = c.id AND kind = 'case_analysis' AND status = 'completed') AS analysed,
            (SELECT status FROM decisions WHERE case_id = c.id ORDER BY created_at DESC LIMIT 1) AS decision_status,
            (SELECT count(*) FROM handoffs WHERE case_id = c.id AND status <> 'done')::int AS open_handoffs,
            (SELECT count(*) FROM handoffs WHERE case_id = c.id)::int AS handoffs
       FROM cases c WHERE c.id = $1`, [c.id])).rows[0];
  return {
    from: c.state, to, actor: { id: actor.id, role: actor.role },
    transition: { label: t?.label ?? to, needs_rationale: !!t?.needsRationale },
    rationale: { length: rationale?.trim().length ?? 0 },
    case: { created_by: c.created_by, owner_id: x.owner_id, depth: x.depth, sensitivity: x.sensitivity, inputs_count: x.inputs },
    analysis: { completed: x.analysed }, decision: { status: x.decision_status ?? "none" }, handoff: { open_count: x.open_handoffs, total: x.handoffs },
  };
}

export async function evaluateTransition(tx: Tx, c: { id: string; state: CaseState; created_by: string }, to: CaseState, actor: { id: string; role: Role }, rationale: string | undefined): Promise<PolicyOutcome & { transition?: Transition }> {
  const t = TRANSITIONS[c.state].find((x) => x.to === to);
  if (!t) return { result: "BLOCK", rule: "case.lifecycle", explanation: `A case cannot move from ${c.state} to ${to}.` };
  const e = await decide(tx, "case.transition", await transitionContext(tx, c, to, t, actor, rationale));
  return { result: e.result, rule: e.rule, explanation: e.result === "PASS" ? t.label : e.explanation, trace: e.trace, version: e.version, hash: e.policyHash, transition: e.result === "PASS" ? t : undefined };
}

export async function applyTransition(tx: Tx, institutionId: string, caseId: string, to: CaseState, actor: { id: string; label: string; role: Role }, rationale?: string) {
  const c = (await tx.query("SELECT id, case_key, title, state, created_by, owner_id FROM cases WHERE id = $1 FOR UPDATE", [caseId])).rows[0];
  if (!c) return { status: 404 as const };
  const policy = await evaluateTransition(tx, c, to, actor, rationale);
  await appendAudit(tx, institutionId, {
    actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: policy.result === "PASS" ? "case.transitioned" : "case.transition_refused",
    resourceType: "case", resourceId: caseId, caseId, details: { from: c.state, to, policy: policy.trace ? brief({ result: policy.result, rule: policy.rule, explanation: policy.explanation, trace: policy.trace, policyHash: policy.hash!, version: policy.version ?? null }) : { result: policy.result, rule: policy.rule } },
  });
  if (policy.result !== "PASS") return { status: 200 as const, policy };
  const t = policy.transition!;
  await tx.query("UPDATE cases SET state = $2, closure = $3, version = version + 1, last_activity_at = now() WHERE id = $1", [caseId, to, t.closure ?? null]);
  await tx.query(
    "INSERT INTO case_events (institution_id, case_id, kind, from_state, to_state, actor_id, actor_label, actor_role, rationale, payload) VALUES ($1,$2,'transition',$3,$4,$5,$6,$7,$8,$9)",
    [institutionId, caseId, c.state, to, actor.id, actor.label, actor.role, rationale ?? null, JSON.stringify({ policy: { result: "PASS", rule: policy.rule, version: policy.version, hash: policy.hash?.slice(0, 16) }, label: t.label })],
  );
  const link = `/cases/${c.case_key}`;
  if (NEXT_ACTOR[to].length) await notifyRole(tx, institutionId, NEXT_ACTOR[to], { kind: "case_action", title: `${c.case_key} needs ${to === "review" ? "expert review" : to === "decision" ? "a decision" : to === "handoff" ? "follow-through" : "analysis"}`, body: `${c.title} moved to ${to} by ${actor.label}.`, link }, actor.id);
  if (t.returnsToAnalysis && c.owner_id !== actor.id) await notifyPeople(tx, institutionId, [c.owner_id], { kind: "case_returned", title: `${c.case_key} returned to analysis`, body: rationale ?? "", link });
  return { status: 200 as const, policy, state: to };
}

export async function nextCaseKey(tx: Tx, shortName: string) {
  // Numbered per institution; the advisory lock keeps two new cases from taking the same number.
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`case-number:${shortName}`]);
  const n = (await tx.query("SELECT count(*)::int + 1 AS n FROM cases")).rows[0].n;
  return `${shortName}-2026-${String(n).padStart(4, "0")}`;
}
