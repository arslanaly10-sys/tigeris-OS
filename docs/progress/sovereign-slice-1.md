# Sovereign intelligence, slice 1: industries, roles and the industry lens (9 Nov 2026)

Agreed with the client on 9 Nov 2026: four slices (1 industries and sign-in; 2 map icons and aircraft;
3 Sovereignty module; 4 voyage anomalies and correlation). This note covers slice 1.

## Working now
- **12 industries** (`packages/shared/src/industries.ts`): the eight domain packs plus defence and security,
  healthcare, telecoms and digital, and transport and aviation. Each has an icon, a one-line focus, the graph
  entity types and map layers it looks at first, and English and draft Arabic names.
- **Roles stay the seven permission roles.** Each industry adds a job title per role (84 titles, English and
  draft Arabic), e.g. Energy: Domain Expert = Head of Crude Trading; Healthcare: Approver = Chief Medical Officer.
- **Sign-in:** institution → industry → sign-in method → role (with the industry job title) → MFA.
  The industry is kept on the session (migration 0010), shown in the sidebar with the job title, and can be
  changed there; each change is audited (`session.industry_changed`). A role switch keeps the industry.
- **Industry lens across the OS:** the Command Centre attention queue, Intelligence Cases and Signals show the
  industry's items first under "In your industry", with "Show other industries (N)" one click away; a signal
  opened by link stays visible. The Movement Map starts with the industry's layers on. Domains lists the
  industry first. Permissions never depend on the industry.
- **Every industry has work:** six new synthetic or simulated cases with signals (manufacturing, construction and
  real estate, defence and security, healthcare, telecoms, transport and aviation), four new domain packs, and
  graph entities tagged for the new industries by entity type (derived in the graph build, so the signed reference
  package is unchanged).

## Verification
- Tests: API 84 (5 new for the industry lens), shared 21 (2 new), web 3; typecheck clean.
- 12-step rehearsal passes with the Energy lens, no console errors.
- Screenshots in `docs/screenshots/slice1/` (industry step in English and Arabic, role step with job titles,
  Command Centre and Cases with the Healthcare lens, Domains).

## Not done / next
- Slice 2: ship, truck and aircraft silhouettes; simulated flights; real flight snapshot from adsb.lol
  (needs `api.adsb.lol` allowed).
- Slice 3 needs the McKinsey article text from the client.
- Arabic industry names and job titles are a draft until a client reviewer approves them.
