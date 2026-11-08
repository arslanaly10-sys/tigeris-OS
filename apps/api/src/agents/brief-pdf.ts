import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Executive brief export (Q059, FR-33). The PDF carries the case classification at the top and
 * bottom of every page, marks unverified sentences, numbers every citation and lists the records
 * behind them. Export redaction rules arrive in week 7 with the policy engine.
 */
interface BriefSentence { text: string; status: "cited" | "unverified"; reason: string | null; sources: Array<{ kind: string; ref: string | null; label: string; text: string }> }
export interface BriefContent { title: string; classification: string; generatedFor: string; status: string; sections: Array<{ heading: string; writer: string; sentences: BriefSentence[] }> }
export interface BriefOption { title: string; score: number; band: string; policy: string; authority: string }

// Standard PDF fonts only cover WinAnsi; map common typography and drop anything else.
const MAP: Record<string, string> = { "→": "->", "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "≈": "~", "×": "x", "−": "-", "≤": "<=", "≥": ">=" };
export const winAnsi = (s: string) => s.replace(/[→–—“”‘’…≈×−≤≥]/g, (c) => MAP[c] ?? "").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = winAnsi(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > width && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function briefPdf(b: BriefContent, meta: { caseKey: string; version: number; createdAt: string; hash: string; options: BriefOption[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${meta.caseKey} executive brief v${meta.version}`);
  doc.setProducer("TIGERIS Sovereign Intelligence OS");
  doc.setSubject(`Classification: ${b.classification}`);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 54, CW = W - 2 * M;
  const ink = rgb(0.15, 0.19, 0.18), muted = rgb(0.36, 0.42, 0.39), warn = rgb(0.66, 0.27, 0.24), green = rgb(0.09, 0.39, 0.28);
  const label = b.classification.toUpperCase();
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const pages: PDFPage[] = [page];
  const newPage = () => { page = doc.addPage([W, H]); pages.push(page); y = H - M - 10; };
  const need = (h: number) => { if (y - h < M + 30) newPage(); };
  const text = (s: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number }) => {
    const size = o.size ?? 10.5, font = o.font ?? sans;
    for (const l of wrap(s, font, size, CW - (o.indent ?? 0))) {
      need(size + 4);
      page.drawText(l, { x: M + (o.indent ?? 0), y, size, font, color: o.color ?? ink });
      y -= size * 1.38;
    }
    y -= o.gap ?? 0;
  };

  // Title block
  y -= 14;
  text("TIGERIS · Sovereign Intelligence OS", { font: sansBold, size: 9, color: green, gap: 4 });
  text(b.title, { font: serifBold, size: 20, gap: 2 });
  text(`Executive brief · ${meta.caseKey} · version ${meta.version} · ${new Date(meta.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC`, { size: 9, color: muted });
  text(`Prepared by bounded agents for ${b.generatedFor}. Content hash ${meta.hash.slice(0, 16)}.`, { size: 9, color: muted, gap: 6 });
  need(30);
  page.drawRectangle({ x: M, y: y - 8, width: CW, height: 22, color: rgb(0.96, 0.91, 0.84) });
  page.drawText(winAnsi(b.status), { x: M + 8, y: y - 1, size: 9.5, font: sansBold, color: rgb(0.45, 0.28, 0.08) });
  y -= 30;

  const refs: Array<{ label: string; text: string; kind: string }> = [];
  const refNo = (s: { label: string; text: string; kind: string }) => {
    const i = refs.findIndex((r) => r.label === s.label && r.text === s.text);
    if (i >= 0) return i + 1;
    refs.push(s);
    return refs.length;
  };
  let unverified = 0;
  for (const sec of b.sections) {
    if (!sec.sentences.length) continue;
    need(40);
    y -= 6;
    text(sec.heading, { font: serifBold, size: 13, gap: 1 });
    for (const s of sec.sentences) {
      const nums = s.sources.map(refNo);
      const marks = nums.length ? ` [${nums.join(", ")}]` : "";
      if (s.status === "unverified") { unverified++; text(`UNVERIFIED: ${s.text}${marks} (${s.reason ?? "not checked"})`, { color: warn, gap: 2 }); }
      else text(`${s.text}${marks}`, { font: serif, size: 11, gap: 2 });
    }
    text(`Written by: ${sec.writer}`, { size: 8, color: muted, gap: 4 });
  }

  if (meta.options.length) {
    need(60);
    y -= 6;
    text("Ranked options", { font: serifBold, size: 13, gap: 4 });
    const cols = [M, M + 250, M + 300, M + 360, M + 410];
    const head = ["Option", "Score", "Band", "Policy", "Decision authority"];
    head.forEach((h, i) => page.drawText(h, { x: cols[i]!, y, size: 8.5, font: sansBold, color: muted }));
    y -= 14;
    meta.options.forEach((o, i) => {
      need(16);
      const row = [`${i + 1}. ${o.title}`, o.score.toFixed(1), o.band, o.policy, o.authority];
      row.forEach((c, j) => page.drawText(winAnsi(c).slice(0, j === 0 ? 46 : j === 4 ? 32 : 10), { x: cols[j]!, y, size: 9, font: sans, color: ink }));
      y -= 14;
    });
  }

  need(40);
  y -= 8;
  text("Sources", { font: serifBold, size: 13, gap: 2 });
  refs.forEach((r, i) => text(`[${i + 1}] ${r.label} (${r.kind}): ${r.text}`, { size: 8.5, color: muted, indent: 0, gap: 1 }));
  text(`${unverified} unverified sentence(s). Every number above comes from a source record or the deterministic scenario engine; models only phrase the text.`, { size: 8.5, color: muted, gap: 0 });

  pages.forEach((p, i) => {
    p.drawText(label, { x: W / 2 - sansBold.widthOfTextAtSize(label, 9) / 2, y: H - 30, size: 9, font: sansBold, color: warn });
    p.drawText(label, { x: W / 2 - sansBold.widthOfTextAtSize(label, 9) / 2, y: 22, size: 9, font: sansBold, color: warn });
    p.drawText("Confidential · Client IP", { x: M, y: 22, size: 8, font: sans, color: muted });
    const pn = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pn, { x: W - M - sans.widthOfTextAtSize(pn, 8), y: 22, size: 8, font: sans, color: muted });
  });
  return doc.save();
}
