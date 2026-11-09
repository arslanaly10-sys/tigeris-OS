# TIGERIS / Tiger Capital AI: brand tokens

These tokens were read from the live `:root` CSS on https://tigercapital.ai/ on 10 Nov 2026. The site defines colours in OKLCH; the hex values are sRGB conversions.

## Colours

### Base

| Token | OKLCH | Hex | Use |
|---|---|---|---|
| `--background` | 96.8% .014 85 | `#F9F4EA` | Page ground (ivory) |
| `--foreground` | 17% .015 60 | `#140E09` | Primary text |
| `--card` | 95.2% .017 83 | `#F5EEE3` | Cards and panels |
| `--navy` (cream) | 94.5% .018 82 | `#F3ECE0` | Alternate section |
| `--navy-deep` | 93% .022 80 | `#F0E7D8` | Alternate section (deeper) |
| `--accent` | 90% .028 80 | `#E8DCCA` | Accent fill |
| `--muted-foreground` | 38% .022 60 | `#4B4037` | Secondary text |

### Brand and signal

| Token | OKLCH | Hex | Use |
|---|---|---|---|
| `--gold` / `--primary` | 50% .095 68 | `#86581D` | Brand accent: labels, rules, highlights |
| `--gold-soft` | 66% .07 75 | `#AC8C61` | Soft accent |
| `--signal` | 48.8% .243 264 | `#1447E6` | Live signal, active state, key words |
| `--destructive` | 52% .19 27 | n/a | Errors |

### Lines

| Token | OKLCH | Hex | Use |
|---|---|---|---|
| `--hairline` / `--border` | 45% .06 65 / 20% | `#6C4E30` @ 20% | Borders, grid |
| `--hairline-strong` | 35% .05 60 / 55% | `#4E341F` @ 55% | Strong rules |

### Data flows

| Token | Hex |
|---|---|
| `--flow-compute` | `#6E519D` |
| `--flow-energy` | `#317A45` |
| `--flow-transfer` | `#007785` |
| `--flow-risk` | `#C13D34` |
| `--flow-policy` | `#657B3D` |

## Type

| Role | Font | Notes |
|---|---|---|
| Headings | Space Grotesk 700 | Display. H2 is 44 px on the site. |
| Body | Manrope 400 / 500 / 600 | |
| Labels | JetBrains Mono 400 / 600 | Uppercase, gold, 11 px |

## Layout and motion

| Token | Value |
|---|---|
| `--radius` | `.125rem` (near-square corners) |
| `--grid-major` / `--grid-minor` | `96px` / `24px` (visible hairline grid) |
| `--ease-institutional` | `cubic-bezier(.22, 1, .36, 1)` |
| `--dur-color` | `.3s` |
| `--dur-surface` | `.7s` |

## Verification (10 Nov 2026)

- Checked against the live stylesheet `/assets/styles-CbV-X4rS.css`: every colour, line, layout and motion token above matches. The flow colours on the site are OKLCH (`--flow-compute: oklch(50% .12 300)` and so on); the hex values above are conversions.
- Fonts load from Google Fonts: Space Grotesk 400–700, JetBrains Mono 400–600, Manrope 300–700. For the offline mode they must be self-hosted (all three are SIL Open Font Licence).
- **The site has no dark theme.** There is no `.dark` palette and no `prefers-color-scheme` rule; even the `/environment` operating surface is ivory. Any dark "Command" theme would be our derivation, not the client's brand, and needs the client's approval before use.
- Screenshots of `/`, `/environment`, `/briefing` and `/tigeris` at 1440 px and 390 px: `docs/brand/screens/`.
