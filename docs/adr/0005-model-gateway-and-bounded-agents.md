# ADR 0005 — One model gateway, bounded agents, checked text

Status: accepted (week 6)

## Context
The questionnaire asks for real models (Claude, OpenAI and a local open-weight model), a visible switch that cuts
foreign models, ten agents with full traces, and no uncited text (Q060–Q069). Sovereign buyers need to see that
prompts cannot leave the institution unless an administrator allows it, and that models never become the source of a
number, a policy decision or an authority.

## Decision
1. **One gateway** (`apps/api/src/ai/gateway.ts`) is the only path to any model. For each call it checks, in order:
   allowlist → foreign switch → classification ceiling (secret never leaves) → outbound access → key. The SDKs get a
   guarded `fetch` that only reaches the provider's own host. Refusals are written to `model_calls` and to the audit
   chain (`model.call_blocked`, `egress.blocked`); the call then falls back to the local model, then to the
   deterministic writer.
2. **Local model** runs in the Python reasoning service with llama.cpp (Qwen2.5 1.5B Instruct, Q4_K_M, Apache-2.0),
   greedy decoding with a fixed seed, so a prompt gives the same text on replay. Responses are cached by prompt hash.
3. **Agents are code, not prompts.** Each agent step runs deterministic tools (SQL, graph traversal, the scenario
   engine), builds numbered sources from their output, and may ask a model to phrase two or three sentences.
   Numbers, rankings, confidence bands and policy results come from the tools.
4. **Checked text.** `verifyText()` marks a sentence cited only if it carries a tag naming a provided source, every
   number in it is in a cited source, and each number sits on the same quantity there. If fewer than half the
   sentences pass, the deterministic writer replaces the model text; otherwise failures stay visible as UNVERIFIED.
5. **Debate is rule-driven.** Challenges between agents come from explicit checks (simulated inputs, uncalibrated
   parameters, weak graph links, wide ranges, unresolved names, quarantined documents), each accepted or rebutted
   with a stated effect on confidence.
6. **Options are measured, not written.** Each option is a set of driver changes run through the scenario engine;
   the score formula and its assumptions are shown. Feedback adjusts the score of that kind of option across the
   institution (±4 per net vote, capped at 12); the base score is kept.

## Consequences
- The demo runs fully offline; foreign providers are demonstrable as *blocked* without keys, and live once keys are set.
- A 1.5B local model often fails the citation check; the fallback keeps output honest at the cost of fluency.
  A larger local model can be dropped in through `LOCAL_MODEL_PATH` without code changes.
- Relational errors in model text (right number, wrong claim) are reduced by the context check but not eliminated;
  the raw model text stays in the trace for review.
