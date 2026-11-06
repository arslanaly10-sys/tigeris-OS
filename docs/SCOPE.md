# TIGERIS Demo — Scope Lock

Locked 6 Nov 2026 from the 126-question build questionnaire plus four follow-up decisions.
Source requirements: `TIGERIS_Requirements_Register.md` (FR-xx, TR-xxx, AC-xx IDs).
Anything not listed here is out of the demo unless a change request adds it.

## 1. Roadmap

| Stage | Weeks | Outcome |
|---|---|---|
| 1. Full demo | 1–8 | Every module working end to end on public snapshots and synthetic data. Delivered as a hosted link (cloud VM) **and** an offline laptop package (same Docker build). |
| 2. Sovereign pilot | 9–20 (by week 24 from start of planning) | One real institution on-premise: real approved data, real SSO/MFA, one licensed feed, real back-testing, Arabic. |
| 3. Sovereign production | to week 36 | Air-gap hardening, more domain packs, HA/DR, security review, more connectors. |

Progress: a working slice every week.

## 2. Audience and presentation
- Audiences, in order: investors, client sign-off, sovereign fund prospects.
- Run by the client and by our team: free exploration by default, plus a **light guided mode** ("Start demo story": Hormuz → resilience → capital allocation, no narration).
- One-click demo reset. Subtle "Demonstration Mode" badge in the header. No sound.
- Desktop and tablet. Rich animation (map motion, cascade ripples); the OS reduced-motion setting is still respected for accessibility.

## 3. Brand
- Name in UI: **TIGERIS · Sovereign Intelligence OS**. Text wordmark only.
- Tagline on sign-in and About page only.
- Dark and light themes with a switch; **dark is default**. Serif headings + sans body.
- Subtle regional geometric pattern on sign-in and empty states only.
- Information density adapts to role (executive spacious, analyst dense).
- Footer: "Confidential · Client IP". Strict Foundation voice rules for all copy.
- Target institutions shown as **buyer categories only**.

## 4. Language
- English UI; **Arabic for navigation and key screens**, our draft, labelled as draft; RTL layout on those screens.
- Western digits, Gregorian calendar.

## 5. Users and identity
- Roles: Executive/Governor, Analyst, Domain Expert, Approver, Operations Owner, Administrator/Governance Owner, Auditor.
- Sign-in: simulated institutional SSO button + clearly labelled demo entry; **simulated MFA step**; role picker at sign-in and role switcher in header.
- **Two fictional institutions** to prove data isolation. Fictional people with names and titles.
- Separation of duties **enforced**.

## 6. Modules (PRD 11-module navigation)
Command Centre (attention queue + map panel) · Signals & Early Warning · Intelligence Cases (analyst workspace inside the case) · Intelligence Graph · Scenarios & Foresight · Decision Authority · Domains · Institutional Memory · Data & Sources · Governance & Audit · Administration.
Plus: Reports module · global search (signals, entities, cases, memory) · notification centre · one-page executive brief export per case · interactive investor architecture page · About page.
"Ask TIGERIS" assistant **inside a case only**, grounded on that case's evidence.

## 7. Cases and domains
- **Full depth (3):** Strait of Hormuz disruption · Institutional resilience (same Hormuz event) · Oil falls to USD 45 (capital allocation).
- **Medium depth (4):** Red Sea shipping disruption · Pandemic-type supply shock · Banking / liquidity stress · Food security / import dependency. Working case with graph and scenarios; less map and data depth.
- **Short (2):** Water / desalination outage · Sanctions change affecting a counterparty.
- Domain packs: all 8 (sovereign capital, energy, banking, supply chain, infrastructure/utilities, manufacturing, construction/real estate, insurance). Family office/VC view excluded.
- Hormuz: real geography and history, hypothetical event. Real place names; fictional operators. All six GCC states.

## 8. Data
- Real public snapshots + synthetic. Snapshot sources: GCC-Stat, DataSaudi/GASTAT, Bayanat, central banks, JODI Oil, EIA (incl. chokepoints), IMF/World Bank, OFAC/UN/UK sanctions. Refreshed by script when we choose.
- Clearly labelled **simulated live stream**.
- **Real document ingestion** (upload PDF, extract facts with citations). Presenter can upload a file or add a signal live.
- Synthetic portfolio ~100 holdings; graph ~1,000 entities; ~50 precedent decisions.
- **Real back-test replay** on a historical snapshot with measured results.
- Every number clickable to lineage.

## 9. AI
- Real models through the gateway (**Claude and OpenAI, selectable**) + **real local open-weight model** (Llama/Qwen class) + deterministic fallback.
- Big visible model switch: cut foreign models live and keep running.
- Agents: signal triage, noise/source moderation, entity resolution, document extraction, causal impact, financial impact, scenario analyst, governance checker, decision brief writer, sector agents (energy, banking).
- Full run timeline per agent (inputs, tools, outputs, model, cost); visible agent debate step; plain-language graph questions; no uncited AI text (else "unverified").
- Confidence = band + components; expert adjustments recorded; recommendations re-ranked from human feedback; AI cost panel.

## 10. Reasoning
- Fixed horizons 72 h / 90 d / 1 y / 5 y, plus Hormuz day-by-day cascade to ~day 150.
- Drivers: disruption duration, oil price, route availability, insurance premium, reserve buffer, FX/rates, demand.
- Deterministic values and Monte Carlo ranges/fan charts. Configurable bounded cascade depth.
- Baseline + up to 2 alternatives side by side. Option count varies by case.
- Decision drift detection; structural resilience score (impact size, recovery speed, future risk).

## 11. Map
- MapLibre with packaged offline tiles, dark style, opens on whole GCC, 3D globe view.
- ~200 ships, synthetic labelled trucks, rerouting (e.g. Cape of Good Hope), simulated live ticking.
- Layers: ports/terminals, pipelines, refineries/storage, desalination, power plants, airports, corridors, borders, chokepoints.
- Map/table toggle.

## 12. Governance, sovereignty, security
- Real policy-as-code (PASS/HOLD/BLOCK), editable and testable by admin.
- Sovereignty controls: offline switch, outbound blocking, model allowlist, data residency badge, **working air-gap package import** (signature + hash verify), institution isolation.
- Hash-chained, verifiable audit; decision replay from audit; export with redaction; classification labels; security posture page; prompt-injection demo (poisoned document quarantined).
- Encryption at rest not required for demo.

## 13. Workflow and memory
- 8 case states (Detected → Triaged → Analysis → Scenario → Review → Decision → Handoff → Closed).
- Approvals configurable per action type; handoff task tracking; case comments and mentions.
- Memory search keyword + semantic.

## 14. Technology
- Monorepo: `apps/web` Next.js + React + TypeScript + Tailwind + shadcn/ui · `apps/api` TypeScript core · `services/reasoning` Python · `db` PostgreSQL + pgvector.
- Background jobs: PostgreSQL-backed job queue (decided: simplest, offline-friendly; ADR-0004).
- Docker Compose package for both the laptop and the cloud VM.
- Core tests + CI from day one. CLAUDE.md, README, ADRs. Private repo (pushed once GitHub access is fixed).

## 15. Eight-week plan

| Week | Slice | Key outputs |
|---|---|---|
| 1 | Foundation | Monorepo, CI, Docker; 2 institutions, 7 roles, SSO+MFA sign-in, role switch, SoD primitives; hash-chained audit; 11-module shell; themes; EN/AR navigation; badge, footer |
| 2 | Evidence spine | Source registry; public snapshot scripts; validation & quarantine; evidence vault; PDF ingestion; lineage panel; Data & Sources; prompt-injection quarantine |
| 3 | Graph & cases | Ontology; ~1,000-entity GCC graph; signals; 8-state case workflow; case workspace; graph view; comments; global search; notifications |
| 4 | Map | MapLibre offline tiles + globe; 200 ships, trucks; layers; replay & simulated live; rerouting; map/table; Command Centre map panel |
| 5 | Reasoning | Python service; bounded propagation; calculators; 4 horizons + day-150; Monte Carlo; drivers; resilience score; scenario compare |
| 6 | AI | Model gateway (Claude, OpenAI, local); offline switch & egress block; 10 agents with traces & cost; debate; graph Q&A; Ask TIGERIS; brief writer |
| 7 | Governance & memory | Policy engine + editor; approvals & SoD; handoffs; memory (50 precedents, semantic search); feedback re-ranking; drift; audit replay; export/redaction; air-gap import; security posture |
| 8 | Cases & release | 3 full + 4 medium + 2 short cases; back-test; Reports; exec brief; architecture page; guided mode; reset; Arabic screens; tablet; VM + laptop packages; rehearsal |

## 16. Blockers needing you
| # | Blocker | Needed by |
|---|---|---|
| B1 | GitHub access invalid in this session: reconnect at claude.ai/connect-github and create an empty private repo | ASAP (code lives only in this session until then) |
| B2 | Network access to public data hosts (GCC-Stat, national portals, IMF, World Bank, EIA, JODI, sanctions lists) | Week 2 |
| B3 | Anthropic and OpenAI API keys | Week 6 |
| B4 | Download of the local open-weight model and offline map tiles (Hugging Face / Ollama registry / tile source) | Weeks 4 and 6 |
| B5 | Cloud VM for the hosted link (provider and account) | Week 8 |
