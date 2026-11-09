/**
 * Sovereign gap diagnostic (commercial model, step 1 to 3). Seven gaps, two questions each, every answer
 * scored 0 (worst) to 4 (best) with the evidence it rests on. Scoring and value at stake are deterministic
 * (CLAUDE.md rule 5): no model is involved, and every planning assumption is listed with its basis.
 */

export const DIAGNOSTIC_METHOD_VERSION = "gap-diagnostic.v1";

export const GAP_KEYS = ["fragmentation", "governance_velocity", "memory", "capital_orchestration", "decision_drift", "sovereign_control", "value_realization"] as const;
export type GapKey = (typeof GAP_KEYS)[number];

export const EVIDENCE_LEVELS = ["self_report", "interview", "measured"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  self_report: "Self-reported",
  interview: "From interviews",
  measured: "Measured",
};

export interface DiagnosticQuestion {
  id: string;
  text: string;
  /** What each score means, 0 (worst) to 4 (best). */
  options: [string, string, string, string, string];
}

export interface GapDef {
  key: GapKey;
  name: string;
  nameAr: string;
  /** One line: the question this gap answers. */
  asks: string;
  metric: string;
  before: string;
  after: string;
  proof: string;
  /** The TIGERIS capability that closes it, and where it lives in the OS. */
  remedy: { label: string; href: string };
  /**
   * Planning assumption: the most value (in basis points of assets a year) closing this gap fully could
   * realise. Not measured; the paid diagnostic replaces it with bottom-up value lines.
   */
  maxBp: number;
  questions: [DiagnosticQuestion, DiagnosticQuestion];
}

export const GAPS: GapDef[] = [
  {
    key: "fragmentation", name: "Institutional fragmentation", nameAr: "تجزؤ المؤسسة",
    asks: "How many hand-offs stand between a signal and a decision?",
    metric: "Hand-offs and systems touched per decision",
    before: "6 to 10 hand-offs and 4 or more systems per decision",
    after: "One shared case; 2 hand-offs or fewer",
    proof: "Case history and audit trail",
    remedy: { label: "Intelligence cases and the shared graph", href: "/cases" },
    maxBp: 1.0,
    questions: [
      { id: "frag.handoffs", text: "When a market or geopolitical signal arrives, how many teams handle it before a decision-maker sees a recommendation?", options: ["More than 8 teams, by email and meetings", "6 to 8 teams", "4 or 5 teams", "2 or 3 teams with a shared tracker", "One shared case that every team works in"] },
      { id: "frag.view", text: "Can leadership see one picture of an exposure (holdings, suppliers, corridors) without commissioning a study?", options: ["No, each department keeps its own view", "Only through a consultant study", "Partly, assembled by hand each quarter", "Mostly, from a central data team on request", "Yes, live and linked to the evidence"] },
    ],
  },
  {
    key: "governance_velocity", name: "Governance velocity", nameAr: "سرعة الحوكمة",
    asks: "Does governance keep pace with the signals?",
    metric: "Days from signal to approved response",
    before: "Weeks to months from signal to approved response",
    after: "Hours to days; policy checked automatically",
    proof: "Timestamps from signal to decision",
    remedy: { label: "Policy as code and named decisions", href: "/decisions" },
    maxBp: 0.7,
    questions: [
      { id: "gov.speed", text: "How long does it typically take from a material signal to an approved response?", options: ["Months", "Several weeks", "One to two weeks", "A few days", "Hours to a day"] },
      { id: "gov.rules", text: "How are approval rules (who may decide, how many approvals) applied?", options: ["Informally, by whoever is senior", "Written policy, checked by hand afterwards", "Written policy, checked by hand before approval", "Partly enforced by systems", "Enforced as tested rules on every decision, with an audit trail"] },
    ],
  },
  {
    key: "memory", name: "Institutional memory", nameAr: "الذاكرة المؤسسية",
    asks: "Does knowledge stay when people leave?",
    metric: "Share of past decisions findable with their rationale",
    before: "Rationale lives in inboxes and people's heads",
    after: "Every decision and precedent searchable by meaning",
    proof: "Retrieval test on past decisions",
    remedy: { label: "Institutional memory", href: "/memory" },
    maxBp: 0.4,
    questions: [
      { id: "mem.find", text: "If you needed the rationale behind a major decision from three years ago, how would you find it?", options: ["We probably could not", "Ask the people involved, if they are still here", "Search shared drives and email", "A document archive, by keyword", "Searchable records with rationale, evidence and outcome"] },
      { id: "mem.leavers", text: "When a senior specialist leaves, how much of their working knowledge is kept?", options: ["Almost none", "A handover note", "Handover plus their files", "Structured handover into a shared repository", "Their cases, decisions and precedents are already in the institution's memory"] },
    ],
  },
  {
    key: "capital_orchestration", name: "Capital orchestration", nameAr: "تنسيق رأس المال",
    asks: "Is capital aligned with the national mandate?",
    metric: "Share of portfolio value mapped to a stated mandate goal",
    before: "Mandate alignment reviewed yearly, by hand",
    after: "Holdings mapped to mandate goals, exposure seen live",
    proof: "Share of portfolio mapped; time to answer an exposure question",
    remedy: { label: "Scenarios against holdings and mandates", href: "/scenarios" },
    maxBp: 1.2,
    questions: [
      { id: "cap.mapped", text: "What share of the portfolio's value is explicitly mapped to a stated mandate or national goal?", options: ["Under 25%", "25 to 50%", "50 to 75%", "75 to 90%", "Over 90%, tracked continuously"] },
      { id: "cap.exposure", text: "How quickly can you answer: which holdings are exposed if a key trade route closes for 30 days?", options: ["We cannot answer it reliably", "Months, through a study", "Weeks, by an internal team", "Days, from existing models", "Hours, with every number traced to its source"] },
    ],
  },
  {
    key: "decision_drift", name: "Decision drift", nameAr: "انحراف القرار",
    asks: "Does intent survive execution?",
    metric: "Share of decisions with a recorded rationale and a drift check",
    before: "Decisions not revisited against outcomes",
    after: "Every decision recorded with a drift check and replay",
    proof: "Drift reports and replay results",
    remedy: { label: "Decision replay and drift checks", href: "/decisions" },
    maxBp: 0.7,
    questions: [
      { id: "drift.record", text: "When a major decision is taken, what is recorded?", options: ["The outcome only", "Minutes of the meeting", "Minutes and the papers presented", "A decision record with rationale and owner", "A frozen record of evidence, options, policy and approvers"] },
      { id: "drift.check", text: "Are past decisions checked against what has changed since?", options: ["Never", "Only after something goes wrong", "In an annual review", "For major decisions, on a schedule", "Automatically, when the facts behind them change"] },
    ],
  },
  {
    key: "sovereign_control", name: "Sovereign control", nameAr: "السيطرة السيادية",
    asks: "Who controls the data, models and keys?",
    metric: "Share of critical intelligence on foreign-controlled systems",
    before: "Intelligence on foreign platforms, with foreign models",
    after: "In-country deployment, own keys, foreign models off by default",
    proof: "Sovereignty checks and security review",
    remedy: { label: "Sovereignty stack", href: "/sovereignty" },
    maxBp: 0.3,
    questions: [
      { id: "sov.hosting", text: "Where do your critical analysis tools and data run?", options: ["Mostly foreign cloud services we do not control", "Foreign services with some local copies", "A mix, without a clear rule", "Mostly in-country, a few foreign dependencies", "In-country or on-premises, with an exit plan for each vendor"] },
      { id: "sov.models", text: "Who decides which AI models may see sensitive content?", options: ["No one; staff use public tools", "A general IT policy", "A list of approved tools", "Approved models per data class", "A gateway that enforces model, classification and outbound rules, and records refusals"] },
    ],
  },
  {
    key: "value_realization", name: "Value realization", nameAr: "تحقيق القيمة",
    asks: "Does AI spend turn into measured value?",
    metric: "Share of AI initiatives in production with measured value",
    before: "Most AI pilots never reach measured value",
    after: "Each mandate tracked against its value case",
    proof: "Value ledger signed off by finance",
    remedy: { label: "Reports and the value case per mandate", href: "/reports" },
    maxBp: 0.7,
    questions: [
      { id: "val.production", text: "Of your AI initiatives in the last two years, how many reached production with measured value?", options: ["None that we can show", "Under 10%", "10 to 25%", "25 to 50%", "Over 50%, each with a signed value case"] },
      { id: "val.tracking", text: "How is the value of AI and data initiatives tracked?", options: ["It is not", "Anecdotes in board papers", "Activity metrics (users, pilots)", "Outcome metrics for some initiatives", "A value ledger per initiative, reviewed by finance"] },
    ],
  },
];

export const QUESTION_COUNT = GAPS.reduce((n, g) => n + g.questions.length, 0);

/** Planning assumptions behind the value-at-stake range, shown wherever the range is shown (rule 7). */
export const VALUE_ASSUMPTIONS = [
  { key: "max_bp", label: "Most value closing each gap could realise", value: `${GAPS.reduce((s, g) => s + g.maxBp, 0).toFixed(1)} basis points a year across all seven gaps`, basis: "TIGERIS planning assumption (per gap: " + GAPS.map((g) => `${g.name.toLowerCase()} ${g.maxBp}`).join(", ") + "). Not measured: the paid diagnostic replaces it with value lines built from the institution's own data." },
  { key: "low_share", label: "Low end of the range", value: "40% of the high end", basis: "TIGERIS planning assumption, to show uncertainty rather than a point estimate." },
  { key: "bp", label: "One basis point", value: "0.01% of assets a year (on $1 trillion, $100 million)", basis: "Definition." },
] as const;
export const LOW_SHARE = 0.4;

export interface DiagnosticAnswer { questionId: string; score: number; evidence: EvidenceLevel }

export type Severity = "critical" | "major" | "moderate" | "minor";
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", major: "Major", moderate: "Moderate", minor: "Minor" };

export interface GapResult {
  key: GapKey;
  name: string;
  score: number | null;
  answered: number;
  severity: Severity | null;
  /** The weakest evidence behind the score: a score is only as strong as its least-evidenced answer. */
  evidence: EvidenceLevel | null;
  bpLow: number;
  bpHigh: number;
}

export interface DiagnosticResult {
  method: string;
  complete: boolean;
  answered: number;
  questions: number;
  gaps: GapResult[];
  /** Mean score across answered gaps, as a percentage of the best possible (0 to 100). */
  readinessPct: number | null;
  /** Mean of governance velocity, decision drift and sovereign control, as a percentage. */
  governanceConfidencePct: number | null;
  valueAtStake: { aumUsd: number | null; bpLow: number; bpHigh: number; lowUsd: number | null; highUsd: number | null };
  /** Up to three gaps where closing the gap is worth the most, worst first. */
  priorities: GapKey[];
  /** The mandate pilot the report recommends: the top priority's remedy. */
  recommendedPilot: { gap: GapKey; label: string; href: string } | null;
  evidence: EvidenceLevel | null;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const severityOf = (score: number): Severity => (score < 1.5 ? "critical" : score < 2.5 ? "major" : score < 3.5 ? "moderate" : "minor");
const weakest = (levels: EvidenceLevel[]): EvidenceLevel | null =>
  levels.length ? EVIDENCE_LEVELS[Math.min(...levels.map((l) => EVIDENCE_LEVELS.indexOf(l)))]! : null;

/** Validates one answer set: known questions, integer scores 0 to 4, known evidence levels, no duplicates. */
export function validateAnswers(answers: DiagnosticAnswer[]): string[] {
  const ids = new Set(GAPS.flatMap((g) => g.questions.map((q) => q.id)));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const a of answers) {
    if (!ids.has(a.questionId)) errors.push(`Unknown question ${a.questionId}`);
    if (seen.has(a.questionId)) errors.push(`Question ${a.questionId} answered twice`);
    seen.add(a.questionId);
    if (!Number.isInteger(a.score) || a.score < 0 || a.score > 4) errors.push(`Score for ${a.questionId} must be a whole number from 0 to 4`);
    if (!(EVIDENCE_LEVELS as readonly string[]).includes(a.evidence)) errors.push(`Unknown evidence level for ${a.questionId}`);
  }
  return errors;
}

/**
 * Scores an answer set. A gap's score is the mean of its answered questions; its value at stake is
 * maxBp × (4 − score) / 4, with the low end at LOW_SHARE of that. Unanswered gaps carry no score and no value.
 */
export function assess(answers: DiagnosticAnswer[], opts: { aumUsd?: number | null } = {}): DiagnosticResult {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const gaps: GapResult[] = GAPS.map((g) => {
    const got = g.questions.map((q) => byId.get(q.id)).filter((a): a is DiagnosticAnswer => !!a);
    const score = got.length ? got.reduce((s, a) => s + a.score, 0) / got.length : null;
    const bpHigh = score === null ? 0 : g.maxBp * (4 - score) / 4;
    return { key: g.key, name: g.name, score: score === null ? null : round(score), answered: got.length, severity: score === null ? null : severityOf(score), evidence: weakest(got.map((a) => a.evidence)), bpLow: round(bpHigh * LOW_SHARE, 2), bpHigh: round(bpHigh, 2) };
  });
  const scored = gaps.filter((g) => g.score !== null);
  const pct = (list: GapResult[]) => (list.length ? Math.round((list.reduce((s, g) => s + g.score!, 0) / list.length / 4) * 100) : null);
  const bpLow = round(gaps.reduce((s, g) => s + g.bpLow, 0), 2);
  const bpHigh = round(gaps.reduce((s, g) => s + g.bpHigh, 0), 2);
  const aum = opts.aumUsd && opts.aumUsd > 0 ? opts.aumUsd : null;
  const priorities = [...scored].filter((g) => g.bpHigh > 0).sort((a, b) => b.bpHigh - a.bpHigh || a.score! - b.score!).slice(0, 3).map((g) => g.key);
  const top = priorities[0] ? GAPS.find((g) => g.key === priorities[0])! : null;
  const answered = gaps.reduce((s, g) => s + g.answered, 0);
  return {
    method: DIAGNOSTIC_METHOD_VERSION,
    complete: answered === QUESTION_COUNT,
    answered,
    questions: QUESTION_COUNT,
    gaps,
    readinessPct: pct(scored),
    governanceConfidencePct: pct(scored.filter((g) => ["governance_velocity", "decision_drift", "sovereign_control"].includes(g.key))),
    valueAtStake: { aumUsd: aum, bpLow, bpHigh, lowUsd: aum === null ? null : Math.round(aum * bpLow * 1e-4), highUsd: aum === null ? null : Math.round(aum * bpHigh * 1e-4) },
    priorities,
    recommendedPilot: top ? { gap: top.key, label: top.remedy.label, href: top.remedy.href } : null,
    evidence: weakest(answers.map((a) => a.evidence)),
  };
}

/** Money for reports: $1.2 tn, $350 bn, $42 m, $900 k. */
export function formatUsd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `$${round(n / 1e12, 2)} tn`;
  if (a >= 1e9) return `$${round(n / 1e9, 1)} bn`;
  if (a >= 1e6) return `$${round(n / 1e6, 0)} m`;
  if (a >= 1e3) return `$${round(n / 1e3, 0)} k`;
  return `$${Math.round(n)}`;
}

/** A plain-text report, the same for the module's export and the public check's download. */
export function reportMarkdown(r: DiagnosticResult, meta: { title: string; subject: string; date: string; dataMode: string }): string {
  const name = (k: GapKey) => GAPS.find((g) => g.key === k)!.name;
  const lines = [
    `# ${meta.title}`,
    "",
    `${meta.subject} · ${meta.date} · ${meta.dataMode} · method ${r.method}`,
    "",
    `Readiness ${r.readinessPct ?? "–"}% · governance confidence ${r.governanceConfidencePct ?? "–"}% · ${r.answered} of ${r.questions} questions answered · evidence: ${r.evidence ? EVIDENCE_LABEL[r.evidence].toLowerCase() : "none"}.`,
    "",
    "## Value at stake (planning range)",
    "",
    r.valueAtStake.aumUsd
      ? `${formatUsd(r.valueAtStake.lowUsd!)} to ${formatUsd(r.valueAtStake.highUsd!)} a year: ${r.valueAtStake.bpLow} to ${r.valueAtStake.bpHigh} basis points of ${formatUsd(r.valueAtStake.aumUsd)}.`
      : `${r.valueAtStake.bpLow} to ${r.valueAtStake.bpHigh} basis points of assets a year (no asset figure given).`,
    "",
    "Assumptions: " + VALUE_ASSUMPTIONS.map((a) => `${a.label}: ${a.value} (${a.basis})`).join(" "),
    "",
    "## Gaps",
    "",
    "| Gap | Score (0 to 4) | Severity | Evidence | Value at stake (bp a year) | Today | After TIGERIS |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...r.gaps.map((g) => {
      const d = GAPS.find((x) => x.key === g.key)!;
      return `| ${g.name} | ${g.score ?? "–"} | ${g.severity ? SEVERITY_LABEL[g.severity] : "not assessed"} | ${g.evidence ? EVIDENCE_LABEL[g.evidence] : "–"} | ${g.bpLow} to ${g.bpHigh} | ${d.before} | ${d.after} |`;
    }),
    "",
    "## Priorities",
    "",
    ...(r.priorities.length ? r.priorities.map((k, i) => `${i + 1}. ${name(k)}: ${GAPS.find((g) => g.key === k)!.asks}`) : ["None scored yet."]),
    "",
    r.recommendedPilot ? `Recommended first mandate pilot: ${name(r.recommendedPilot.gap)}, through ${r.recommendedPilot.label.toLowerCase()}.` : "",
    "",
    "This is an indicative diagnostic. Scores rest on the evidence level shown; the paid diagnostic adds interviews and measured samples, and replaces the planning range with value lines from the institution's own data. It supports a human judgement and decides nothing.",
  ];
  return lines.join("\n");
}
