# Brief v3: the golden path, end to end

Fund A (synthetic), one scenario (Hormuz), one flow. Verified in a browser on 10 Nov 2026.

| Step | Screen | What is computed, and where |
|---|---|---|
| 0 | Welcome (`/`) | The client's copy verbatim; scene 06 live |
| 1 | Briefing Intake | The client's form fields and disclaimer; opens an engagement (Fund A is seeded) |
| 2 | Boardroom | CSAI, value at stake, readiness, governance confidence, cognitive and coordination debt, time to governed action. Each card shows its formula and a MODELLED label |
| 3 | Shock Simulator | The transmission graph gives three orders of effect, the impact panel, a scenario outlook summing to 100% and the re-derived sleeves. Each effect shows its provenance |
| 4 | Gap Report | 8-gap rubric (placeholder bands), confidence without imputation, value at stake in percentage points capped by the ceiling, before/after KPIs. Workshop edits are written to the Ledger |
| 5–6 | Governor Question | A decision brief built only from engine facts, validated (numbers must be facts; claims need evidence) and cached in demo mode |
| 7 | Governor Question | A decision package goes to the role the authority matrix names (Governance Officer). Approval assigns four owners from the 72-hour plan and writes the measured signal-to-owner latency back to the diagnosis |

Measured result in the run: coordination debt fell from 75.2 to 44.1 and CSAI rose from 28.7 to 32.6. The Boardroom now shows "Coordination debt, resolved", and the Ledger lists every step with its hash.

## Engines (all in `packages/shared`, pure and tested)

- `config/diagnosis-rubric.ts` and `engine/diagnosis.ts`: brief §3.
- `config/valuation-defaults.ts` and `engine/valuation.ts`: brief §4. No licence price is stored.
- `config/transmission.ts` and `engine/simulation.ts`: brief §5. Every coefficient is a placeholder until sourced.
- `config/authority.ts` and `engine/brief.ts`: brief §6 and §12.

## Not done yet

- `/status` preflight, presenter keyboard shortcuts and a golden-path Playwright test in CI (§11.2 and §11.4).
- A live model behind the brief. Demo mode serves the cached brief; the gateway path exists for other agents.
- The `LIVE` / `DELAYED` / `REPLAY` labels on the existing signal and map screens. The new screens carry `SYNTHETIC` / `MODELLED` / `ILLUSTRATIVE`.
- Scenes 03, 10 and 13, which are waiting for their plates.
