import { describe, expect, it } from "vitest";
import { GAPS, QUESTION_COUNT, assess, formatUsd, reportMarkdown, validateAnswers, type DiagnosticAnswer } from "../src/diagnostic";

const all = (score: number, evidence: DiagnosticAnswer["evidence"] = "self_report"): DiagnosticAnswer[] =>
  GAPS.flatMap((g) => g.questions.map((q) => ({ questionId: q.id, score, evidence })));

describe("sovereign gap diagnostic", () => {
  it("has seven gaps with two questions each and five options per question", () => {
    expect(GAPS).toHaveLength(7);
    expect(QUESTION_COUNT).toBe(14);
    for (const g of GAPS) for (const q of g.questions) expect(q.options).toHaveLength(5);
    expect(new Set(GAPS.flatMap((g) => g.questions.map((q) => q.id))).size).toBe(14);
  });

  it("uses the corrected basis-point arithmetic: 1 bp of $1 tn is $100 m", () => {
    const r = assess(all(0), { aumUsd: 1e12 });
    const maxBp = GAPS.reduce((s, g) => s + g.maxBp, 0);
    expect(r.valueAtStake.bpHigh).toBeCloseTo(maxBp, 5);
    expect(r.valueAtStake.highUsd).toBe(Math.round(1e12 * maxBp * 1e-4));
    expect(r.valueAtStake.lowUsd).toBe(Math.round(1e12 * r.valueAtStake.bpLow * 1e-4));
    expect(formatUsd(1e12 * 1e-4)).toBe("$100 m");
  });

  it("scores the best answers as fully ready with nothing at stake", () => {
    const r = assess(all(4, "measured"), { aumUsd: 5e11 });
    expect([r.readinessPct, r.governanceConfidencePct, r.valueAtStake.highUsd, r.complete]).toEqual([100, 100, 0, true]);
    expect(r.priorities).toEqual([]);
    expect(r.recommendedPilot).toBeNull();
    expect(r.evidence).toBe("measured");
  });

  it("ranks priorities by value at stake and recommends the top gap's remedy as the pilot", () => {
    const answers = all(3).map((a) => (a.questionId.startsWith("cap.") ? { ...a, score: 0 } : a.questionId.startsWith("mem.") ? { ...a, score: 0 } : a));
    const r = assess(answers);
    expect(r.priorities[0]).toBe("capital_orchestration"); // largest maxBp at the same score
    expect(r.priorities[1]).toBe("memory");
    expect(r.recommendedPilot?.href).toBe("/scenarios");
    expect(r.gaps.find((g) => g.key === "capital_orchestration")?.severity).toBe("critical");
  });

  it("keeps an unanswered gap out of the score and the value, and the weakest evidence wins", () => {
    const answers = all(2).filter((a) => !a.questionId.startsWith("sov.")).map((a, i) => ({ ...a, evidence: i === 0 ? "self_report" : "measured" as const }));
    const r = assess(answers, { aumUsd: null });
    const sov = r.gaps.find((g) => g.key === "sovereign_control")!;
    expect([sov.score, sov.bpHigh, r.complete, r.answered]).toEqual([null, 0, false, 12]);
    expect(r.valueAtStake.lowUsd).toBeNull();
    expect(r.evidence).toBe("self_report");
  });

  it("rejects unknown questions, duplicate answers, bad scores and bad evidence", () => {
    expect(validateAnswers([{ questionId: "frag.view", score: 5, evidence: "self_report" }, { questionId: "frag.view", score: 2, evidence: "guess" as never }, { questionId: "nope", score: 1, evidence: "measured" }])).toHaveLength(4);
    expect(validateAnswers(all(2))).toEqual([]);
  });

  it("writes a report that states the evidence level, the assumptions and that it decides nothing", () => {
    const md = reportMarkdown(assess(all(1), { aumUsd: 1e12 }), { title: "Gap diagnostic", subject: "A fund", date: "2026-11-09", dataMode: "Synthetic" });
    expect(md).toContain("self-reported");
    expect(md).toContain("planning assumption");
    expect(md).toContain("decides nothing");
    expect(md).toContain("$1 tn");
  });
});
