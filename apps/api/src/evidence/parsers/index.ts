import { parseImf, parseWorldBank } from "./macro";
import { parseEiaArticle, parseJodi } from "./energy";
import { parseOfacVessels, parseUkShips } from "./sanctions";
import { parsePdf } from "./pdf";
import { parseReference, parseSynthetic } from "./context";
import { parseBrentDaily, parseEpisodes } from "./backtest";
import { parseAisSnapshot } from "./ais";
import { parseAdsbSnapshot } from "./adsb";
import type { ParseResult } from "./types";

export type { FactDraft, ParseResult } from "./types";

/** Picks the deterministic parser for a source key and media type. */
export async function parseEvidence(sourceKey: string, mediaType: string, bytes: Buffer, retrievedAt: Date): Promise<ParseResult> {
  if (mediaType === "application/pdf") return parsePdf(bytes);
  switch (sourceKey) {
    case "worldbank.wdi": return parseWorldBank(bytes);
    case "imf.weo": return parseImf(bytes, retrievedAt);
    case "jodi.oil": return parseJodi(bytes);
    case "eia.chokepoints": return parseEiaArticle(bytes);
    case "ofac.sdn": return parseOfacVessels(bytes);
    case "uk.sanctions": return parseUkShips(bytes);
    case "tigeris.reference": return parseReference(bytes);
    case "tigeris.synthetic": return parseSynthetic(bytes);
    case "eia.brent": return parseBrentDaily(bytes);
    case "tigeris.episodes": return parseEpisodes(bytes);
    case "aisstream.hormuz": return parseAisSnapshot(bytes);
    case "adsb.gulf": return parseAdsbSnapshot(bytes);
    default: return { facts: [] };
  }
}
