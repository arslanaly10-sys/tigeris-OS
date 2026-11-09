# UI/UX quality pass with UI/UX Pro Max (9 Nov 2026) · UX §8, WCAG 2.2 AA

Skill: `.claude/skills/ui-ux-pro-max` (MIT, from nextlevelbuilder/ui-ux-pro-max-skill; offline Python
search, no hooks, no network). Used as a checklist; the navy and gold look is unchanged (owner's choice).

## Audit, before and after
Automated browser audit of sign-in and all 16 modules at 375px and 1440px, dark and light.

| | Before | After |
|---|---|---|
| Text below 4.5:1, dark (all pages) | 59 | 0 |
| Text below 4.5:1, light (desktop) | 678 | 77, all on the always-dark map canvas or tinted rows the script cannot composite; checked by eye |
| Text under 12px | 57 | 0 |
| Pages with sideways scroll on a phone | 1 (sign-in) | 0 |

## Changes
- Contrast tokens fixed in both themes; `apps/web/test/contrast.test.ts` (90 checks) guards them.
- Target sizes: 24px minimum on desktop, 44px on touch screens; `.tap` hit areas for text links and map markers;
  map place names taken out of the tab order (they were announced as "Map marker" buttons).
- Text: chart axes, back-test labels, architecture diagram and wordmark subtitle raised to 12px.
- Phones: sign-in header wraps instead of overflowing; key screens tuned; map layer list starts collapsed.
- Domain type badges were wrapped in a dead link; now plain badges.

## Not changed
- Dense desktop tables keep 36–40px buttons (owner's choice: 44px on touch only).
- The skill's suggested palette and fonts were not adopted.
