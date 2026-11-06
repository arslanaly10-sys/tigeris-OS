import type { CaseState, PolicyResult, Role } from "@tigeris/shared";
import type { Tx } from "../db";
import { appendAudit } from "../audit";
import { notifyPeople, notifyRole } from "./notify";

/**
 * Case lifecycle (App Flow §4, Q105). Transitions are enforced on the server and return a policy-style
 * result: PASS lets the move happen; HOLD names the missing condition; BLOCK explains why the role may not.
 * The full policy-as-code engine replaces these rules in week 7 without changing the contract.
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

export interface PolicyOutcome { result: PolicyResult; rule: string; explanation: string }

export async function evaluateTransition(tx: Tx, c: { id: string; state: CaseState; created_by: string }, to: CaseState, actor: { id: string; role: Role }, rationale: string | undefined): Promise<PolicyOutcome & { transition?: Transition }> {
  const t = TRANSITIONS[c.state].find((x) => x.to === to);
  if (!t) return { result: "BLOCK", rule: "case.lifecycle", explanation: `A case cannot move from ${c.state} to ${to}.` };
  if (!t.roles.includes(actor.role)) return { result: "BLOCK", rule: "case.authority", explanation: `"${t.label}" needs the ${t.roles.map((r) => r.replace("_", " ")).join(" or ")} role.` };
  if (to === "handoff" && actor.id === c.created_by) return { result: "BLOCK", rule: "case.separation_of_duties", explanation: "The person who opened this case cannot approve it. Another approver must decide." };
  if (t.needsRationale && !(rationale && rationale.trim().length >= 10)) return { result: "HOLD", rule: "case.rationale_required", explanation: "Add a rationale of at least 10 characters. It is kept in the case history and audit trail." };
  if (to === "review") {
    const n = (await tx.query("SELECT (SELECT count(*) FROM case_evidence WHERE case_id = $1)::int + (SELECT count(*) FROM case_signals WHERE case_id = $1)::int AS n", [c.id])).rows[0].n;
    if (n === 0) return { result: "HOLD", rule: "case.evidence_required", explanation: "Attach at least one signal or evidence record before sending the case for review." };
  }
  return { result: "PASS", rule: "case.lifecycle", explanation: t.label, transition: t };
}

export async function applyTransition(tx: Tx, institutionId: string, caseId: string, to: CaseState, actor: { id: string; label: string; role: Role }, rationale?: string) {
  const c = (await tx.query("SELECT id, case_key, title, state, created_by, owner_id FROM cases WHERE id = $1 FOR UPDATE", [caseId])).rows[0];
  if (!c) return { status: 404 as const };
  const policy = await evaluateTransition(tx, c, to, actor, rationale);
  await appendAudit(tx, institutionId, {
    actorType: "human", actorId: actor.id, actorLabel: actor.label, actorRole: actor.role, action: policy.result === "PASS" ? "case.transitioned" : "case.transition_refused",
    resourceType: "case", resourceId: caseId, caseId, details: { from: c.state, to, policy: { result: policy.result, rule: policy.rule } },
  });
  if (policy.result !== "PASS") return { status: 200 as const, policy };
  const t = policy.transition!;
  await tx.query("UPDATE cases SET state = $2, closure = $3, version = version + 1, last_activity_at = now() WHERE id = $1", [caseId, to, t.closure ?? null]);
  await tx.query(
    "INSERT INTO case_events (institution_id, case_id, kind, from_state, to_state, actor_id, actor_label, actor_role, rationale, payload) VALUES ($1,$2,'transition',$3,$4,$5,$6,$7,$8,$9)",
    [institutionId, caseId, c.state, to, actor.id, actor.label, actor.role, rationale ?? null, JSON.stringify({ policy: { result: "PASS", rule: policy.rule }, label: t.label })],
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
