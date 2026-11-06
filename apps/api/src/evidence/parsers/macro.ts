import { COUNTRY, type FactDraft, type ParseResult } from "./types";

const WB: Record<string, { predicate: string; label: string; unit: string }> = {
  "NY.GDP.MKTP.CD": { predicate: "gdp_current_usd", label: "GDP, current US$", unit: "USD" },
  "SP.POP.TOTL": { predicate: "population", label: "Population", unit: "people" },
  "FP.CPI.TOTL.ZG": { predicate: "inflation_cpi_pct", label: "Consumer price inflation", unit: "% per year" },
  "FI.RES.TOTL.CD": { predicate: "reserves_usd", label: "Total reserves incl. gold", unit: "USD" },
  "TM.VAL.FOOD.ZS.UN": { predicate: "food_imports_pct_merch", label: "Food imports, share of merchandise imports", unit: "%" },
  "TX.VAL.FUEL.ZS.UN": { predicate: "fuel_exports_pct_merch", label: "Fuel exports, share of merchandise exports", unit: "%" },
  "TM.VAL.MRCH.CD.WT": { predicate: "merch_imports_usd", label: "Merchandise imports", unit: "USD" },
};

export function parseWorldBank(bytes: Buffer): ParseResult {
  const json = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(json) || !Array.isArray(json[1])) throw new Error("Unexpected World Bank response shape");
  const facts: FactDraft[] = [];
  json[1].forEach((r: any, i: number) => {
    const def = WB[r.indicator?.id];
    if (!def || r.value === null || r.value === undefined) return;
    facts.push({
      subject: r.countryiso3code, subjectLabel: COUNTRY[r.countryiso3code] ?? r.country?.value, predicate: def.predicate, predicateLabel: def.label,
      valueNum: Number(r.value), unit: def.unit, period: String(r.date), claimClass: "observed", locator: `$[1][${i}]`, method: "parser.worldbank.v1",
    });
  });
  return { facts };
}

const IMF: Record<string, { predicate: string; label: string; unit: string }> = {
  NGDP_RPCH: { predicate: "real_gdp_growth_pct", label: "Real GDP growth", unit: "% per year" },
  PCPIPCH: { predicate: "inflation_cpi_pct", label: "Consumer price inflation", unit: "% per year" },
  GGXCNL_NGDP: { predicate: "fiscal_balance_pct_gdp", label: "General government net lending/borrowing", unit: "% of GDP" },
  BCA_NGDPD: { predicate: "current_account_pct_gdp", label: "Current account balance", unit: "% of GDP" },
};

/** IMF WEO publishes projections alongside history; years from the snapshot year on are labelled projections. */
export function parseImf(bytes: Buffer, retrievedAt: Date): ParseResult {
  const json = JSON.parse(bytes.toString("utf8"));
  const def = IMF[json.indicator];
  if (!def) throw new Error("Unknown IMF indicator");
  const series = json.values?.[json.indicator] ?? {};
  const facts: FactDraft[] = [];
  const firstProjectionYear = retrievedAt.getUTCFullYear();
  for (const [iso, years] of Object.entries(series as Record<string, Record<string, number>>)) {
    for (const [year, v] of Object.entries(years)) {
      if (Number(year) < 2010) continue;
      facts.push({
        subject: iso, subjectLabel: COUNTRY[iso] ?? iso, predicate: def.predicate, predicateLabel: def.label, valueNum: Number(v), unit: def.unit,
        period: year, qualifier: Number(year) >= firstProjectionYear ? "IMF projection" : null, claimClass: "observed",
        locator: `values.${json.indicator}.${iso}.${year}`, method: "parser.imf_datamapper.v1",
      });
    }
  }
  return { facts };
}
