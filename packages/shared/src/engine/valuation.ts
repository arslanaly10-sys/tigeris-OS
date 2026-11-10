import type { Diagnosis } from "./diagnosis";
import { RUBRIC } from "../config/diagnosis-rubric";

/**
 * Value-at-stake model (brief v3 §4.1). Pure and deterministic.
 *   ceiling       = AUM × structuralInefficiency
 *   valueAtStake  = min(AUM × improvement, ceiling)      for low / base / high
 *   perGapShare_i = score_i × weight_i / Σ(score × weight)
 *   perGapValue_i = valueAtStake(base) × perGapShare_i
 *   annual        = valueAtStake / years
 *   roiMultiple   = annual(base) / licence per year      only when a licence cost is given
 */
export interface ValuationInput { aumUsd: number; structuralInefficiency: number; improvement: { low: number; base: number; high: number }; years: number; licenceUsdPerYear?: number | null }
export interface Valuation {
  ceilingUsd: number;
  valueAtStakeUsd: { low: number; base: number; high: number };
  cappedByCeiling: { low: boolean; base: boolean; high: boolean };
  annualUsd: { low: number; base: number; high: number };
  perGap: Array<{ id: number; name: string; share: number; valueUsd: number }>;
  roiMultiple: number | null;
}

export function valuation(v: ValuationInput, d: Diagnosis): Valuation {
  const ceiling = v.aumUsd * v.structuralInefficiency;
  const at = (p: number) => Math.min(v.aumUsd * p, ceiling);
  const vas = { low: at(v.improvement.low), base: at(v.improvement.base), high: at(v.improvement.high) };
  const capped = { low: v.aumUsd * v.improvement.low > ceiling, base: v.aumUsd * v.improvement.base > ceiling, high: v.aumUsd * v.improvement.high > ceiling };
  const years = Math.max(1, v.years);
  const annual = { low: vas.low / years, base: vas.base / years, high: vas.high / years };
  const scored = d.gaps.filter((g) => g.score !== null);
  const w = (id: number) => RUBRIC.find((r) => r.id === id)?.weight ?? 1;
  const denom = scored.reduce((s, g) => s + g.score! * w(g.id), 0);
  const perGap = scored.map((g) => { const share = denom ? (g.score! * w(g.id)) / denom : 0; return { id: g.id, name: g.name, share, valueUsd: vas.base * share }; });
  const roiMultiple = v.licenceUsdPerYear && v.licenceUsdPerYear > 0 ? annual.base / v.licenceUsdPerYear : null;
  return { ceilingUsd: ceiling, valueAtStakeUsd: vas, cappedByCeiling: capped, annualUsd: annual, perGap, roiMultiple };
}
