# Tiger's six specialists, and four fund apps

*From the critical review (docs/review, section 6) and Tiger's own sites.*

## Six specialists over ten bounded agents

Tiger's sites name six specialists: Sentinel, Macro, Resilience, Capital, Mandate and Governance. The prototype keeps its
ten narrow, bounded agents, because each one gets its numbers from tools only and is checked separately. They are now
grouped under the six names a decision-maker sees (`AGENT_SPECIALIST` in `packages/shared/src/playbooks.ts`):

| Specialist | Agents |
|---|---|
| Sentinel | Signal triage, noise moderation, entity resolution, document extraction |
| Macro | Causal impact, sector agents |
| Resilience | Scenario analyst (72 hours, 90 days, 1 year, 5 years) |
| Capital | Financial impact |
| Mandate | Brief writer (frames the options against the mandate) |
| Governance | Governance checker |

On a case's Agents tab:

- a "specialist council" panel lists each specialist, the agents it speaks for and the steps they ran;
- every agent step carries its specialist's name.

Mandate is the thinnest specialist today: a dedicated mandate-fit check is still to come. The four horizons already
matched Tiger's.

## Four fund apps (module: Fund Apps)

These are the first applications a fund team can use in week one. All the companies, figures and limits are
**synthetic** and are labelled on every screen. The arithmetic is deterministic, in `packages/shared/src/fund.ts`;
no model computes or decides anything.

1. **Deal screening.** Seven deals are checked against the mandate on seven criteria:
   - sector and exclusions;
   - geography;
   - ticket band;
   - single-name limit;
   - sector concentration after the deal;
   - leverage;
   - ESG flags.

   Each check says why it passed or failed. The deal's result is advance, review or decline. A deal that passes or needs
   review can go to committee as an ordinary, audited case (`POST /fund/deals/:key/case`), which then runs the normal
   analysis and named-decision flow. A declined deal cannot go to committee.
2. **IC memo.** A first-draft memo assembled from the deal record and the screen: recommendation, thesis, key figures,
   mandate fit, risks and diligence questions. It can be downloaded as Markdown.
3. **Portfolio monitoring.** Eight holdings are checked for covenant headroom, revenue against plan, value change this
   quarter and cash runway. The summary shows breaches and watch items.
4. **Board and LP report.** A quarterly report computed from the holdings: headline figures, allocation against the
   sector limit, largest movers, breaches and a holdings table. It can be downloaded as Markdown.

Tests:

- `packages/shared/test/fund.test.ts`: screening verdicts, exact valuation and concentration arithmetic, monitoring and
  labelling.
- `apps/api/test/fund.test.ts`: a case is opened and audited; a declined deal, an unknown deal and an auditor are
  refused.
