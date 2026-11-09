/**
 * Default policy for both demo institutions (Q090..Q095). Administrators edit it in Governance & Audit;
 * a new version is activated only when every test below passes.
 */
export const DEFAULT_POLICY = `title: Decision governance rules (demonstration)
# Fields available to rules, by action:
#   case.transition  actor.{id,role} from to transition.{label,needs_rationale} rationale.length
#                    case.{created_by,owner_id,depth,sensitivity,inputs_count} analysis.completed
#                    decision.status handoff.{open_count,total}
#   decision.record  actor.{id,role} outcome rationale.length case.{state,created_by}
#                    recommendation.{option_key,authority,governance,confidence_band,drafted_by}
#   decision.approve actor.{id,role} decision.{proposed_by,status} rationale.length vote
#   handoff.update   actor.{id,role} handoff.{status,owner_role} to_status note.length
#   export.create    actor.{id,role} audience case.sensitivity
#   memory.approve   actor.{id,role} entry.proposed_by
# A value starting with $ refers to another field, for example $case.created_by.

rules:
  # ---- case lifecycle: who may move a case ----
  - id: case.authority.early
    description: Analysts run the early stages; experts may also triage.
    action: case.transition
    when: { from: { in: [detected, triaged, analysis, scenario] } }
    require: { actor.role: { in: [analyst, domain_expert] } }
    effect: BLOCK
    message: "\\"{transition.label}\\" is done by an analyst."
  - id: case.authority.early_analyst_only
    description: Only analysts move a case beyond triage.
    action: case.transition
    when: { from: { in: [triaged, analysis, scenario] } }
    require: { actor.role: analyst }
    effect: BLOCK
    message: "\\"{transition.label}\\" needs the analyst role."
  - id: case.authority.review
    action: case.transition
    when: { from: review }
    require: { actor.role: { in: [domain_expert, approver] } }
    effect: BLOCK
    message: "Expert review is done by a domain expert or an approver."
  - id: case.authority.decision
    action: case.transition
    when: { from: decision }
    require: { actor.role: { in: [approver, executive] } }
    effect: BLOCK
    message: "Only an approver or an executive acts at the decision stage."
  - id: case.authority.handoff
    action: case.transition
    when: { from: handoff }
    require: { actor.role: operations_owner }
    effect: BLOCK
    message: "The operations owner records the outcome."

  # ---- case lifecycle: conditions ----
  - id: case.rationale_required
    description: Closing, reviewing and deciding moves need a written rationale.
    action: case.transition
    when: { transition.needs_rationale: true }
    require: { rationale.length: { gte: 10 } }
    effect: HOLD
    message: "Add a rationale of at least 10 characters. It is kept in the case history and audit trail."
  - id: case.evidence_before_review
    action: case.transition
    when: { to: review }
    require: { case.inputs_count: { gte: 1 } }
    effect: HOLD
    message: "Attach at least one signal or evidence record before sending the case for review."
  - id: case.analysis_before_review_full
    description: Full cases need the agent analysis and its options before expert review.
    action: case.transition
    when: { to: review, case.depth: full }
    require: { analysis.completed: true }
    effect: HOLD
    message: "Run the agent analysis so the reviewer sees ranked options and their checks."
  - id: case.separation_of_duties
    description: The person who opened a case cannot approve it.
    action: case.transition
    when: { to: handoff }
    require: { actor.id: { not_equals: $case.created_by } }
    effect: BLOCK
    message: "The person who opened this case cannot approve it. Another approver must decide."
  - id: case.decision_before_handoff
    action: case.transition
    when: { to: handoff }
    require: { decision.status: approved }
    effect: HOLD
    message: "Record a decision on one option and collect the required approvals first (decision is {decision.status})."
  - id: case.handoff_complete_before_close
    action: case.transition
    when: { from: handoff, to: closed }
    require: { handoff.open_count: 0 }
    effect: HOLD
    message: "{handoff.open_count} handoff task(s) are not done yet."

  # ---- decisions ----
  - id: decision.authority
    action: decision.record
    require: { actor.role: { in: [approver, executive] } }
    effect: BLOCK
    message: "Only an approver or an executive can record a decision."
  - id: decision.stage
    action: decision.record
    require: { case.state: decision }
    effect: HOLD
    message: "The case must be at the decision stage (it is at {case.state})."
  - id: decision.rationale
    action: decision.record
    require: { rationale.length: { gte: 20 } }
    effect: HOLD
    message: "A decision needs a rationale of at least 20 characters."
  - id: decision.option_on_hold
    description: An option on policy HOLD cannot be approved until an expert has reviewed it.
    action: decision.record
    when: { outcome: approve }
    require: { recommendation.governance: PASS }
    effect: HOLD
    message: "This option is on policy HOLD; an expert must review it before it can be approved."
  - id: decision.low_confidence
    action: decision.record
    when: { outcome: approve }
    require: { recommendation.confidence_band: { in: [medium, high] } }
    effect: HOLD
    message: "Confidence in this option is low. Ask a domain expert to review or adjust it first."
  - id: decision.drafter_cannot_decide
    action: decision.record
    require: { actor.id: { not_equals: $recommendation.drafted_by } }
    effect: BLOCK
    message: "The person who requested the analysis cannot decide on its options."
  - id: approval.authority
    action: decision.approve
    require: { actor.role: { in: [approver, executive] } }
    effect: BLOCK
    message: "Only an approver or an executive can approve a decision."
  - id: approval.distinct_person
    action: decision.approve
    require: { actor.id: { not_equals: $decision.proposed_by } }
    effect: BLOCK
    message: "A second approval must come from a different person."
  - id: approval.pending_only
    action: decision.approve
    require: { decision.status: pending }
    effect: HOLD
    message: "This decision is already {decision.status}."

  # ---- decision envelopes: the committee sets limits once; one named authoriser inside them ----
  - id: envelope.propose_authority
    action: envelope.propose
    require: { actor.role: executive }
    effect: BLOCK
    message: "Only an executive can propose a decision envelope."
  - id: envelope.activate_authority
    action: envelope.activate
    require: { actor.role: { in: [approver, executive] } }
    effect: BLOCK
    message: "Only an approver or an executive can activate a decision envelope."
  - id: envelope.activate_distinct_person
    description: A committee envelope needs two people, the proposer and a different activator.
    action: envelope.activate
    require: { actor.id: { not_equals: $envelope.proposed_by } }
    effect: BLOCK
    message: "The person who proposed the envelope cannot activate it."
  - id: envelope.activate_proposed_only
    action: envelope.activate
    require: { envelope.status: proposed }
    effect: HOLD
    message: "This envelope is already {envelope.status}."
  - id: envelope.revoke_authority
    action: envelope.revoke
    require: { actor.role: { in: [approver, executive] } }
    effect: BLOCK
    message: "Only an approver or an executive can revoke a decision envelope."
  - id: envelope.fit_active
    action: decision.envelope
    require: { envelope.status: active }
    effect: BLOCK
    message: "The envelope is {envelope.status}, not active. The decision goes to the committee."
  - id: envelope.fit_in_date
    action: decision.envelope
    require: { envelope.expired: false }
    effect: BLOCK
    message: "The envelope expired. The decision goes to the committee."
  - id: envelope.fit_domain
    action: decision.envelope
    require: { case.domain: { equals: $envelope.domain } }
    effect: BLOCK
    message: "The envelope covers {envelope.domain}; this case is {case.domain}. The decision goes to the committee."
  - id: envelope.fit_authority
    action: decision.envelope
    require: { recommendation.authority: { equals: $envelope.authority } }
    effect: BLOCK
    message: "The envelope delegates {envelope.authority} items; this option needs {recommendation.authority}."
  - id: envelope.fit_size
    action: decision.envelope
    require: { recommendation.var_90d: { lte: $envelope.max_var_usd } }
    effect: BLOCK
    message: "The option leaves 90-day value at risk above the envelope's limit. The decision goes to the committee."
  - id: envelope.fit_authoriser
    action: decision.envelope
    require: { actor.may_authorise: true }
    effect: BLOCK
    message: "Your role is not named as an authoriser in this envelope."

  # ---- handoff ----
  - id: handoff.owner
    action: handoff.update
    require: { actor.role: { in: [operations_owner, approver] } }
    effect: BLOCK
    message: "Handoff tasks are updated by the operations owner."
  - id: handoff.note
    action: handoff.update
    when: { to_status: { in: [done, blocked] } }
    require: { note.length: { gte: 10 } }
    effect: HOLD
    message: "Say what was done, or what is blocking, in at least 10 characters."

  # ---- exports and memory ----
  - id: export.partner_needs_executive
    action: export.create
    when: { audience: partner }
    require: { actor.role: executive }
    effect: BLOCK
    message: "Only an executive may release an external partner version."
  - id: export.secret_stays_inside
    action: export.create
    when: { case.sensitivity: secret }
    require: { audience: internal }
    effect: BLOCK
    message: "Secret cases are exported only in the internal version."
  - id: memory.approver
    action: memory.approve
    require: { actor.role: { in: [approver, executive] } }
    effect: BLOCK
    message: "An approver or executive approves memory entries."
  - id: memory.distinct
    action: memory.approve
    require: { actor.id: { not_equals: $entry.proposed_by } }
    effect: BLOCK
    message: "The person who proposed a memory entry cannot approve it."

approvals:
  - id: board_items
    description: Options that need the board investment committee require two approvals by different people.
    when: { recommendation.authority: Board investment committee }
    required: 2
    roles: [approver, executive]
  - id: executive_committee
    description: Executive committee options need one approval.
    when: { recommendation.authority: Executive committee }
    required: 1
    roles: [approver, executive]

redaction:
  audiences:
    - key: internal
      label: Internal (full brief)
      roles: [executive, analyst, approver]
      redact: []
    - key: board
      label: Board pack (holding values removed)
      roles: [executive, analyst, approver]
      redact: [holding_values, raw_model_text]
    - key: partner
      label: External partner (holdings, people and internal sources removed)
      roles: [executive]
      redact: [holding_names, holding_values, people, internal_sources, unverified, raw_model_text]

tests:
  - name: creator cannot approve their own case
    action: case.transition
    context: { from: decision, to: handoff, actor: { id: u1, role: approver }, case: { created_by: u1 }, transition: { needs_rationale: true }, rationale: { length: 40 }, decision: { status: approved } }
    expect: BLOCK
    rule: case.separation_of_duties
  - name: handoff needs an approved decision
    action: case.transition
    context: { from: decision, to: handoff, actor: { id: u2, role: approver }, case: { created_by: u1 }, transition: { needs_rationale: true }, rationale: { length: 40 }, decision: { status: pending } }
    expect: HOLD
    rule: case.decision_before_handoff
  - name: approved decision can be handed off by another approver
    action: case.transition
    context: { from: decision, to: handoff, actor: { id: u2, role: approver }, case: { created_by: u1 }, transition: { needs_rationale: true }, rationale: { length: 40 }, decision: { status: approved } }
    expect: PASS
  - name: an analyst cannot decide
    action: decision.record
    context: { actor: { id: u3, role: analyst }, outcome: approve, rationale: { length: 50 }, case: { state: decision }, recommendation: { governance: PASS, confidence_band: medium, drafted_by: u3 } }
    expect: BLOCK
  - name: low-confidence option is held
    action: decision.record
    context: { actor: { id: u2, role: approver }, outcome: approve, rationale: { length: 50 }, case: { state: decision }, recommendation: { governance: PASS, confidence_band: low, drafted_by: u3 } }
    expect: HOLD
    rule: decision.low_confidence
  - name: same person cannot give the second approval
    action: decision.approve
    context: { actor: { id: u2, role: approver }, decision: { proposed_by: u2, status: pending }, vote: approve, rationale: { length: 30 } }
    expect: BLOCK
    rule: approval.distinct_person
  - name: envelope proposer cannot activate it
    action: envelope.activate
    context: { actor: { id: u4, role: executive }, envelope: { proposed_by: u4, status: proposed } }
    expect: BLOCK
    rule: envelope.activate_distinct_person
  - name: an option above the envelope limit goes to committee
    action: decision.envelope
    context: { actor: { id: u2, role: approver, may_authorise: true }, case: { domain: energy }, recommendation: { authority: Board investment committee, var_90d: 900 }, envelope: { status: active, expired: false, domain: energy, authority: Board investment committee, max_var_usd: 500 } }
    expect: BLOCK
    rule: envelope.fit_size
  - name: an option inside an active envelope fits
    action: decision.envelope
    context: { actor: { id: u2, role: approver, may_authorise: true }, case: { domain: energy }, recommendation: { authority: Board investment committee, var_90d: 400 }, envelope: { status: active, expired: false, domain: energy, authority: Board investment committee, max_var_usd: 500 } }
    expect: PASS
  - name: partner export needs an executive
    action: export.create
    context: { actor: { id: u3, role: analyst }, audience: partner, case: { sensitivity: confidential } }
    expect: BLOCK
  - name: secret case cannot leave as a board pack
    action: export.create
    context: { actor: { id: u4, role: executive }, audience: board, case: { sensitivity: secret } }
    expect: BLOCK
    rule: export.secret_stays_inside
`;
