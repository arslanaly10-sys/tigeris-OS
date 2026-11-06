import type { FactDraft, ParseResult } from "./types";

/**
 * Deterministic PDF ingestion (FR-11, Q051): text per page, text drawn too small to read
 * (a common way to hide instructions), and candidate figures with page citations.
 * Candidate figures need analyst review; model-based extraction is added in week 6.
 */
export async function parsePdf(bytes: Buffer): Promise<ParseResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  let text = "";
  let hiddenTextChars = 0;
  const facts: FactDraft[] = [];
  const synthetic = { flag: false };
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const parts: string[] = [];
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const size = Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0);
      if (size > 0 && size < 4) hiddenTextChars += item.str.length;
      parts.push(item.str);
    }
    const pageText = parts.join(" ").replace(/\s+/g, " ").trim();
    text += `\n[page ${p}] ${pageText}`;
    if (/SYNTHETIC DEMONSTRATION/i.test(pageText)) synthetic.flag = true;
    for (const s of pageText.split(/(?<=\.)\s+/)) {
      const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*(%|per cent|days?|per day|million|billion|b\/d|USD|US\$)?/i);
      if (!m || !/[a-z]{4,}/i.test(s) || /^SYNTHETIC/i.test(s)) continue;
      if (/\b(19|20)\d{2}\b/.test(m[1]!) && !m[2]) continue; // a bare year is not a figure
      facts.push({
        subject: "document", subjectLabel: "Uploaded document", predicate: "stated_figure", predicateLabel: "Figure stated in the document",
        valueNum: Number(m[1]!.replace(",", ".")), valueText: s.trim().slice(0, 400), unit: m[2] ?? null,
        claimClass: "sourced", reviewState: "needs_review", locator: `page ${p}`, excerpt: s.trim(), method: "parser.pdf_text.v1",
      });
    }
  }
  if (synthetic.flag) for (const f of facts) f.claimClass = "synthetic";
  return { facts, text, signals: { hiddenTextChars, pages: doc.numPages } };
}
