/**
 * Citation check for model text (FR-20, Q068, CLAUDE.md rule 5).
 * A sentence is "cited" only when:
 *   1. it carries a tag such as [S2] naming a source that was given to the model, and
 *   2. every number in it appears in a cited source, and
 *   3. each number is attached to the same quantity: the words just before the number in the
 *      sentence share a word with the words around that number in the source.
 * Anything else is marked UNVERIFIED with the reason, and shown that way.
 */
export interface Source { tag: string; kind: string; ref: string | null; label: string; text: string }
export interface CheckedSentence { sentence: string; tags: string[]; status: "cited" | "unverified"; reason?: string }

const TAG = /\[S(\d+)\]/g;
const STOP = new Set("the a an of to in on for and or is are was were be been by with as at from that this its it their which over into than then has have had per about around nearly some all any each".split(" "));
const NOISE = new Set(["usd", "us$", "p10", "p50"]); // currency marks carry no meaning on their own

export function splitSentences(text: string): string[] {
  // "Value is 3.6. [S1] Next" -> "Value is 3.6 [S1]. Next": a tag after the full stop belongs to that sentence.
  const clean = text.replace(/\s+/g, " ").trim().replace(/([.!?])((?:\s*\[S\d+\])+)/g, (_m, p: string, tags: string) => ` ${tags.replace(/\s+/g, "")}${p}`);
  if (!clean) return [];
  // Split after ., ! or ? (optionally followed by tags) when the next character starts a new sentence.
  const parts = clean.split(/(?<!\b(?:Co|Ltd|Inc|St|No|Mr|Dr|vs)\.)(?<=[.!?](?:\s*\[S\d+\])*)\s+(?=[A-Z0-9"“(])/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 1 && !/^(\[S\d+\]\s*)+$/.test(p));
}

interface Tok { word: string; num: number | null }
function tokenize(s: string): Tok[] {
  return s
    .replace(TAG, " ")
    .replace(/\b\d+-(day|hour|year|week|month|step)s?\b/gi, (m) => m.replace(/\d+-/, "")) // horizons such as "90-day" are labels, not claims
    .toLowerCase()
    .split(/[\s:;,()"“”]+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.!?]+$/, ""))
    .filter(Boolean)
    .map((w) => {
      const m = w.match(/^-?\d[\d,]*(?:\.\d+)?%?$/) ?? w.match(/^-?\d[\d,]*(?:\.\d+)?(?=[a-z%/]*$)/);
      const n = m ? Number(m[0].replace(/[,%]/g, "")) : NaN;
      return { word: w.replace(/[.]$/, ""), num: Number.isFinite(n) ? n : null };
    });
}

const content = (t: Tok) => t.num === null && t.word.length > 1 && !STOP.has(t.word) && !NOISE.has(t.word);

function same(v: number, x: number): boolean {
  if (x === v) return true;
  const decimals = (String(v).split(".")[1] ?? "").length;
  if (Number(x.toFixed(decimals)) === v) return true;
  for (const k of [1e3, 1e6, 1e9, 1e12]) if (Math.abs(x / k - v) <= Math.max(0.051 * Math.abs(v), 10 ** -decimals / 2 + 1e-9)) return true;
  return Math.abs(x - v) <= Math.abs(v) * 0.005;
}

/** Content words near the number in the sentence: up to 4 before it, or 4 after when it opens the sentence. */
function sentenceContext(toks: Tok[], i: number): Set<string> {
  const before: string[] = [];
  for (let j = i - 1; j >= 0 && before.length < 4; j--) if (content(toks[j]!)) before.push(toks[j]!.word);
  if (before.length) return new Set(before);
  const after: string[] = [];
  for (let j = i + 1; j < toks.length && after.length < 4; j++) if (content(toks[j]!)) after.push(toks[j]!.word);
  return new Set(after);
}

function sourceContexts(toks: Tok[], v: number): Array<Set<string>> {
  const out: Array<Set<string>> = [];
  toks.forEach((t, i) => {
    if (t.num !== null && same(v, t.num)) out.push(new Set(toks.slice(Math.max(0, i - 7), i + 7).filter(content).map((x) => x.word)));
  });
  return out;
}

const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
const overlaps = (a: Set<string>, b: Set<string>) => [...a].some((w) => b.has(w) || [...b].some((x) => stem(x) === stem(w)));

export function verifyText(text: string, sources: Source[]): CheckedSentence[] {
  const byTag = new Map(sources.map((s) => [s.tag, s]));
  return splitSentences(text).map((sentence) => {
    const tags = [...new Set([...sentence.matchAll(TAG)].map((m) => `S${m[1]}`))];
    if (!tags.length) return { sentence, tags, status: "unverified", reason: "No source cited" };
    const unknown = tags.filter((t) => !byTag.has(t));
    if (unknown.length) return { sentence, tags, status: "unverified", reason: `Cites a source that was not provided (${unknown.join(", ")})` };
    const srcToks = tokenize(tags.map((t) => `${byTag.get(t)!.label}: ${byTag.get(t)!.text}`).join(" . "));
    const toks = tokenize(sentence);
    for (let i = 0; i < toks.length; i++) {
      const v = toks[i]!.num;
      if (v === null) continue;
      const ctxs = sourceContexts(srcToks, v);
      if (!ctxs.length) return { sentence, tags, status: "unverified", reason: `Number not in the cited sources: ${v}` };
      const near = sentenceContext(toks, i);
      if (near.size && !ctxs.some((c) => overlaps(near, c))) return { sentence, tags, status: "unverified", reason: `${v} is attached to a different quantity in the cited source` };
    }
    return { sentence, tags, status: "cited" };
  });
}

export function citedShare(checked: CheckedSentence[]): number {
  return checked.length ? checked.filter((c) => c.status === "cited").length / checked.length : 0;
}
