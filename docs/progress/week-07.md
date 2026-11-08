# Week 7 — Governance and memory

## Working now
- **Policy as code** (Governance & Audit). Each institution has a versioned YAML policy with four parts:
  - 26 rules across six actions: case moves, recording decisions, approvals, handoff updates, exports and memory approval
  - approval requirements: options for the board investment committee need two approvals by different people
  - export audiences with redaction rules
  - 8 embedded tests
- **The policy editor**, which:
  - compiles the policy and runs its tests as you type
  - shows errors by line or field
  - saves drafts with a note
  - activates a draft only when every test passes, retiring the old version and auditing which rules changed
  - has a sandbox to try any action against an example context and see the trace of every rule
- **Server-side enforcement.** Every case move now goes through the active policy. A full case needs the agent analysis before expert review. Handoff needs an approved decision and someone other than the case's creator. A case closes only when all handoff tasks are done.
- **Named decisions** on the Decision and memory tab. An approver records approve, reject or defer on one ranked option, with a rationale. The policy previews the result for each option, then enforces:
  - who may decide
  - minimum rationale length
  - no approving an option that is on policy HOLD or has low confidence
  - the person who requested the analysis cannot decide on its options
  - a second approval must come from a different person
- **Decision snapshot.** Each decision freezes its option effect, confidence, baseline scenario, the facts used, the brief hash, the graph snapshot and the policy context, with a snapshot hash.
- **Replay** re-evaluates the stored policy version, recomputes the baseline from its stored input, and checks the snapshot, brief and audit chain. The demo decision replays identically.
- **Drift check** recomputes the baseline with today's facts and graph and compares facts, new signals, confidence changes and the active policy. Result: none, minor or material, with reasons.
- **Operations handoff.** Approval creates tasks: the execution plan plus confirming two constraints. The operations owner updates them with notes; completing a task needs a note.
- **Decision register** (Decision Authority module): every decision with status, approvals, handoff progress, policy version and an on-demand drift check.
- **Redacted export.** The brief exports as internal, board pack (portfolio values withheld) or external partner (holdings, people, internal sources and unverified sentences withheld). Only an executive may release the partner version. The PDF and the audit event both state how many items were withheld.
- **Institutional memory:**
  - 50 precedents: 34 illustrative summaries of public events (qualitative, labelled not sourced) and 16 synthetic internal records.
  - Hybrid search by keyword (PostgreSQL full text) and meaning, using a local bge-small embedding model (MIT, 37 MB) on this machine. Each result shows how it matched.
  - "Similar precedents" on every case.
  - Memory entries from a case are drafted from its decision, handoff and agent challenges, then approved by a different person.
- **Security posture** (Governance & Audit): 21 live checks with evidence, covering:
  - row-level security on every institutional table
  - no bypass rights for the app role
  - cross-institution visibility
  - audit chain integrity and append-only grants
  - model switch and outbound access
  - refused calls recorded
  - local model hash
  - key handling and residency
  - policy tests and separation of duties
  - input screening and signed packages
  - second factor
  - three stated demo gaps: no encryption at rest, plain HTTP on the laptop package, simulated sign-on

## Fixed this week
- **Audit chain broken by week 6 agent runs.** A completed run logged a field with no value; the hash included it but the stored JSON dropped it, so verification failed. Audit details are now normalised before hashing, and a regression test checks the chain after an agent run and a decision. The posture check is what caught it.

## Example (seeded Gulf Sovereign Fund, Hormuz case)
1. The approver records "Back a war-risk insurance facility". It needs board approval, so it shows 1 of 2 approvals.
2. The approver tries to hand off early: HOLD, because there is no approved decision yet.
3. The executive gives the second approval: approved, and 3 handoff tasks are created.
4. Replay comes back identical, and the drift check finds no drift.
5. Operations completes the tasks and closes the case.
6. The analyst proposes a memory entry and the approver approves it. It then ranks first when searching "war-risk insurance facility for national tankers".

## Tests
- **API: 73 tests.** 12 new: policy compile and order, version activation refusing failing tests, the full two-person decision and handoff journey, drift and replay, the audit chain after agent runs, redacted export audiences, memory search and approval, memory isolation, and security posture.
- **Updated workflow tests** for the new rules.
- **Other suites:** reasoning 12 (new embedding contract test), shared 12, web 3. Typecheck is clean.
- **Browser walk-through** across five roles with no console errors.

## Not done / blocked
- Code is committed locally only (GitHub access, SCOPE B1). The Docker package is not re-verified; the reasoning image now also mounts the embedding model.
- Redaction is pattern-based on the stored brief; partner exports should still get a human review in the pilot.
- Live foreign model calls still need keys in the deployment environment (SCOPE B3).

## Next (week 8): cases and release
- Back-test that calibrates the price response
- Reports module
- Investor architecture page
- Light guided mode
- Arabic key screens
- Tablet layout
- VM and laptop packages
- Rehearsal
