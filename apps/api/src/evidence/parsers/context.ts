import type { FactDraft, ParseResult } from "./types";

/** Curated reference: numeric attributes become ILLUSTRATIVE facts so every capacity shown has lineage. */
export function parseReference(bytes: Buffer): ParseResult {
  const ref = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(ref.entities) || !Array.isArray(ref.relationships)) throw new Error("Unexpected reference structure");
  const facts: FactDraft[] = [];
  ref.entities.forEach((e: any, i: number) => {
    for (const [k, v] of Object.entries(e.attrs ?? {})) {
      if (typeof v !== "number") continue;
      const unit = k.endsWith("_kbd") ? "thousand b/d" : k.endsWith("_mbd") ? "million b/d" : null;
      facts.push({ subject: e.key, subjectLabel: e.name, predicate: k, predicateLabel: k.includes("capacity") ? "Approximate capacity" : k.replace(/_/g, " "), valueNum: v, unit, claimClass: "illustrative", qualifier: "Curated approximation", locator: `entities[${i}].attrs.${k}`, method: "parser.reference.v1" });
    }
  });
  return { facts };
}

/** Synthetic institution context: holding values become SYNTHETIC facts. */
export function parseSynthetic(bytes: Buffer): ParseResult {
  const ctx = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(ctx.holdings)) throw new Error("Unexpected synthetic context structure");
  const facts: FactDraft[] = ctx.holdings.map((h: any, i: number) => ({
    subject: h.key, subjectLabel: h.name, predicate: "holding_value_usd", predicateLabel: "Holding value", valueNum: h.valueUsdM * 1e6, unit: "USD",
    claimClass: "synthetic", locator: `holdings[${i}].valueUsdM`, method: "parser.synthetic_context.v1",
  }));
  return { facts };
}
