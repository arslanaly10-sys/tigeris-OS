# ADR 0006 — Policy as code, frozen decisions, local memory search

Status: accepted (week 7)

## Context
Week 7 turns recommendations into governed decisions (Q090–Q107). Buyers need to see who may do what,
under which rules, and that a past decision can be reproduced exactly and checked against what changed since.

## Decision
1. **Policy is a versioned YAML document per institution** with four parts: rules (BLOCK/HOLD on six
   actions), approval requirements, export audiences with redaction, and tests. It is compiled and
   validated with a strict schema; evaluation is deterministic and returns a trace of every rule.
   A version is saved as a draft and can only be activated when every embedded test passes; the previous
   version is retired, never deleted. Activation records which rules were added, removed or changed.
2. **The lifecycle graph stays in code; authority and conditions move to policy.** Case moves, decisions,
   approvals, handoff updates, exports and memory approval all go through `decide()` on the server.
3. **A decision freezes its inputs**: option effect and confidence, baseline scenario (run id, input hash,
   value), facts with values, brief hash, graph snapshot and the exact policy context, with a snapshot hash.
   *Replay* re-evaluates the stored policy version on that context, recomputes the baseline from its stored
   input, and checks the snapshot, brief and audit chain. *Drift* recomputes the baseline with today's facts
   and graph and compares facts, new signals, confidence adjustments and the active policy.
4. **Approval creates handoff tasks only.** Closing the case needs every task done.
5. **Memory search is hybrid and local**: PostgreSQL full text plus bge-small embeddings (384 dimensions,
   MIT licence) in pgvector, fused by reciprocal rank. The embedding model runs in the reasoning service.
   Precedents are labelled illustrative (public events, qualitative) or synthetic (fictional internal);
   the institution's own entries need approval by a different person.
6. **Audit details are normalised through JSON before hashing**, so the hash always covers exactly what
   jsonb stores. (A week 6 event with an `undefined` field broke verification; caught by the posture check.)

## Consequences
- Rules are readable and testable by a non-developer administrator, and every refusal names its rule.
- Replays are exact only while the stored scenario input and engine version are kept; both are write-once.
- Redaction works on stored brief text by pattern; it is shown with a count, but it is not a guarantee
  against every indirect disclosure. The pilot adds review of each partner export.
