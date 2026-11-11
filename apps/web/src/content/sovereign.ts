/**
 * The sovereign idea, in one place: the definition, the six-layer test, sovereign versus dependent, and the
 * four doctrines with what each means in the OS and the screen that proves it. Doctrine text is the client's,
 * verbatim. Arabic is a draft for review (marked as such on screen).
 */

export interface Doctrine { n: string; text: string; ar: string; short: string; means: string; proof: { label: string; href: string }[] }

export const DOCTRINES: Doctrine[] = [
  {
    n: "01",
    text: "Intelligence becomes sovereign capability when perception, reasoning, capital allocation, governance, execution, and learning converge into one continuously evolving operating architecture.",
    ar: "يصبح الذكاء قدرةً سيادية حين تلتقي الإدراك والاستدلال وتخصيص رأس المال والحوكمة والتنفيذ والتعلّم في بنية تشغيلية واحدة تتطوّر باستمرار.",
    short: "Convergence",
    means: "TIGERIS runs all six functions on one record: signals (perception), scenarios and briefs (reasoning), envelopes and packages (capital allocation), approvals (governance), owners and hand-offs (execution), precedents and feedback (learning). The Sovereign Capability Index counts which of the six are live for this institution.",
    proof: [{ label: "Sovereign Capability Index", href: "/sovereign" }, { label: "Operating loop", href: "/boardroom" }],
  },
  {
    n: "02",
    text: "The future belongs not to nations with the most AI models, but to those capable of institutionalizing intelligence across the entire machinery of economic decision making.",
    ar: "لا يكون المستقبل للدول التي تملك أكبر عدد من نماذج الذكاء الاصطناعي، بل لتلك القادرة على مأسسة الذكاء عبر منظومة صنع القرار الاقتصادي بأكملها.",
    short: "Institutionalised, not accumulated",
    means: "No model is the source of truth here. Models are allowed per classification and can be switched off; what persists is the institution's own evidence, rules, authority matrix and memory, shared across the fund, ministries, central bank and regulators it coordinates with.",
    proof: [{ label: "Coordination across institutions", href: "/boardroom" }, { label: "Institutional memory", href: "/memory" }],
  },
  {
    n: "03",
    text: "Sovereign advantage compounds when intelligence becomes operational rather than informational.",
    ar: "تتراكم الميزة السيادية حين يصبح الذكاء تشغيلياً لا معلوماتياً.",
    short: "Operational, not informational",
    means: "A brief that nobody acts on is information. TIGERIS turns it into a decision package with the required authority, a named approver, owners with due times and a Ledger entry, and measures the share of intelligence that reached that point.",
    proof: [{ label: "Governor question to owners", href: "/governor" }, { label: "Decisions and hand-offs", href: "/decisions" }],
  },
  {
    n: "04",
    text: "AI infrastructure creates capability. Operating architecture creates national advantage.",
    ar: "البنية التحتية للذكاء الاصطناعي تصنع القدرة، أمّا البنية التشغيلية فتصنع الميزة الوطنية.",
    short: "Architecture over infrastructure",
    means: "Compute and models are layers one and three of the sovereignty stack; they are necessary, not sufficient. Advantage comes from the layers above: who holds the keys, who decides, who oversees, and the loop that turns each decision into the next one's evidence.",
    proof: [{ label: "Sovereignty stack, checked live", href: "/sovereignty" }, { label: "Architecture", href: "/architecture" }],
  },
];

/** The definition the OS uses. */
export const SOVEREIGN_DEFINITION = {
  title: "Sovereign intelligence",
  line: "Intelligence is sovereign when the institution can perceive, reason, decide and act on its own terms: on machines it controls, over data that stays in its jurisdiction, with models it chooses and can switch off, under keys it holds, by people it names, with a record nobody can quietly change.",
  not: "It is not owning the most AI models, nor hosting them locally. A local model that nobody governs, or a dashboard nobody acts on, is infrastructure, not sovereign capability.",
  test: "The test is simple: if any one supplier, network link or foreign jurisdiction were withdrawn tomorrow, could the institution still see, decide and act, and prove how it did?",
};

/** The six layers and the question each must answer "yes" to; sovereign versus dependent, side by side. */
export const LAYER_TEST: { key: string; name: string; test: string; sovereign: string; dependent: string }[] = [
  { key: "compute", name: "Compute and hosting", test: "Could it run tomorrow with the internet cable cut?", sovereign: "Runs in the institution's own deployment or in-country cloud; works fully offline; external data arrives as signed packages.", dependent: "Runs in a provider's region abroad; stops when the link or the contract stops." },
  { key: "data", name: "Data", test: "Does every record stay in the jurisdiction, isolated and traceable?", sovereign: "Data stays in the stated jurisdiction, each institution isolated by forced row-level security, every figure with its class and lineage.", dependent: "Copies in a vendor's store, pooled with other clients, figures without provenance." },
  { key: "models", name: "Models", test: "Can the institution choose, verify and switch off every model?", sovereign: "A local open-weight model with checked weights; foreign models off unless an administrator allows them, per classification; no model is the source of truth.", dependent: "One provider's API decides; prices, limits and behaviour change without notice; model text is taken as fact." },
  { key: "keys", name: "Keys and cryptography", test: "Does the institution hold the keys that protect and prove its data?", sovereign: "Signed data packages, a hash-chained Ledger, keys held by the institution (HSM in the pilot), a post-quantum inventory.", dependent: "The vendor holds the keys; the audit trail can be edited by whoever runs the system." },
  { key: "applications", name: "Applications and decisions", test: "Does every decision have a named human and a tested rule?", sovereign: "Policy as code, tested before use; an authority matrix; no external action executes; every decision names a person.", dependent: "Automations act on their own; rules live in someone's head or a vendor's black box." },
  { key: "people", name: "People and oversight", test: "Is every action attributable and is no one able to approve their own work?", sovereign: "Seven roles with separation of duties enforced on the server, second factor before any data, every human action on the audit chain.", dependent: "Shared accounts, administrators who can do anything, no record of who saw what." },
];

/** Which doctrine a screen leans on, for the strip on the Boardroom and the Command Centre footers. */
export const DOCTRINE_FOR: Record<string, string> = { boardroom: "03", "supply-chain": "01", "real-estate": "04", manufacturing: "01", infrastructure: "04", capital: "02", energy: "03", banking: "02", insurance: "03" };
export const doctrine = (n: string) => DOCTRINES.find((d) => d.n === n)!;
