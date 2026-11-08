# Week 6 — AI and agents

## Working now
- **One model gateway** (`apps/api/src/ai/gateway.ts`) is the only path to any model. It handles four providers: the local open-weight model, Claude (Anthropic), OpenAI, and a deterministic writer that uses no model.
  - Every call is checked in order: allowlist → foreign-model switch → classification ceiling (secret never leaves) → outbound access → key.
  - The SDKs get a guarded `fetch` that can only reach the provider's own host.
  - Refused calls are written to the call log and the audit chain (`model.call_blocked`, `egress.blocked`). The call then falls back to the local model, then to the deterministic writer.
- **Local open-weight model** runs on this machine through llama.cpp in the reasoning service.
  - Model: Qwen2.5 1.5B Instruct, Q4_K_M, Apache-2.0, 1.1 GB, sha256 `6a1a2eb6…407e`.
  - Decoding is greedy with a fixed seed, and responses are cached by prompt hash, so a replay gives the same text.
  - Typical step: 2–10 seconds on 4 CPU cores.
- **Sovereignty switch** in Governance & Audit sets:
  - foreign models on or off
  - outbound access
  - model allowlist
  - highest classification a foreign model may see
  - default model

  Changes need a reason and are audited. The header badge always shows the current state. Defaults: foreign models off, outbound off, local model only.
- **Ten bounded agents**, each with fixed tools and listed may / may-not rules:
  - signal triage
  - noise moderation
  - entity resolution
  - document extraction
  - causal impact
  - financial impact
  - scenario analyst
  - sector agents
  - governance checker
  - brief writer

  Numbers come only from tools: SQL, graph traversal and the scenario engine. Models only phrase them.
- **Case analysis in five phases:** gather → analyse → challenge → recommend → govern / compose, with 12 steps. A run trace for every step shows:
  - tool calls with inputs and timings
  - the sources given to the writer
  - sources excluded by the injection screen
  - every gateway attempt
  - the raw model text before checking
  - tokens, time and cost
- **Visible challenge round.** Agents contest each other's claims, for example:
  - simulated inputs ranked first
  - an uncalibrated price parameter
  - weak graph links
  - wide P10–P90 ranges
  - unresolved names
  - quarantined documents

  Each challenge is accepted or rebutted with a stated effect on confidence.
- **Citation check** (`verifyText`). A sentence counts as cited only if all three hold:
  - it names a source that was provided
  - every number in it is in a cited source
  - each number belongs to the same quantity there

  If fewer than half of a step's sentences pass, the deterministic writer replaces them and the reason is shown. Otherwise failed sentences stay visible as UNVERIFIED.
- **Options tab:** options are measured by re-running the scenario engine with stated driver changes. Each option shows:
  - effect on 90-day value at risk, resilience and 72-hour shortfall
  - score formula
  - confidence band from four components (no bare percentage)
  - five policy checks (PASS / HOLD)
  - owner, decision authority and constraints

  Feedback re-ranks the same kind of option across the institution (±4 per net vote, capped at 12) and is audited. Experts can adjust confidence with a recorded reason; the original band is kept.
- **Ask TIGERIS** (inside a case only):
  - answers from that case's own records, with citation chips that open source or calculation lineage
  - says plainly when the records don't answer the question
  - refuses instruction-like questions without calling a model, and audits the refusal
- **Ask the graph** (Intelligence Graph): plain-language path, exposure and neighbour questions.
  - The local model fills a fixed JSON schema (rules are the fallback).
  - Names resolve deterministically, and the query itself is deterministic.
- **Executive brief:** every analysis saves a versioned brief. It can be read in the case or exported as PDF; the export is audited and needs the export permission. The PDF has:
  - classification banners
  - numbered citations
  - unverified sentences marked
  - ranked options
  - the "Confidential · Client IP" footer
- **Cost and usage panel:**
  - calls, cached and blocked counts
  - tokens and spend by agent
  - recent runs and recent blocked calls
  - local compute time

## Example (seeded Gulf Sovereign Fund, Hormuz case, local model)
| | |
|---|---|
| Steps | 12; the local model wrote 6 that passed the citation check, and the deterministic writer took the other 6 with the reason shown |
| Challenges | 3 raised, 3 accepted: simulated top signal, uncalibrated price response, 48% weak links on paths |
| Top option | Shift exports and imports to bypass routes: 90-day value at risk USD 929.6 m → USD 581.0 m; resilience 65 → 71; confidence medium; policy PASS |
| Cost | USD 0 (local model); about 1,900 tokens |

## Tests
- **API: 61 tests.**
  - 11 new unit tests: citation check, tag normalisation, injection screen, policy order, graph parsing, retrieval, re-ranking, PDF text.
  - 8 new integration tests: a 12-step run with a challenge round; feedback re-ranking and expert adjustment with audit; PDF export permissions; classification and egress blocks audited with fallback; instruction refusal with no model call; graph questions; tenant isolation.
- **Reasoning: 11 tests**, including 2 new local-model contract tests.
- **Other suites:** shared 12, web 3. Typecheck is clean.
- **Browser walk-through:** Agents, Options, brief, Ask TIGERIS, Ask the graph and Governance (as administrator), with no console errors.

## Not done / blocked
- **No live foreign model call yet.** You declined the OpenAI key, and an Anthropic key can't be stored in this build session. Both adapters, the blocking and the fallback are built and tested; a live call needs keys in the deployment environment (SCOPE B3).
- **The 1.5B local model often fails the citation check.** Output stays honest but less fluent. A larger model can be dropped in through `LOCAL_MODEL_PATH` without code changes.
- **Policy rules are a fixed v0 set of five.** The policy-as-code engine and editor come in week 7.
- **Docker package not re-verified.** The reasoning image now compiles llama.cpp and mounts `data/models`.
- **Code is still committed locally only** (GitHub access, SCOPE B1).

## Next (week 7): governance and memory
- Policy-as-code engine with an editor and tests
- Approvals configurable per action type
- The named decision and operations handoff
- About 50 precedents with keyword and semantic search
- Decision drift and audit replay
- Export with redaction
- Security posture page
