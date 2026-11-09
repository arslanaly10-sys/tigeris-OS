# Critical review, from the buyer-side founder's chair

*November 2026. Written as Tiger Capital's founder would read it: someone who has to raise on this, sell it to a sovereign
institution, and defend every line in front of a board. Frank on purpose. No pricing here; the commercial model is kept
out of the public repository.*

Sources read for this review:

- Tiger's two public sites, tigercapital.ai and tigerisos.ai, page by page. Only the public pages were read; gated pages
  (portal, data room, cap table and similar) were not opened.
- The reference sites he pointed us to: Brain Co (home, Finance, Insurance, Health, Government, Atlas), Gaia and V7 (the
  context-graph page).
- The meeting minutes of 9 November 2026.
- This prototype as it stands at the commit that adds this file.

---

## 1. The verdict in one paragraph

The prototype is now better evidence than the websites. The sites promise an *autonomous* operating system, a live signal
feed and a council of agents. The prototype shows something narrower and more believable: a governed decision layer that
runs inside the institution, keeps lineage on every number, never acts on its own, and remembers what was decided. That
is the stronger story for a sovereign buyer, and the sites should move toward it, not the other way round. What the
prototype still lacks is the *first paid use case* made obvious on screen: a fund-team workflow a buyer would pay for in
week one. The gap diagnostic and playbooks start that; the fund apps (section 6) finish it.

## 2. What a sovereign buyer will challenge on Tiger's sites

These are the lines a risk committee, a CISO or a sceptical investor will circle first.

| # | What the site says | Why it hurts | What to say instead |
|---|---|---|---|
| 1 | "The world's first autonomous AI operating system for sovereign capital intelligence" | "World's first" cannot be proved, and "autonomous" is the word a sovereign risk committee fears most. It contradicts the site's own line "autonomous intelligence does not bypass sovereign authority". | "A governed intelligence and decision layer for sovereign capital. Agents prepare; named people decide." |
| 2 | "Autonomous decision execution", "autonomous rebalancing", "autonomous execution and cross-portfolio routing" | No sovereign institution will let software move capital on its own, and saying so invites the question "who is liable?". | "Pre-approved decision envelopes: the committee sets the limits once; each decision inside them still has one named authoriser." (Built next, section 6.) |
| 3 | "$60T+ global sovereign and institutional capital", "47 fragmented systems", "zero autonomous intelligence infrastructure" | Three numbers with no source. One unsourced number makes a reader doubt every other one. | Cite the source for the capital figure or drop it. Replace "47" with "dozens of systems, in our diagnostic interviews" until there is a count to cite. |
| 4 | Agent counts: six specialists on one page, "7 agents" on the dashboard, "nine specialized agents" in the live demo | A buyer who notices three different numbers will ask which product is real. | One number everywhere. We are adopting Tiger's six (Sentinel, Macro, Resilience, Capital, Mandate, Governance) in the prototype (section 6). |
| 5 | Live-looking probabilities ("probability of disruption exceeded 28%", "council promotion threshold 0.75") with no label | They read as live outputs. If they are illustrative, a buyer who learns that later feels misled. | Label every illustrative figure on the page itself, as the prototype does ("synthetic", "illustrative"). |
| 6 | "Real-time data infrastructure for autonomous monitoring of 9,000+ companies" | That is a data-vendor claim. It needs licences, and buyers will ask which feeds. | Say which sources exist today and which need the institution's licences, as the prototype's context-layer view now does. |
| 7 | "Patent Pending" | Fine if a filing exists, but a buyer's counsel will ask for the application number. | Keep the number ready, or drop the badge until it is needed. |
| 8 | No security posture on either site | Brain Co leads with SOC 2 Type II and a trust centre. A sovereign CISO will look for this before reading anything else. | A plain trust page: where it runs, what leaves the boundary (nothing, by default), keys, audit and the certification roadmap. The prototype has one at /trust. |
| 9 | Two sites, two type systems and two tones (a fund site and a product site) | It looks like two companies. | One brand system across both, or the product site clearly as a sub-brand. |
| 10 | The public JavaScript on the product site includes the names of gated pages | Nothing confidential was exposed in the parts read, but page names on a public bundle hint at what sits behind the login. | Split the bundle so gated routes are only served after sign-in. (Details given privately, not here.) |

Fair credit: the six-stage loop (intent, propagate, challenge, resilience, authorise, remember), the 13 sovereign
scenarios, the doctrine lines and the four horizons (72 hours to 5 years) are good, specific material. They read like
someone who has sat in an investment committee. That is why they are now in the prototype.

## 3. What the reference sites teach, and what we took

| Site | The lesson | Where it is in the prototype |
|---|---|---|
| Brain Co | Sell *one application first* ("start with a first application"), then the platform. Each vertical page lists concrete workflows: deal sourcing, IC prep, portfolio monitoring, servicing, close. | Gap diagnostic → playbooks → *start a case*. Four fund apps next (section 6). |
| Brain Co Atlas | Deployment choice and security posture up front. | Sovereignty module, /trust page, laptop/VM/Docker packages. |
| Gaia | Arabic-first enterprise search and agents, on-premises. The buyer expects Arabic as a first-class language, not a translation. | Arabic on the key screens, RTL throughout. Honest note: much of the Arabic is still marked "draft" and needs a native reviewer. |
| V7 (context graph) | Two pictures sell the idea in seconds: memory is scattered; one context layer serves people and agents. | Both drawn in TIGERIS style: Institutional Memory and Architecture. Connectors are marked built or planned. |

What we deliberately did *not* take: "unlimited context", "300+ integrations", "120+ agents" and "fix it in 30 minutes".
Those are numbers we could not stand behind in a sovereign deployment.

## 4. The prototype, criticised as hard as the sites

What works:

- **Governance is the product, not a feature.** Every route is permission-guarded. Every change writes an audit event in
  the same transaction. Agents get numbers only from tools. Nothing executes externally. Foreign models are off by default.
- **Lineage on every number.** Synthetic and illustrative data are labelled where they appear.
- **It answers the meeting's first question.** The gap diagnostic gives a buyer a reason to talk in week one, and every
  priority now links to a playbook that opens a real case.
- **It runs offline**, on a laptop or a VM, with real public data (Brent history, AIS ship tracks, flight snapshots)
  imported through a signed package.

What a buyer will still poke at:

1. **No first paid workflow on screen yet.** A fund CIO wants to see *their* Monday: a deal to screen, a memo to prepare,
   a portfolio to watch, a board pack to send. → Section 6.
2. **Agent taxonomy does not match Tiger's.** The prototype has ten bounded agents named by function; the sites use six
   specialists. → Section 6.
3. **Horizons already match.** The scenario engine runs at 72 hours, 90 days, 1 year and 5 years, the same four as
   Tiger's foresight page. (An earlier draft of this review listed this as a gap; that was wrong.)
4. **"Execution envelope" is on Tiger's site but was not in the product.** → Now built: see section 6.
5. **Sign-in is simulated SSO.** Fine for a demo; production needs the institution's identity provider (SAML/OIDC) and
   hardware-key MFA.
6. **No certification yet.** The architecture is built for it (RLS, append-only audit, egress off, keys in the
   institution), but there is no SOC 2 or national cybersecurity controls assessment to point to. Say "designed for", never
   "certified".
7. **The local model is small.** Reasoning quality on long documents is limited. The design copes: numbers never come
   from the model. But a buyer will judge the prose they read.
8. **Connectors are mostly planned.** Email, calendar, chat, data rooms, Bloomberg, Aladdin, CRM, MCP/API. The context-layer
   view says so honestly; the sales story must say so too.
9. **Arabic is a draft.** It needs a native financial-Arabic review before any Gulf demo.
10. **The data is synthetic.** Labelled everywhere, but the first pilot needs one real dataset from the buyer, inside their
    boundary, to be convincing.

## 5. From the minutes: status of every point raised

| From the meeting | Status |
|---|---|
| Start with a focused mandate or widget, not the whole OS | **Done in the product:** gap diagnostic plus playbooks. One gap leads to one playbook and then one case. |
| Executive briefing, workshop and a prototype that diagnoses gaps | **Done:** the diagnostic with a downloadable report; the public /readiness page as the briefing hand-out. |
| Show governance, data and transformation capability | **Done:** Decision Authority, Sovereignty, Data & Sources, Architecture. |
| Fragmentation, governance velocity, institutional memory, capital orchestration, decision drift, value realisation | All six map to gaps in the diagnostic, and each gap has playbooks. Decision velocity gets **decision envelopes** next. |
| First phase credible for fundraising and customers | The prototype is demo-ready offline; this review lists what a buyer will still challenge. |
| Different institutions have different mandates | **Done:** institution, industry lens and job title at sign-in change what is shown. |
| Beyond sovereign entities: complex enterprises | **Next:** the four fund apps work for any investment organisation, not only sovereign ones. |
| Research Brain Co and the companies shared | **Done** for Brain Co, Gaia and V7 (section 3). Other names mentioned in the call still need correct spellings or links from Tiger. |
| Share the working prototype link | Repository is public; a hosted demo still needs a host decision (inside a Gulf region, given the sensitivity). |
| Commercial model: buyer, paid use case, pricing, licensing | **Drafted privately**, outside this repository. |
| Project ownership and sensitive deployment | The architecture assumes the institution owns its deployment, keys and data. Code ownership terms belong in the agreement, not here. |
| "10 to 12 competitors; 50–60% of the market" (said in the call) | **Unverified.** Do not put it in a deck until it is sourced. A buyer will ask. |
| 14-day refund (proposed in the call) | Recommendation: milestone acceptance instead. Sovereign procurement rarely works with refunds, and acceptance criteria protect both sides better. |

## 6. What is being built next, in order

1. **Decision envelopes. Built** (docs/progress/decision-envelopes.md). The committee pre-approves an envelope (mandate, size limit, expiry, who may authorise) under
   policy-as-code. A decision inside it needs one named authoriser; anything outside it goes back to committee. Audited end
   to end. This turns Tiger's "execution envelope" into something real and safe.
2. **Tiger's six specialists.** The ten bounded agents are regrouped under Sentinel, Macro, Resilience, Capital, Mandate
   and Governance. (The four horizons already match.)
3. **Four fund apps**, on synthetic labelled data: deal screening, IC memo preparation, portfolio monitoring, and board and
   LP reports. Each is the "first application" a buyer can pay for.

## 7. Five changes Tiger should make to its sites this week

1. Replace "autonomous" with "governed" everywhere it describes action. Keep "agents"; drop "autonomous execution".
2. Label or remove every unsourced number ($60T+, 47 systems, 9,000+ companies, the live probabilities).
3. One agent count, everywhere: six.
4. Add a trust page: deployment, data boundary, audit, keys, certification roadmap.
5. Lead with one application and the gap diagnostic, then the platform.
