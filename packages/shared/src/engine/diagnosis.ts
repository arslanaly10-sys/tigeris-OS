import { RUBRIC, RUBRIC_VERSION, type RubricGap, type RubricMetric } from "../config/diagnosis-rubric";

/**
 * Diagnosis engine (brief v3 §3.2): pure, deterministic. Normalise each metric 0–100 (100 = biggest gap) against its
 * band, take the weighted mean of the PRESENT metrics, report confidence by share of inputs present, and never impute
 * a missing input. Composite indices follow the client's sandbox vocabulary.
 */
export type Confidence = "high" | "medium" | "low";
export interface MetricResult { id: string; label: string; value: number | null; normalised: number | null; best: number; worst: number; unit: string; benchmarkStatus: string }
export interface GapScore { id: number; key: string; name: string; score: number | null; confidence: Confidence; present: number; total: number; missing: string[]; metrics: MetricResult[] }
export interface Diagnosis { rubricVersion: string; gaps: GapScore[]; indices: { coordinationDebt: number | null; cognitiveDebt: number | null; csai: number | null }; confidence: Confidence; missing: string[] }

/** 0 at `best`, 100 at `worst`, clamped; works whichever way round the band runs. */
export function normalise(value: number, best: number, worst: number): number {
  if (best === worst) return 0;
  const t = (value - best) / (worst - best);
  return Math.min(100, Math.max(0, t * 100));
}

export function confidenceOf(present: number, total: number): Confidence {
  const share = total ? present / total : 0;
  return share >= 0.8 ? "high" : share >= 0.5 ? "medium" : "low";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreGap(g: RubricGap, inputs: Record<string, number | null | undefined>): GapScore {
  const metrics: MetricResult[] = g.metrics.map((m: RubricMetric) => {
    const v = inputs[m.id];
    const present = v !== null && v !== undefined && Number.isFinite(v);
    return { id: m.id, label: m.label, value: present ? v! : null, normalised: present ? round1(normalise(v!, m.best, m.worst)) : null, best: m.best, worst: m.worst, unit: m.unit, benchmarkStatus: m.benchmarkStatus };
  });
  const have = g.metrics.filter((m) => metrics.find((x) => x.id === m.id)!.normalised !== null);
  const wsum = have.reduce((s, m) => s + m.weight, 0);
  const score = wsum ? round1(have.reduce((s, m) => s + m.weight * metrics.find((x) => x.id === m.id)!.normalised!, 0) / wsum) : null;
  const missing = metrics.filter((x) => x.value === null).map((x) => x.id);
  return { id: g.id, key: g.key, name: g.name, score, confidence: confidenceOf(have.length, g.metrics.length), present: have.length, total: g.metrics.length, missing, metrics };
}

export function diagnose(inputs: Record<string, number | null | undefined>, rubric: RubricGap[] = RUBRIC): Diagnosis {
  const gaps = rubric.map((g) => scoreGap(g, inputs));
  const s = (id: number) => gaps.find((g) => g.id === id)?.score ?? null;
  const mean = (xs: Array<number | null>) => { const v = xs.filter((x): x is number => x !== null); return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const scored = gaps.filter((g) => g.score !== null);
  const wsum = scored.reduce((a, g) => a + rubric.find((r) => r.id === g.id)!.weight, 0);
  const csai = wsum ? round1(100 - scored.reduce((a, g) => a + rubric.find((r) => r.id === g.id)!.weight * g.score!, 0) / wsum) : null;
  const present = gaps.reduce((a, g) => a + g.present, 0), total = gaps.reduce((a, g) => a + g.total, 0);
  return {
    rubricVersion: RUBRIC_VERSION, gaps,
    indices: { coordinationDebt: s(1), cognitiveDebt: mean([s(3), s(4), s(6)]), csai },
    confidence: confidenceOf(present, total), missing: gaps.flatMap((g) => g.missing),
  };
}
