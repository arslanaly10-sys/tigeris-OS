import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Text contrast in both themes (WCAG 2.2 1.4.3, UI/UX Pro Max priority 1). Reads the tokens straight from
 * globals.css so a token change that drops text below 4.5:1 on any surface it sits on fails the build.
 */
const css = readFileSync(path.resolve(import.meta.dirname, "../src/app/globals.css"), "utf8");

function block(selector: RegExp): Record<string, string> {
  const m = css.match(selector);
  if (!m) throw new Error(`no block for ${selector}`);
  const out: Record<string, string> = {};
  for (const [, k, v] of m[1]!.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[k!] = v!.toLowerCase();
  return out;
}
const THEMES = {
  dark: block(/:root,\s*\[data-theme="dark"\]\s*\{([^}]*)\}/),
  light: block(/\[data-theme="light"\]\s*\{([^}]*)\}/),
};

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function ratio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const SURFACES = ["bg", "surface", "surface-2", "surface-3"];
const TEXT = ["ink", "ink-muted", "ink-faint", "primary", "accent", "ok", "warn", "crit", "info"];
/** Status text on its own soft fill (badges), and ink on solid fills (count badge, primary button). */
const PAIRS: [string, string][] = [
  ["ok", "ok-soft"], ["warn", "warn-soft"], ["crit", "crit-soft"], ["info", "info-soft"], ["primary", "primary-soft"], ["accent", "primary-soft"],
  ["primary-ink", "primary"], ["primary-ink", "primary-hover"], ["on-crit", "crit"],
];

describe.each(Object.entries(THEMES))("%s theme text contrast", (_name, t) => {
  for (const fg of TEXT) for (const bg of SURFACES) {
    it(`${fg} on ${bg} is at least 4.5:1`, () => expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5));
  }
  for (const [fg, bg] of PAIRS) {
    it(`${fg} on ${bg} is at least 4.5:1`, () => {
      expect(t[fg], `--${fg} missing`).toBeDefined();
      expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
