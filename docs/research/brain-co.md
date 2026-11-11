# Research: Brain Co. operating systems, and what TIGERIS takes from them

Read on 11 Nov 2026 from the five public pages below, plus public search results about the company. Everything here is paraphrased; nothing of theirs (copy, names, layout or artwork) is reused in TIGERIS. This is a positioning reference, not a claim about their product beyond what their pages state.

| Page | URL |
| --- | --- |
| Platform | https://brain.co/atlas |
| Finance | https://brain.co/finance |
| Health | https://brain.co/health |
| Insurance | https://brain.co/insurance |
| Government | https://brain.co/government |

## 1. What they sell

Brain Co. describes itself as building "agent-native operating systems" for regulated institutions. There are four vertical products (a government OS, a health OS, an insurance OS and a finance OS), all running on one shared platform layer they call Atlas. Public profiles describe a young (2024) San Francisco company of about 40 people. Its hiring copy describes engineers drawn from large platform companies and a move into national-scale production deployments.

Every vertical page has the same four-part shape:

1. **A one-line claim** that it is the operating system for the modern version of that sector.
2. **Six key applications**: the operational workflows that the vertical runs.
3. **"How to work with us"** in three steps: start with one application where speed, accuracy and control matter most; have their engineers fit it to your rules, data, permissions and review standards (the sector's codes and regulations come built in); then add more workflows on the same system over time.
4. **Security and control**: built on the platform, secure by design, no lock-in to any one model, with compliance attestations (SOC 2 Type II; HIPAA for health).

### The applications, per vertical (paraphrased)

| Vertical | The six workflows |
| --- | --- |
| Government | Permit review against codes; licensing with cross-checks for fraud and inconsistency; grant evaluation, scoring and ranking; procurement risk review with a structured path to award; disaster-recovery eligibility and disbursement; resident service requests routed across voice, text and email. One application is open for anyone to try. |
| Health | Intake of faxes, claims and correspondence (classify, extract, route); prior authorisation and utilisation management (evidence surfaced, determination drafted); appeals and grievances against statutory deadlines; quality and care-gap closure from notes; completeness checks before submission; payment integrity with an auditable rationale. The page repeats that a human leads every determination. |
| Insurance | Claims (first notice of loss triage, coverage, liability, reserves, fraud signals); underwriting against guidelines; reinsurance and capital (ceded exposure, recoverables, capital targets); distribution (producer onboarding, quoting, commissions, licensing); policy servicing; pricing and reserving. |
| Finance | Deal sourcing and first-look screening against the thesis and institutional memory; diligence and investment-committee memo preparation; portfolio monitoring with scenarios and LP, board and executive reporting; underwriting and lending (spreading, the credit box, the credit memo); servicing and compliance with examiner-ready output; finance and close (variance analysis and reconciliations on your rules). |

### The platform (Atlas)

The platform sits beneath every vertical and makes three promises:

- **Model replacement.** It runs the best model for each task, so the client is independent of any one provider's limits and prices. There is no lock-in and nothing has to be rebuilt.
- **"Sovereign-grade" security.** There are four deployment options: their cloud, your cloud, your data centre, or a fully isolated environment. Data and keys stay with the client, there is never any cross-client training, and data is encrypted at rest and in transit. Access is least-privilege, and every interaction is scoped, logged and traceable.
- **Assurance.** A trust centre holds the attestations, penetration-test results and policies, available on request.

Their enterprise page adds a cadence: a working prototype in days, live use on real data in weeks, and production in months.

## 2. What TIGERIS takes from this (and has already taken)

- **Start with one application.** TIGERIS's Fund Apps module already follows this lesson for sovereign funds (screening, IC memo, monitoring, board and LP reports; see `apps/web/src/lib/modules.ts`). The new Sovereign OS Packs apply it to four more domains.
- **The six-workflow pack as the unit.** Each pack names its workflows plainly and says, for each one, what it reads, what it checks, who decides and what it writes to the Ledger.
- **One platform beneath every pack.** In TIGERIS, that platform is the kernel plus the six-layer sovereignty stack. Unlike a marketing claim, it is checked live on the Sovereignty screen.
- **A human leads every determination.** This matches TIGERIS rule 4: no external action executes, and recommendations need a named human decision.

## 3. Where TIGERIS is different, and should say so

| | A vertical workflow OS (as described on their pages) | TIGERIS |
| --- | --- | --- |
| Unit of value | Throughput of an operational workflow (a permit, a claim, a close) | A **governed decision** at institutional scale: perception through capital allocation to execution and learning (Doctrine 01) |
| Sovereignty | A deployment option ("sovereign-grade" security) | **The product's definition**: six layers (compute, data, models, keys, decisions, people), each checked live, with planned items shown as planned |
| Models | Swap to the best model per task | **No model is the source of truth.** Numbers come only from deterministic engines and imported facts; model text is verified against evidence or marked unverified. Foreign models are off by default and gated by classification. |
| Scope | One institution's back office | **Across the machinery of economic decision making** (Doctrine 02): a fund, a ministry, a central bank and a regulator coordinating on one shock, which is coordination debt (L3) |
| Proof | Attestations in a trust centre | A hash-chained Ledger, lineage on every figure, and a Sovereign Capability Index computed from the institution's own records |
| Outcome | Faster, more accurate operations | **Operational, not informational** intelligence (Doctrine 03): the share of intelligence that reached a named decision and an owner is measured, not claimed |

**Positioning line for TIGERIS.** *Infrastructure creates capability; operating architecture creates advantage* (Doctrine 04). A vertical OS digitises one institution's workflows. TIGERIS is the sovereign operating architecture in which those workflows become national decisions.

## 4. How it is built into the project

- **Doctrine page** (`/doctrine`): the four doctrines, each with what it means in the OS and the screen that proves it.
- **Sovereign Intelligence page** (`/sovereign`): the definition, the six-layer test, sovereign versus dependent compared side by side, and the Sovereign Capability Index.
- **Sovereign Capability Index**: `GET /sovereignty/index`, which computes control, convergence and operationalisation from the institution's own records. It is labelled MODELLED, and its weights are placeholders pending sign-off.
- **Boardroom**: a sovereign position panel and a doctrine strip. **Every module**: a strip showing what is sovereign right now.
- **Sovereign OS Packs** (`/packs`): Finance, Health, Insurance and Government, six workflows each. Each workflow states what it reads, what it checks, who decides, which layer protects it and its build status. Each pack has a worked queue of synthetic items scored by deterministic rules, and any item can be opened as a case.

## 5. Caveats

- Their pages are marketing pages, and the security and compliance claims were not independently verified.
- The workflow lists are paraphrased from 11 Nov 2026 and may change.
- The names of their products and platform belong to them and are used here only to identify the source.
