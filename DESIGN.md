---
version: 1.0
name: TIGERIS · Sovereign Intelligence OS
description: "A sovereign command-room interface: a deep navy canvas with a four-step surface ladder and hairline borders, warm ivory text, and restrained gold as the only brand accent — reserved for the primary action, the active place and focus. Page titles are set in Source Serif 4 for institutional gravity; everything an operator reads or works with is IBM Plex Sans (with Plex Sans Arabic and Plex Mono as the same family). Dense, flat, legible: no shadows on content, no gradients, colour never carries meaning alone."
references: "Structural discipline adapted from the Linear and IBM analyses in VoltAgent/awesome-design-md (MIT). Brand, palette and voice are TIGERIS's own (questionnaire Q009–Q015)."

colors:
  # Dark (default)
  canvas: "#070d18"
  surface-1: "#0c1526"
  surface-2: "#111c30"
  surface-3: "#18253c"
  hairline: "#1c2a41"
  hairline-strong: "#2a3b57"
  ink: "#ece8de"
  ink-muted: "#a4aebd"
  ink-subtle: "#76839a"
  primary: "#c8a35a"
  primary-hover: "#d6b673"
  on-primary: "#16110a"
  primary-soft: "#211b11"
  accent: "#dcc088"
  success: "#3fae86"
  warning: "#d4974a"
  critical: "#d8645a"
  info: "#7ba7dc"
  # Light ("Foundation")
  light-canvas: "#f6f5f0"
  light-surface-1: "#ffffff"
  light-surface-2: "#f2f1eb"
  light-surface-3: "#e9e8e0"
  light-hairline: "#e3e2d9"
  light-hairline-strong: "#cdcbc0"
  light-ink: "#1d2925"
  light-ink-muted: "#55625c"
  light-ink-subtle: "#7b8681"
  light-primary: "#14603f"
  light-accent: "#a2843f"

typography:
  page-title:   { fontFamily: Source Serif 4, fontSize: 28px, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.4px }
  section-title: { fontFamily: Source Serif 4, fontSize: 20px, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.2px }
  panel-title:  { fontFamily: IBM Plex Sans, fontSize: 15px, fontWeight: 600, lineHeight: 1.35, letterSpacing: -0.1px }
  body:         { fontFamily: IBM Plex Sans, fontSize: 14px, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
  body-sm:      { fontFamily: IBM Plex Sans, fontSize: 13px, fontWeight: 400, lineHeight: 1.45, letterSpacing: 0 }
  label:        { fontFamily: IBM Plex Sans, fontSize: 12.5px, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0.1px }
  caption:      { fontFamily: IBM Plex Sans, fontSize: 12px, fontWeight: 400, lineHeight: 1.4, letterSpacing: 0.1px }
  eyebrow:      { fontFamily: IBM Plex Sans, fontSize: 11px, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.8px, textTransform: uppercase }
  metric:       { fontFamily: IBM Plex Sans, fontSize: 22px, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.3px, fontVariant: tabular-nums }
  mono:         { fontFamily: IBM Plex Mono, fontSize: 12px, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }
  arabic:       { fontFamily: IBM Plex Sans Arabic, note: "replaces Plex Sans and Source Serif in Arabic; no letter-spacing, no uppercase" }

rounded:
  xs: 4px     # badges, chips
  sm: 6px     # buttons, inputs, tabs
  md: 10px    # panels and cards
  lg: 14px    # drawers, dialogs, the guide
  pill: 9999px

spacing:
  unit: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 48]
  panel-padding: 20px
  page-gutter: 24px (40px on spacious layouts)
  header-height: 52px
  sidebar-width: 244px
  content-max: 1480px

components:
  button-primary:   { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.sm}", height: 36px, padding: "0 14px", typography: label }
  button-secondary: { backgroundColor: "{colors.surface-2}", border: "1px {colors.hairline-strong}", textColor: "{colors.ink}", rounded: "{rounded.sm}", height: 36px }
  button-ghost:     { backgroundColor: transparent, textColor: "{colors.ink-muted}", hover: "{colors.surface-2}", rounded: "{rounded.sm}" }
  button-danger:    { backgroundColor: "critical at 12%", border: "1px critical at 45%", textColor: "{colors.critical}" }
  panel:            { backgroundColor: "{colors.surface-1}", border: "1px {colors.hairline}", rounded: "{rounded.md}", highlight: "inset 0 1px 0 white at 3% (dark only)" }
  panel-header:     { padding: "16px 20px", border-bottom: "1px {colors.hairline}", typography: "eyebrow + panel-title" }
  badge:            { rounded: "{rounded.xs}", typography: caption-500, padding: "2px 6px", fill: "tone at 12%", border: "tone at 35%", icon: required for status }
  tabs:             { typography: label 13.5px, active: "ink + 2px {colors.primary} underline", idle: "{colors.ink-muted}" }
  input:            { backgroundColor: "{colors.surface-2}", border: "1px {colors.hairline-strong}", rounded: "{rounded.sm}", height: 36px, focus: "2px {colors.primary} ring at 45%" }
  table:            { header: "caption 600 {colors.ink-subtle}, surface-2 band", row: "body-sm, 1px hairline divider, hover surface-2", numbers: tabular, align-end }
  nav-item:         { idle: "{colors.ink-muted}", hover: "{colors.surface-2}", active: "{colors.surface-3} + 2px {colors.primary} start border + ink" }
  top-bar:          { backgroundColor: "{colors.canvas} at 92% with blur", border-bottom: "1px {colors.hairline}", height: 52px }
---

## Overview

TIGERIS is used in rooms where a decision has consequences. The interface should feel like a well-run
operations floor: calm, exact and quietly authoritative. It takes two disciplines from the reference
library and applies them to TIGERIS's own identity:

- **From the Linear analysis:** depth comes from a *surface ladder* (canvas → surface-1 → surface-2 →
  surface-3) and 1px hairlines, not shadows; one chromatic accent, used rarely; compact controls.
- **From the IBM analysis:** one type superfamily across languages (IBM Plex Sans, Plex Sans Arabic,
  Plex Mono), flat tiles, and data presented in dense, legible tables with tabular numbers.

What stays TIGERIS: the navy canvas, warm ivory text, restrained gold (dark) and deep emerald (light
"Foundation" theme), serif page titles, the eight-point star pattern on sign-in and empty states only,
and the Foundation voice.

## Colour

- **Gold is scarce.** Primary button (one per view), the active navigation item, the active tab
  underline, focus rings, links and the brand mark. Never a panel fill, never decoration.
- **Surfaces climb one step at a time.** Page on canvas; panels on surface-1; inputs, table headers and
  hover on surface-2; selected rows, menus and the active nav item on surface-3.
- **Semantic colours are for status only** (verified, warning, critical, info), always paired with an
  icon or a word. Chart series use the validated categorical slots (`--series-1..3`) and are never
  reused for status.
- Text contrast: ink ≥ 12:1, ink-muted ≥ 6:1, ink-subtle ≥ 4.5:1 on surface-1 in both themes.

## Typography

- **Serif is for titles people read as documents**: page titles, the case title, executive brief
  headings. Panel titles, labels, tables and everything operational are Plex Sans.
- **Numbers are tabular** wherever they line up or update.
- **Eyebrows** are 11px Plex Sans, uppercase, +0.8px tracking. In Arabic they are sentence case with no
  tracking (letters must join).
- **Mono** only for identifiers and hashes (case keys, content hashes, rule ids).

## Layout

- 4px base unit. Panels pad 20px; panel headers 16px × 20px.
- Content width caps at 1480px so lines stay readable on wide screens.
- Executives get the spacious layout (larger gutters), analysts the dense one (Q015). Both use the same
  components; only spacing changes.
- Logical properties throughout (`ms-`, `me-`, `start-`, `end-`) so Arabic mirrors without overrides.

## Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 | canvas | page background |
| 1 | surface-1 + hairline (+ 3% top highlight in dark) | panels, cards |
| 2 | surface-2 | inputs, table header band, hover |
| 3 | surface-3 | selected row, active nav, menus |
| overlay | surface-1 + hairline-strong + shadow | popovers, drawers, dialogs, the guide |

Shadows exist only on overlays that float above content.

## Components

Buttons are 36px high (32px small, 44px large), 6px corners, Plex Sans 500. Badges are 4px-cornered,
tinted at 12% with a 35% border; status badges always carry an icon. Tabs are text with a 2px gold
underline when active. Tables use a surface-2 header band, hairline row dividers and end-aligned
tabular numbers. Inputs sit on surface-2 with a strong hairline and a gold focus ring.

## Interface guidelines

The UI is reviewed against the Vercel Web Interface Guidelines (`.agents/skills/web-design-guidelines`).
Patterns adopted across the app:

- Buttons stay enabled; a missing field is explained next to it and receives focus (`lib/forms.ts`).
- Unsaved edits (policy editor, decision rationale, comments, memory drafts) warn before leaving.
- Destructive actions confirm: reset demo and discard edits need a second press.
- Case tabs and memory searches live in the URL, so they can be linked and restored.
- Placeholders show an example and end with "…"; non-auth fields set `autocomplete="off"`.
- Numbers go through `Intl.NumberFormat` (`num()`); units stay on the number's line (non-breaking space).
- Identifiers, hashes and the wordmark carry `translate="no"`.
- Clickable rows are keyboard-reachable; tables over 50 rows show 50 with "Show all"; long lists use
  `content-visibility`.
- A skip link leads to the main content; sticky bars never cover a focused field.

Deliberate deviations: headings and buttons use **sentence case**, not Title Case (house style, and
consistent with the Arabic screens). Fonts are bundled with the app and use `font-display: swap`;
there is no CDN to preconnect to.

## Do

- Let content lead: tables, maps, charts and checked text are the protagonists.
- Show provenance next to numbers (lineage, claim class, classification) in caption type.
- Keep one primary action per view.

## Don't

- Don't use gold or emerald as a background for panels or sections.
- Don't add gradients, glows or drop shadows to content.
- Don't use colour alone for status, or chart series colours for status.
- Don't use the geometric pattern outside sign-in and empty states.
- Don't track or uppercase Arabic.
- Don't imitate any reference brand's identity (logo, colours, wording).
