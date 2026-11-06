import { parseCsv } from "@tigeris/shared";
import { COUNTRY, ISO2_TO_3, type FactDraft, type ParseResult } from "./types";

export function parseJodi(bytes: Buffer): ParseResult {
  const rows = parseCsv(bytes.toString("utf8")).filter((r) => r.length >= 6);
  const [header, ...data] = rows;
  if (header?.[0] !== "REF_AREA" || header[5] !== "OBS_VALUE") throw new Error("Unexpected JODI columns");
  const facts: FactDraft[] = [];
  data.forEach((r, i) => {
    const [area, period, , flow, unit, value, assessment] = r;
    const v = Number(value);
    if (!area || !Number.isFinite(v)) return;
    const iso3 = ISO2_TO_3[area] ?? area;
    facts.push({
      subject: iso3, subjectLabel: COUNTRY[area] ?? area,
      predicate: flow === "INDPROD" ? "crude_production_kbd" : "crude_exports_kbd",
      predicateLabel: flow === "INDPROD" ? "Crude oil production" : "Crude oil exports",
      valueNum: v, unit: unit === "KBD" ? "thousand b/d" : unit, period, claimClass: "observed",
      qualifier: assessment === "3" ? "JODI assessment 3: use with caution" : null,
      locator: `row ${i + 2}`, method: "parser.jodi_csv.v1",
    });
  });
  return { facts };
}

/** Pulls the specific Hormuz figures from the EIA article; every other numeric sentence is kept for review. */
export function parseEiaArticle(bytes: Buffer): ParseResult {
  const html = bytes.toString("latin1");
  const start = html.indexOf("tie-article");
  const body = start >= 0 ? html.slice(start) : html;
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|â\u0080\u0099/g, "'")
    .replace(/\s+/g, " ");
  const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter((s) => /\d/.test(s) && /(million|percent|%|b\/d)/.test(s)).slice(0, 40);
  const facts: FactDraft[] = [];
  const known: Array<{ re: RegExp; subject: string; subjectLabel: string; predicate: string; predicateLabel: string; unit: string; period: string }> = [
    { re: /oil flow through the strait averaged (\d+(?:\.\d+)?) million barrels per day/i, subject: "chokepoint:hormuz", subjectLabel: "Strait of Hormuz", predicate: "oil_transit_flow", predicateLabel: "Oil flow through the strait", unit: "million b/d", period: "2024" },
    { re: /equivalent of about (\d+)% of global petroleum liquids consumption/i, subject: "chokepoint:hormuz", subjectLabel: "Strait of Hormuz", predicate: "share_global_liquids_consumption", predicateLabel: "Share of global petroleum liquids consumption", unit: "%", period: "2024" },
    { re: /about (\d+(?:\.\d+)?) million b\/d of capacity from the Saudi and UAE pipelines could be available to bypass/i, subject: "chokepoint:hormuz", subjectLabel: "Strait of Hormuz", predicate: "bypass_capacity_available", predicateLabel: "Pipeline capacity available to bypass the strait", unit: "million b/d", period: "2024" },
    { re: /(\d+(?:\.\d+)?) million-b\/d East-West crude oil pipeline/i, subject: "pipeline:east-west", subjectLabel: "East-West crude oil pipeline (Abqaiq to Yanbu)", predicate: "pipeline_capacity", predicateLabel: "Nameplate capacity", unit: "million b/d", period: "2024" },
    { re: /This (\d+(?:\.\d+)?) million-b\/d pipeline links onshore oil fields to the Fujairah/i, subject: "pipeline:adcop", subjectLabel: "Habshan–Fujairah crude oil pipeline", predicate: "pipeline_capacity", predicateLabel: "Nameplate capacity", unit: "million b/d", period: "2024" },
    { re: /(\d+)% of the crude oil and condensate and (?:\d+)% of the liquefied natural gas that moved through the Strait of Hormuz went to Asian markets/i, subject: "chokepoint:hormuz", subjectLabel: "Strait of Hormuz", predicate: "share_crude_to_asia", predicateLabel: "Share of crude and condensate flows going to Asia", unit: "%", period: "2024" },
  ];
  const used = new Set<string>();
  for (const k of known) {
    const s = sentences.find((x) => k.re.test(x));
    const m = s?.match(k.re);
    if (!s || !m) continue;
    used.add(s);
    facts.push({ subject: k.subject, subjectLabel: k.subjectLabel, predicate: k.predicate, predicateLabel: k.predicateLabel, valueNum: Number(m[1]), unit: k.unit, period: k.period, claimClass: "sourced", locator: `sentence ${sentences.indexOf(s) + 1}`, excerpt: s.trim(), method: "parser.eia_article.v1" });
  }
  sentences.forEach((s, i) => {
    if (used.has(s)) return;
    facts.push({ subject: "chokepoint:hormuz", subjectLabel: "Strait of Hormuz", predicate: "stated_figure", predicateLabel: "Figure stated in the article", valueText: s.trim().slice(0, 400), claimClass: "sourced", reviewState: "needs_review", locator: `sentence ${i + 1}`, excerpt: s.trim(), method: "parser.eia_article.v1" });
  });
  return { facts, text };
}
