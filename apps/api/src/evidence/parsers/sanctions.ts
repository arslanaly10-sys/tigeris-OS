import { parseCsv } from "@tigeris/shared";
import type { FactDraft, ParseResult } from "./types";

const imoOf = (s: string) => s.match(/IMO\s*(\d{7})/i)?.[1] ?? null;

export function parseOfacVessels(bytes: Buffer): ParseResult {
  const [header, ...rows] = parseCsv(bytes.toString("utf8")).filter((r) => r.length > 3);
  if (header?.[1] !== "sdn_name") throw new Error("Unexpected OFAC columns");
  const facts: FactDraft[] = rows.map((r, i) => {
    const imo = imoOf(r[11] ?? "");
    return {
      subject: imo ? `vessel:imo:${imo}` : `vessel:ofac:${r[0]}`, subjectLabel: r[1]!, predicate: "sanctions_designation", predicateLabel: "Sanctions designation (OFAC SDN)",
      valueText: (r[3] ?? "").replace(/^-0-$/, "") || "listed", qualifier: [r[6], r[9]].filter((x) => x && x !== "-0-").join(" · ") || null,
      claimClass: "observed", locator: `row ${i + 2}`, excerpt: imo ? `IMO ${imo}` : null, method: "parser.ofac_sdn.v1",
    };
  });
  return { facts };
}

export function parseUkShips(bytes: Buffer): ParseResult {
  const [header, ...rows] = parseCsv(bytes.toString("utf8"));
  if (!header) throw new Error("Empty UK sanctions file");
  const col = (n: string) => header.indexOf(n);
  const name = col("Name 6"), regime = col("Regime Name"), imoCol = header.findIndex((h) => /IMO/i.test(h)), id = col("Unique ID");
  if (name < 0 || regime < 0) throw new Error("Unexpected UK sanctions columns");
  const seen = new Set<string>();
  const facts: FactDraft[] = [];
  rows.forEach((r, i) => {
    const imo = imoCol >= 0 ? (r[imoCol] ?? "").replace(/\D/g, "") : "";
    const key = imo ? `vessel:imo:${imo}` : `vessel:uk:${r[id]}`;
    if (!r[name] || seen.has(key)) return;
    seen.add(key);
    facts.push({ subject: key, subjectLabel: r[name]!, predicate: "sanctions_designation", predicateLabel: "Sanctions designation (UK)", valueText: r[regime] ?? "listed", claimClass: "observed", locator: `row ${i + 2}`, excerpt: imo ? `IMO ${imo}` : null, method: "parser.uk_sanctions.v1" });
  });
  return { facts };
}
