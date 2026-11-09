# Brief v3: Step zero report

## 1. Goal in five lines

1. Make the client's scripted `/environment` sandbox real: the same Hormuz story, vocabulary and look, but computed.
2. Diagnose one fund (Fund A, $100B illustrative mandate) on 8 gaps with a typed, versioned rubric and composite indices.
3. Quantify value at stake (percentage points, capped by a ceiling) and before/after KPIs, every assumption editable and labelled.
4. Propagate the Hormuz shock through a transparent transmission graph, then take a governed decision: package, authority, approval, owners, Ledger.
5. Run the golden path offline in under 8 minutes, in tigercapital.ai's own design language, with every number labelled.

## 2. Audit: this repo against the brief

This repository is already a working prototype (58 commits, about 110 API tests). Most of the brief's modules exist in some form; the work is to reshape them, not start again.

| Brief module | What exists here | Gap to the brief |
|---|---|---|
| OS shell | Left rail, top bar (tenant, data mode, model status), roles, Arabic | Loop indicator (12 steps), ⌘K palette, GST clock, DEMO badge, client theme |
| 1 Briefing intake | Sign-in with institution, industry and role | Welcome screen with verbatim client copy; the /briefing form; Engagement record |
| 2 Signal layer | MapLibre map, real AIS (aisstream.io) with stored tracks, real ADS-B snapshot, scripted ships, signals, data sources with lineage | Hormuz replay timeline in the sandbox's form; LIVE/DELAYED/REPLAY labels |
| 3 Diagnosis | Gap diagnostic: 7 gaps scored 0–4 from evidence, saved and audited | Rework to the §3 rubric: 8 gaps, metric inputs normalised 0–100, weights, confidence, CSAI and debt indices, workshop mode |
| 4 Simulator | Python engine: Hormuz cascade, Monte Carlo, 72h/90d/1y/5y, replay, back-test on real Brent | Transmission graph config (coefficient, lag, order), impact panel, scenario outlook summing to 100%, sleeve re-derivation |
| 5 Gap report | Value at stake as a planning range, before/after, Markdown export | §4 formulas (percentage points, ceiling, per-gap share), sliders, ROI line |
| 6 Governor question | Ask TIGERIS, ten bounded agents under six specialists, citation check, executive brief | §12 Decision Brief schema, number-match against `facts`, the 12 quick prompts, cached mode |
| 7 Decision loop and Ledger | Named decisions, policy-as-code approvals, envelopes, handoff tasks with owners, hash-chained audit, replay, drift | A Ledger view in the sandbox's form; KPI tracking |
| 8 Blueprint | Architecture page with live figures | L1–L4 view per gap |
| 9 Mandates and pilot | 13 playbooks, start a case | The 5 use-case cards and pilot builder |
| 10 Ladder and ROI | Not built (pricing kept out of the public repo) | Needs a private repo first |
| 11 Memory | Precedents, embeddings, meaning search, memory from cases | Entity graph from documents |
| 12 Boardroom | Command Centre | Computed CSAI and indices as metric cards, ticker, lens toggle, coordination network |
| 13 Investor view | Not built | Phase 2 |
| 14 /assess | Public /readiness self-check (no AI) | Rename, 8 gaps, Lead record |
| 15 Kernel / trust | /trust page, Sovereignty module | Roadmap statuses, request forms |
| 16 Admin | Roles, forced row-level security, policy editor, audit viewer | Rubric and transmission editors |

## 3. Stack: keep, do not migrate

The brief names Prisma, Auth.js, next-intl and shadcn. This repo uses plain SQL migrations with forced row-level security per tenant, a Fastify API, its own i18n and its own components. Migrating would cost days, and would weaken tenant isolation (Prisma does not enforce RLS). We recommend keeping the stack and documenting the mapping for the client CTO.

| Brief entity | Here |
|---|---|
| Tenant, User | `institutions`, `principals`, `principal_roles` |
| Signal, Document | `signals`, `evidence_objects`, `evidence_facts` |
| Scenario, SimulationRun | `scenario_runs`, `scenario_results`, `scenario_assumptions` |
| Brief | `case_briefs`, `agent_runs`, `model_calls` |
| DecisionPackage, Approval | `decisions`, `decision_approvals`, `decision_envelopes` |
| Task | `handoffs`, `handoff_updates` |
| GraphEntity, GraphRelation | `entities`, `entity_relationships` |
| LedgerEntry | `audit_events` (append-only, hash-chained) |
| **New for v3** | `engagements`, `gap_inputs`, `gap_scores`, `assumptions`, `kpis`, `leads` (migration 0014) |

## 4. Thursday task list (estimates)

| # | Task | Hours |
|---|---|---|
| 1 | Client theme from TOKENS.md: self-hosted fonts, ivory surfaces, eyebrows, numbered sections, `Fig. —` captions, mono system strings, hairline grid | 6 |
| 2 | Welcome screen (verbatim copy in `content/client-copy.ts`, 4 principles with "See it in the OS"), intake form prefilled for Fund A | 5 |
| 3 | Six data labels across the UI; provenance drawer for MODELLED values | 3 |
| 4 | Rubric v3 in shared config: 8 gaps, normalisation, confidence, CSAI and debt indices, unit tests, workshop edits written to the Ledger | 6 |
| 5 | Value model §4 with sliders, before/after KPIs, ROI line, tests | 4 |
| 6 | Transmission graph, three-order propagation, impact panel, scenario outlook, sleeves; under 300 ms; tests | 8 |
| 7 | Boardroom: computed metric cards, ticker, lens toggle, coordination network, 12-step loop indicator | 6 |
| 8 | Governor question → Decision Brief (cached, schema-checked, numbers matched) → package → approval → owners → Ledger; coordination index drops | 6 |
| 9 | Hormuz replay timeline feeding signals and the map | 3 |
| 10 | Demo mode, Reset, /status preflight, presenter shortcuts | 3 |
| 11 | Golden-path Playwright test; brand side-by-side review | 3 |
| | **Total** | **53** |

53 hours does not fit comfortably before Thursday. If it must, cut 10 and 11 to the minimum (Reset already exists) and keep 1–9.
