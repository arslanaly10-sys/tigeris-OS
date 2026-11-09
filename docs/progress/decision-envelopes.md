# Decision envelopes

*From Tiger's "decision velocity" playbook and the critical review (docs/review). FR-34, FR-35, TR-046.*

## What it does

The committee approves an envelope once, setting:

- the domain it covers;
- the authority it delegates (board or executive committee items);
- a limit on how much 90-day value at risk an option may leave;
- which roles may authorise inside it;
- an expiry date.

A decision that fits the envelope needs one named authoriser instead of the committee's approvals. Anything outside it goes to the committee as before. Nothing executes: an approved decision still only creates handoff tasks.

## How it is governed

- **Two people.** An executive proposes an envelope and a *different* approver or executive activates it. This is enforced by the policy (`envelope.activate_distinct_person`) and by a database check.
- **The policy decides the fit.** The active policy-as-code version decides whether a decision fits, using action `decision.envelope`:
  - the envelope is active and in date;
  - the domain matches;
  - the authority matches;
  - the option is within the size limit;
  - the person's role is named as an authoriser.

  The person sees the result for every option before deciding.
- **Fails closed.** If the active policy has no envelope rules, envelopes are switched off and every call is refused. No envelope is ever silently allowed.
- **Audited.** Every step is audited: `envelope.proposed`, `envelope.activated`, `envelope.revoked` and `envelope.refused`. A decision taken inside an envelope records the envelope and the fit's policy trace on `decision.recorded`. Replay and drift work unchanged.
- **One live decision per case.** A case can have only one pending or approved decision at a time. The server now refuses a second one; before, only the screen prevented it.

## Where it is

- Database: `db/migrations/0013_decision_envelopes.sql` (row-level security forced; `decisions.envelope_id`).
- Workflow: `apps/api/src/workflow/envelopes.ts`. Routes: `/envelopes`, `/envelopes/:id/activate`, `/envelopes/:id/revoke`, and `envelopeId` on `POST /cases/:key/decisions`.
- Policy: 11 rules and 3 tests added to the default policy.
- Screens:
  - **Decision Authority:** the list of envelopes, with propose, activate and revoke.
  - **A case's Decision and memory tab:** a route picker (committee, or inside an envelope that fits) and an envelope badge on the decision.
- Seed: one synthetic, active envelope per demo institution, limited to $1 bn of remaining 90-day value at risk for energy board items.
- Tests: `apps/api/test/envelopes.test.ts`.
- Screenshots: `docs/screenshots/envelopes/`.
