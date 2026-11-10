---
version: 4.0
name: TIGERIS · Sovereign Intelligence OS
description: "The Command Centre system (10 Nov 2026), applied OS-wide from the client's sector Command Centre mockups: ivory surfaces, deep green action colour, gold eyebrows and rules, Libre Caslon Text headings, Inter UI text, 10px cards, 7px buttons, 6px pills. JetBrains Mono stays for system strings; IBM Plex Sans Arabic in Arabic."
---

# TIGERIS design system (v4: the Command Centre system)

The whole OS now follows the sector Command Centre mockups (docs/progress/command-centres.md). Tokens live in one place,
`apps/web/src/app/globals.css`; `test/contrast.test.ts` checks every text token against every surface.

| Role | Token | Value |
|---|---|---|
| Page ground | `--bg` | `#f6f2e9` |
| Cards | `--surface` | `#fffdf8` |
| Sidebar, bands | `--surface-2` | `#faf6ee` |
| Fills, soft rules | `--surface-3` | `#eee7d9` |
| Hairlines | `--line` / `--line-strong` | `#e5dccb` / `#cdbfa5` |
| Text | `--ink` | `#1c2a23` |
| Headings | `--heading` | `#0f3a2e` |
| Action, active nav | `--primary` | `#1f4b3b` (white text) |
| Gold text (eyebrows, awaiting) | `--accent` / `--warn` | `#6f4f1c` |
| Gold rules and dots only | `--gold` | `#b68a3f` (never text: fails AA) |
| High / medium / low | `--crit` / `--warn` / `--ok` on their soft fills | `#9a3328` / `#6f4f1c` / `#24563f` |
| Dark card | `--dark-card` | `#12352b` |

- Type: headings and page titles in Libre Caslon Text 400 (page H1 40px, card titles 19px, subtitles 16.5px); UI text
  in Inter 14px; eyebrows Inter 11.5px uppercase, tracking .32em, gold text.
- Shape: cards 10px radius, 16px 18px padding, 16px gaps; buttons 7px, at least 40px tall; pills 6px.
- Shell: 236px sidebar with the palm mark, "TIGERIS AI OS" and the tagline, solid green active item, the sector
  illustration at the foot; 72px top bar with Institution, Sector (the audited lens), search, model switch, notifications,
  EN | العربية, the gold "Approval required (n)" pill and the avatar.
- Icons: Lucide at stroke 1.6. Status is never colour alone; every pill carries a word.

The v3 notes below are kept for history; where they disagree with v4, v4 wins.

## History: v3 (the client's tigercapital.ai brand)

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
