---
version: 3.0
name: TIGERIS · Sovereign Intelligence OS
description: "The client's own brand, taken from tigercapital.ai (docs/brand/TOKENS.md): ivory surfaces on a visible hairline grid, ink text, one gold accent, a blue signal for live state, near-square corners. Space Grotesk for display, Manrope for UI text, JetBrains Mono for labels, figure captions and system strings; IBM Plex Sans Arabic in Arabic."
---

# TIGERIS design system (v3: the client's brand)

From brief v3 §13, the prototype must look as if it belongs to tigercapital.ai. Every value here comes from the live
site's stylesheet (verified 10 Nov 2026). Tokens live in one place: `apps/web/src/app/globals.css`. No hex values in
components except the map's cartographic palette and the flow colours, which are the site's own.

## Colour

| Role | Token | Value | Site token |
|---|---|---|---|
| Page ground | `--bg` | `#f9f4ea` | `--background` |
| Panels | `--surface` | `#f5eee3` | `--card` |
| Bands, table heads | `--surface-2` | `#f0e7d8` | `--navy-deep` |
| Fills | `--surface-3` | `#e8dcca` | `--accent` |
| Text | `--ink` | `#140e09` | `--foreground` |
| Secondary text | `--ink-muted` | `#4b4037` | `--muted-foreground` |
| Brand accent | `--primary` | `#86581d` | `--gold` |
| Live, active | `--signal` | `#1447e6` | `--signal` |
| Hairlines | `--line`, `--line-strong` | brown at 20% / 55% | `--hairline`, `--hairline-strong` |
| Flows | `--flow-*` | compute, energy, transfer, risk, policy | `--flow-*` |

- Ivory only. The client has no dark theme, so there is none here; both `data-theme` values resolve to ivory.
- Faint and status inks are darkened just enough for WCAG AA on every surface; `test/contrast.test.ts` enforces it.
- Status is never colour alone: every badge has an icon and a word.

## Type

| Job | Face | Notes |
|---|---|---|
| Page titles, statements | Space Grotesk 700 | `h1` 40 px, tight tracking; `.statement` for large lines |
| Panel titles | Space Grotesk 600 | 16 px |
| Text and controls | Manrope 400–600 | 15 px body |
| Eyebrows | JetBrains Mono 500 | Uppercase, 0.14em tracking, gold, parts joined with " · " |
| Figure captions | JetBrains Mono | `.fig-caption`: "Fig. 04 — Coordination debt, resolved" |
| System strings | JetBrains Mono | `.sys`: breadcrumbs, versions, tenant status |

All faces are self-hosted (SIL OFL) so the offline mode keeps them. Numbers use tabular figures (`.tabular`).

## Layout and motion

- Corners `0.125rem` everywhere (`--radius-*`), hairline borders, no heavy shadows.
- The page ground shows the site's grid: 24 px minor, 96 px major.
- Every page header: a numbered eyebrow with a hairline rule (`08 · OPERATE · MOVEMENT MAP`), then the title.
- Ease `cubic-bezier(.22, 1, .36, 1)` (`--ease-institutional`). Reduced motion is respected everywhere.
- Maps use an ivory cartographic style; markers use the flow palette and keep distinct shapes per type.
