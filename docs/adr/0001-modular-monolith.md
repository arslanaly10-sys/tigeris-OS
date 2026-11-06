# ADR-0001 Modular monolith with a separate reasoning service

Status: accepted · 6 Nov 2026

Context: TRD §2 and the Implementation Plan recommend a modular monolith until workload and air-gap rules are known. The questionnaire chose a TypeScript core plus a Python reasoning service (Q108).

Decision: one TypeScript API (`apps/api`) organised by domain modules (identity, sources/evidence, graph/cases, governance/decisions, memory/audit), plus one Python service (`services/reasoning`) for deterministic calculation. The web app calls only the API; the API calls the reasoning service.

Consequences: one deployable package; contracts stay separable for later extraction. Python owns numeric work so model output never produces a quantity.
