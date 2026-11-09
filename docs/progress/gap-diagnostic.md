# Sovereign gap diagnostic (9 Nov 2026) · commercial model, steps 1 to 3

## Working now
- **Gap Diagnostic module** (`/diagnostic`, second in the sidebar): seven gaps, two questions each, every answer
  scored 0 to 4 with its evidence level (self-reported, interviews, measured). The report shows readiness, governance
  confidence and value at stake as a planning range; a score and severity per gap; the three priorities; the
  recommended first mandate pilot; and before and after TIGERIS per gap. Tabs: Report, New assessment (with a live
  preview), History, Method.
- **Deterministic method** (`packages/shared/src/diagnostic.ts`, `gap-diagnostic.v1`): no model involved. Value at
  stake per gap is maxBp × (4 − score) ÷ 4, low end 40% of high. One basis point is 0.01% of assets a year, so
  $100 million on $1 trillion. The per-gap maxBp figures are planning assumptions, marked "Assumed" wherever the range
  is shown, with their basis.
- **Saved and audited**: assessments are stored per institution under forced row-level security (migrations 0011,
  0012), scored on the server (anything the client sends as a result is ignored), hashed, and written to the audit
  chain (`diagnostic.assessed`). The Markdown report export is audited too (`diagnostic.report_exported`). Executives,
  analysts and domain experts can run one (`diagnostic.run`); everyone can read.
- **Briefing question** on every assessment: "What strategic priority, decision challenge or intelligence gap should
  the briefing explore?"
- **Command Centre panel** "Sovereign readiness": value realization potential, national capability readiness and
  governance confidence from the latest diagnostic, each linking to it.
- **Public readiness check** (`/readiness`, no sign-in): the same 14 questions and report, computed in the visitor's
  browser; nothing is sent or stored. It ends with a downloadable report and "Request an institutional briefing".
- **Trust and security page** (`/trust`, no sign-in): deployment options, outbound-off, data sovereignty, model
  independence, access and audit, each marked "In this build"; SOC 2 Type II, ISO 27001 and a penetration test marked
  "Planned", because they are not held.
- Each fictional institution starts with one sample assessment, labelled synthetic.

## Where the call and the shared sites landed
| From | Point | In the prototype |
| --- | --- | --- |
| Call | Diagnose before proposing a solution ("like a car diagnostic") | Gap Diagnostic report |
| Call | Coordination debt, fragmentation, governance velocity, memory, capital orchestration, decision drift, value realization | The seven gaps (economic sovereignty as "sovereign control") |
| Call | Each fund differs by mandate | Per-institution assessments, briefing priority, evidence per answer |
| Call | Before and after TIGERIS, measurable | Before/after table with how each is proved |
| Call | Value at stake in money | Planning range with the basis-point arithmetic shown |
| Call | Start with a mandate, not the whole OS | Recommended first mandate pilot |
| Call | Website traction | Public readiness check and trust page |
| tigercapital.ai | Briefing question; boardroom figures (value realization potential, national capability readiness, governance confidence) | Briefing priority field; Command Centre panel |
| brain.co | Atlas security and control: deployment options, data sovereignty, access controls, trust centre, security briefing | Trust and security page |
| v7labs.com | Documents into memory and a context graph | Already present: evidence pipeline, intelligence graph, institutional memory |
| gaia.sa | Permission-aware, cited answers in Arabic and English | Already present: Ask TIGERIS with citations, row-level security, Arabic screens |

## Honest limits
- The value range rests on planning assumptions, not the institution's data; the paid diagnostic replaces it with
  value lines built bottom-up. The report says so.
- The readiness check is self-reported and indicative.
- The trust page describes this build; certifications are planned, not held.
