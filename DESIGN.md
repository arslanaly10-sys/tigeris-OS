---
version: 2.0
name: TIGERIS · Sovereign Intelligence OS
description: "A sovereign command-room interface built to the taste skill's system: a deep navy canvas with a four-step surface ladder and hairline borders, warm ivory text, and gold as the one accent — for the primary action, the active place and focus. One family with fixed jobs: Host Grotesk for headings and text at weights 400 and 500, JetBrains Mono for identifiers, IBM Plex Sans Arabic in Arabic. Sentence case, nothing under 13px, quiet hover and press motion, one entrance per page, and one moving centrepiece on sign-in: the Gulf with ships on their lanes."
references: "System, type, motion and copy rules from the taste skill (Leonxlnx/taste-skill, MIT, installed in .agents/skills/design-taste-frontend). Earlier structure adapted from the Linear and IBM analyses in VoltAgent/awesome-design-md (MIT). Motion via the motion library and its AI kit. Brand, palette and voice are TIGERIS's own (questionnaire Q009–Q015)."

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
  hero-line:    { fontFamily: Host Grotesk, fontSize: 48px, fontWeight: 500, lineHeight: 1.05, letterSpacing: -3.5% }   # sign-in only
  page-title:   { fontFamily: Host Grotesk, fontSize: 34px, fontWeight: 500, lineHeight: 1.1, letterSpacing: -2.5% }
  panel-title:  { fontFamily: Host Grotesk, fontSize: 16px, fontWeight: 500, lineHeight: 1.35, letterSpacing: -1.5% }
  lead:         { fontFamily: Host Grotesk, fontSize: 16px, fontWeight: 400, lineHeight: 1.6 }   # page descriptions
  body:         { fontFamily: Host Grotesk, fontSize: 15px, fontWeight: 400, lineHeight: 1.55 }
  body-sm:      { fontFamily: Host Grotesk, fontSize: 13–14px, fontWeight: 400, lineHeight: 1.45 }   # tables, dense lists
  label:        { fontFamily: Host Grotesk, fontSize: 13px, fontWeight: 500, note: "sentence case, never tracked capitals" }
  eyebrow:      { fontFamily: Host Grotesk, fontSize: 13px, fontWeight: 500, color: ink-subtle, note: "sentence case; groups a panel" }
  mono:         { fontFamily: JetBrains Mono, fontSize: 13px, fontWeight: 400 }   # identifiers and hashes only
  arabic:       { fontFamily: IBM Plex Sans Arabic, note: "replaces Host Grotesk in Arabic; no letter-spacing" }
  floor:        "nothing under 13px; weights 400 and 500 only"

rounded:
  xs: 4px     # badges, chips
  sm: 6px     # buttons, inputs
  md: 8px     # panels, cards, drawers (the skill's sharp scale, for fintech-grade tools)
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
  button-primary:   { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.sm}", height: 40px, padding: "0 16px", fontSize: 14px, hover: "fill steps 14% toward ink, 1px up", press: "1px down, scale .985" }
  button-secondary: { backgroundColor: "{colors.surface-2}", border: "1px {colors.hairline-strong}", textColor: "{colors.ink}", rounded: "{rounded.sm}", height: 40px, hover: "border and fill step, 1px up" }
  button-ghost:     { backgroundColor: transparent, textColor: "{colors.ink-muted}", hover: "{colors.surface-2}", rounded: "{rounded.sm}" }
  button-danger:    { backgroundColor: "critical at 12%", border: "1px critical at 45%", textColor: "{colors.critical}" }
  panel:            { backgroundColor: "{colors.surface-1}", border: "1px {colors.hairline}", rounded: "{rounded.md}", highlight: "inset 0 1px 0 white at 3% (dark only)" }
  panel-header:     { padding: "16px 20px", border-bottom: "1px {colors.hairline}", typography: "eyebrow + panel-title" }
  badge:            { rounded: "{rounded.xs}", typography: caption-500, padding: "2px 6px", fill: "tone at 12%", border: "tone at 35%", icon: required for status }
  tabs:             { typography: 14px 500, active: "ink + one 2px {colors.primary} bar that slides to the tab by transform (240ms)", idle: "{colors.ink-subtle}" }
  input:            { backgroundColor: "{colors.surface-2}", border: "1px {colors.hairline-strong}", rounded: "{rounded.sm}", height: 36px, focus: "2px {colors.primary} ring at 45%" }
  table:            { header: "caption 600 {colors.ink-subtle}, surface-2 band", row: "body-sm, 1px hairline divider, hover surface-2", numbers: tabular, align-end }
  nav-item:         { idle: "{colors.ink-muted}", hover: "{colors.surface-2}", active: "{colors.surface-3} + 2px {colors.primary} start border + ink" }
  top-bar:          { backgroundColor: "{colors.canvas}, opaque, no blur", border-bottom: "1px {colors.hairline}", height: 52px }
  motion:           { hover-in: 150ms, hover-out: 120ms, press: 90ms, card-lift: "2px, 180ms", tab-slide: 240ms, ease: "cubic-bezier(.2,.8,.2,1)", entrance: "page title rises out of its mask 700ms, description fades up 12px 520ms" }
---

## Overview

TIGERIS is used in rooms where a decision has consequences. The interface should feel like a well-run
operations floor: calm, exact and quietly authoritative. It takes two disciplines from the reference
library and applies them to TIGERIS's own identity:

- **From the Linear analysis:** depth comes from a *surface ladder* (canvas → surface-1 → surface-2 →
  surface-3) and 1px hairlines, not shadows; one chromatic accent, used rarely; compact controls.
- **From the IBM analysis:** flat tiles, and data presented in dense, legible tables with tabular numbers.
- **From the taste skill (v2.0):** type, motion and copy rules; see the last section.

What stays TIGERIS: the navy canvas, warm ivory text, restrained gold (dark) and deep emerald (light
"Foundation" theme), the eight-point star pattern on empty states, and the Foundation voice.

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

- **One family with fixed jobs:** Host Grotesk for every heading and text, at 400 and 500 only; size and
  tight tracking carry the headings, never bold. JetBrains Mono for identifiers. Nothing under 13px.
- **Numbers are tabular** wherever they line up or update.
- **Labels and eyebrows** are 13px at 500 in sentence case, never tracked capitals. Arabic has no
  tracking anywhere (letters must join).
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

Buttons are 40px high (36px small, 44px large), 6px corners, 14px at 500; they step 1px up on hover and
press 1px down at .985 scale. Badges are 4px-cornered,
tinted at 12% with a 35% border; status badges always carry an icon. Tabs are text with one 2px gold bar
that slides to the active tab. Tables use a surface-2 header band, hairline row dividers and end-aligned
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

### UI/UX Pro Max checks (version 2.1)

The app is also checked against UI/UX Pro Max (`.claude/skills/ui-ux-pro-max`), used as a quality
checklist only: the navy and gold look, fonts and layout are unchanged.

- **Contrast.** Every text token is at least 4.5:1 on every surface in both themes, and status text on its own
  soft fill. `apps/web/test/contrast.test.ts` reads the tokens from `globals.css` and fails the build if one drops.
  Light-mode faint text, accent, success and warning were darkened; the notification count uses `--on-crit`.
- **Target size.** Desktop keeps the dense layout with a 24px minimum (WCAG 2.2 2.5.8). On touch screens
  (`pointer: coarse`) buttons, tabs, fields and map controls are 44px. Small text links and map markers use
  `.tap`, which enlarges the hit area without moving the layout.
- **Text size.** Nothing is smaller than 12px, including chart axes, the architecture diagram and the wordmark.
- **Phones.** Sign-in fits at 375px; Command Centre, Signals, Cases, case detail and the Movement Map are tuned
  for phones (the map's layer list starts collapsed). Other modules stay readable with no sideways scroll.

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

## Taste skill (version 2.0)

Version 2.0 applies the taste skill's system (`.agents/skills/design-taste-frontend`) to the app, with TIGERIS's
own colours kept through the skill's brand path. Its automatic finish check is switched off in the installed copy
(the `hooks` block removed from its SKILL.md), because the check is written for marketing pages (one section per
screen, a full-screen hero) and would block unrelated app work; its scripts are still run by hand.

What the app takes from it:

- **Type:** one family with fixed jobs (Host Grotesk; JetBrains Mono for identifiers), weights 400 and 500 only,
  headings carried by size and tight tracking, sentence case everywhere, nothing under 13px.
- **Motion in three places:** each page title enters once (it rises out of its mask, then its description fades
  up); every button, link and linked card answers the pointer (button step and press, a drawn underline, a 2px card
  lift); tabs move one indicator by transform. Nothing reveals on scroll. Focus shows at once and never animates.
  Reduced motion rests everything and keeps it visible.
- **One moving centrepiece on sign-in:** the Gulf at night with the simulated fleet on its lanes, moving on the
  wall clock in Riyadh time, driven by Motion's frame loop. It replaces the eight-point pattern there (the pattern
  stays for empty states) and is labelled "Simulated ships".
- **Live ships on the maps:** the Movement Map and the Command Centre open on the live clock. Real ships from the
  AIS snapshot move on an estimate from their last reported course and speed, for at most six hours, and say so.
- **One accent, no violet:** gold in dark, emerald in light; the violet once used for power plants and passenger
  ships is now rose.
- **Copy:** the skill's copy-lint passes on sign-in and the Command Centre (panel labels kept on purpose).

Where the app departs from the skill, and why:

- **Density.** Tables and lists use 13–14px text and 40px buttons (36px small), not the skill's 16px body and 44px
  buttons: analysts work through dense tables. Touch screens get 44px targets (see UI/UX Pro Max below).
- **Layout.** No one-section-per-screen rhythm, full-screen hero or footer close: those are for marketing pages.
- **Panel labels.** Small sentence-case labels group panels on dashboards (copy-lint warns about eyebrows).
- **Sticky case tabs** stay, opaque, under the header: long cases need them in reach.
- **Status badges** keep their tinted fills with an icon or word, as status is never colour alone (CLAUDE.md rule 11).
