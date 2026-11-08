import type { Tx } from "../db";
import type { BriefContent } from "./brief-pdf";

/**
 * Export redaction (FR-46, Q100). The active policy names, per audience, what is removed. Redaction
 * works on the stored brief, never on the source records, and counts what it removed so the audit
 * event and the PDF both say how much was withheld.
 */
export type Redaction = "holding_names" | "holding_values" | "people" | "internal_sources" | "unverified" | "raw_model_text";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function redactBrief(tx: Tx, content: BriefContent, rules: Redaction[]): Promise<{ content: BriefContent; count: number; applied: Redaction[] }> {
  if (!rules.length) return { content, count: 0, applied: [] };
  let count = 0;
  const holdings = rules.includes("holding_names") ? (await tx.query("SELECT name FROM entities WHERE type = 'holding' ORDER BY length(name) DESC")).rows.map((r) => r.name as string) : [];
  const people = rules.includes("people") ? (await tx.query("SELECT display_name FROM principals")).rows.map((r) => r.display_name as string) : [];
  const swap = (text: string) => {
    let t = text;
    for (const h of holdings) {
      const re = new RegExp(escape(h), "g");
      t = t.replace(re, () => { count++; return "[holding withheld]"; });
    }
    for (const n of people) {
      const re = new RegExp(escape(n), "g");
      t = t.replace(re, () => { count++; return "[name withheld]"; });
    }
    if (rules.includes("holding_values")) t = t.replace(/USD\s?-?[\d,.]+(\s?(million|billion|m|bn))?/g, () => { count++; return "USD [withheld]"; });
    return t;
  };
  const internalKinds = new Set(["signal", "scenario_run", "scenario_result", "option", "governance", "tool", "challenge", "relationship", "graph", "case", "recommendation", "note"]);
  const sections = content.sections.map((sec) => ({
    ...sec,
    sentences: sec.sentences
      .filter((s) => {
        if (rules.includes("unverified") && s.status === "unverified") { count++; return false; }
        return true;
      })
      .map((s) => ({
        ...s,
        text: swap(s.text),
        sources: s.sources.map((src) => {
          if (rules.includes("internal_sources") && internalKinds.has(src.kind)) { count++; return { kind: src.kind, ref: null, label: "Internal record", text: "Withheld from this version." }; }
          return { ...src, label: swap(src.label), text: swap(src.text) };
        }),
      })),
  }));
  return { content: { ...content, title: swap(content.title), generatedFor: rules.includes("people") ? "[name withheld]" : content.generatedFor, sections }, count, applied: rules };
}
