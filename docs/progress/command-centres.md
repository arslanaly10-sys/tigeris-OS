# Sector Command Centres

## Phase 2 (10 Nov 2026): inside the OS, the OS restyled to match, features added

- **In the OS.** `/command-centres/<sector>` now runs inside the signed-in OS shell (`app/(os)/command-centres`), first in
  the sidebar as "Sector Command Centres". `/command-centres#energy` still works; with no hash it opens the sector of the
  person's lens. Opening a sector moves the OS sector lens to it (an audited lens change; permissions do not change).
- **The whole OS restyled** to the Command Centre system: tokens, Libre Caslon Text + Inter, 10px cards, solid green
  active nav, palm brand lock-up, 72px top bar with Institution, Sector, EN | العربية and the gold approvals pill
  (live count of cases awaiting a decision). See DESIGN.md v4.
- **Live data.** `GET /sectors/:industry` (withTenant) returns this institution's cases, review queue and signals for the
  sector with row counts. Each Command Centre shows them in an "In this institution" strip (every count and signal
  links to its list), puts real cases at the top of Priority Intelligence Cases and Expert Review Queue, and fills the
  Banking mandate status cells with real case counts. Sector figures that need authorised sources stay "—".
- **Start a case from any card.** `POST /sectors/:industry/cases` (case.create) opens an ordinary case at "detected" in
  that sector, owned by the person, with a case event and an `appendAudit` record in the same transaction. Nothing executes.
- **Wired to OS modules.** "View all" and buttons go where the work is done: cases → Intelligence Cases, scenarios →
  Scenarios & Foresight (Shock Simulator for energy and supply chain), mandates and approvals → Decision Authority and
  Governor Question, specialists → Playbooks, "Connect authorised data" → Data & Sources, maps → Movement Map.
- **Arabic.** All 589 Command Centre strings plus dialog text have an Arabic draft (`lib/command-centres-ar.ts`) and follow
  the OS language and direction.
- Tests: `apps/api/test/sectors.test.ts` (sector scoping, audited case opening, tenant isolation, 400/403 refusals).

## Phase 1

Eight sector screens from the supplied mockups, one config (`lib/command-centres.ts`) and a renderer per block type.
Screenshots at 1440px from phase 1 are in `docs/progress/command-centres/`.

## Mockup version kept (11 Nov 2026)

The phase 1, mockup-exact Command Centres are restored at `/command-centres-original/<sector>` (public, no sign-in):
their own sidebar and top bar, no institution data, every figure "—", every button a dialog. Code:
`components/command-centre-original.tsx` and `command-centre-original.css` (classes renamed `cv1-*` so they never clash with
the OS version). The welcome page links to it, and each OS Command Centre footer has a "Mockup version" link to its sector.
