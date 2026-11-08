import type { FactDraft, ParseResult } from "./types";

/** EIA daily Brent windows: one sourced fact per trading day (TR-039). */
export function parseBrentDaily(bytes: Buffer): ParseResult {
  const j = JSON.parse(bytes.toString("utf8")) as { series: string; unit: string; points: Array<{ date: string; value: number }> };
  const facts: FactDraft[] = j.points.map((p, i) => ({
    subject: "brent", subjectLabel: "Brent crude (Europe spot FOB)", predicate: "brent_spot_usd", predicateLabel: "Brent spot price",
    valueNum: p.value, unit: "USD/bbl", period: p.date, claimClass: "sourced", locator: `points[${i}]`, method: "json_path",
  }));
  return { facts };
}

/** Disruption episodes: analyst estimates, kept as assumptions with their stated basis. */
export function parseEpisodes(bytes: Buffer): ParseResult {
  const j = JSON.parse(bytes.toString("utf8")) as { episodes: Array<{ key: string; name: string; date: string; lossMbd: number; worldMbd: number; basis: string }> };
  const facts: FactDraft[] = [];
  j.episodes.forEach((e, i) => {
    const base = { subject: e.key, subjectLabel: e.name, period: e.date, claimClass: "assumed" as const, excerpt: e.basis, method: "json_path" };
    facts.push({ ...base, predicate: "supply_loss_mbd", predicateLabel: "Estimated supply lost at the start", valueNum: e.lossMbd, unit: "mb/d", locator: `episodes[${i}].lossMbd` });
    facts.push({ ...base, predicate: "world_demand_mbd", predicateLabel: "World oil demand at the time", valueNum: e.worldMbd, unit: "mb/d", locator: `episodes[${i}].worldMbd` });
    facts.push({ ...base, predicate: "event_date", predicateLabel: "Event date", valueText: e.date, locator: `episodes[${i}].date` });
  });
  return { facts };
}
