# Live motion scenes (docs/MOTION_SCENES.md)

Ten of the thirteen scenes are built as live Motion scenes and can be seen in the gallery at `/scenes`.

## Built

| # | Scene | Plate | Data props | Ambient |
|---|---|---|---|---|
| 01 | Sovereign Horizon (boot) | file, overlaid | `activeStep` | Node halos pulse; beads on arcs; reflection shimmer; step word highlight |
| 02 | Operating Loop | file, overlaid | `activeStep` 1–12 (arc on a damped spring) | Completed spokes flow inward; active node pulses |
| 04 | Coordination debt | file, overlaid | `state` fragmented/resolved, `highlight` | Beads both ways on spokes; hub breathes |
| 05 | Architecture layers | file, overlaid | `pulseOnDecision` | Particles rise L1→L4 and converge; the apex pulses on arrival |
| 06 | Briefing (welcome) | file, overlaid | — | Rings breathe; reflection shimmers |
| 07 | Shock propagation | inline reference | `shockKey`, `durationDays`, `nodes`/`edges`, `highlightOrder`, label | Ripples every 4 s; beads outward |
| 08 | Gap diagnosis | inline reference | `before`, `after`, `showAfter`, label | None (data morphs only) |
| 09 | Institutional memory | inline reference | `graph`, `highlightPath`; hover and focus | Seeded drift; beads on the chain |
| 11 | Global sovereign graph | inline reference | `cities`, `pools`, `hub`, `activeLinks` | Bead stream Miami–Riyadh; comets; halos breathe |
| 12 | One kernel | inline reference | `state` fragmented/unified, `autoplay` | Systems drift; broken links flicker |

"Inline reference" means the plate image came only inline in chat, not as a file, so it cannot be overlaid in the gallery yet.

## How they are built

- **Coordinates.** Each scene uses a 1920×1080 design space. Scene content is written in the plates' own 2000×1125 pixel coordinates, so values can be read straight off a plate.
- **Shared code.** `components/scenes/kit.tsx` holds the scene frame, nodes, beads along paths, seeded randomness and curves. Timing lives only in `lib/motion/tokens.ts`.
- **Library and rendering.** Motion only, no second animation library. Beads and particles are written to the DOM from Motion's frame loop, so a scene does not re-render 60 times a second.
- **Pausing.** Loops pause off screen, in hidden tabs and under the gallery's global pause.
- **Reduced motion and static mode.** Both show the final frame at once.
- **Numbers.** Values on nodes come only from props. Labels (Illustrative, Synthetic graph, client-site estimate) are part of the chrome and never animate away.

## Frame rate

Measured on the `/scenes` gallery in headless Chromium, ambient mode, 3 s per scene:

- All ten scenes ran at 59–60 fps, with a p95 frame time of 17 ms.
- The worst single frames were 67 ms (scene 01, most likely the switch into it) and 33 ms (scene 11).

## Not built yet

- 03 (Trade corridor chokepoint), 10 (Decision ledger) and 13 (Strategic use cases) have no plate. The brief says not to invent visuals, so they wait.
- The Python plate sources (`render_site.py`, `render_more.py`) have not arrived. Geometry was measured from the plates, so it is close but not exact.
- The scenes are not yet wired into the OS screens (§7 of the brief). The welcome page already uses 06.

## Scenes 03, 10 and 13 (10 Nov 2026): drafts without plates

No plates or plate sources were supplied for these three, so (with the client's go-ahead) they are drawn from the written
brief in the existing scene style and labelled "draft, no plate" in their Fig. captions and in the gallery. When plates
arrive, the final frames are matched to them as for the other ten.

- **03 Trade corridor chokepoint** (`ChokepointScene`): coastlines draw, land hatching fades in, tracks draw west to east,
  strait rings expand, callout slides in. Vessels travel the tracks (one in four signal blue) and respawn; `throughputPct`
  sets how many move and how fast; `disruption` turns the tracks to risk, pulses the strait and makes vessels queue before
  the gap. Synthetic and labelled SYNTHETIC by default; `vessels` shows stored positions instead (labelled REPLAY).
  Geometry and the projection stand-in live in `lib/scene-data/chokepoint.ts`. 60 fps in headless Chromium.
- **10 Decision ledger** (`LedgerScene`): append-only; new rows enter at the bottom, flash once in their flow colour, the
  timeline extends and the hash types in. No ambient motion. Rows never reorder or disappear from the data.
- **13 Strategic use cases** (`UseCasesScene`): five cards rise in left to right; each emblem moves only on hover or
  focus (allocation arcs rebalance, corridor lines converge, compute chips light, diplomacy circles overlap, development
  bars grow then the trend draws). Card 02 (Corridor) is the live golden path with a slow sheen. Copy comes from the
  playbooks in `packages/shared`: Mandate alignment, Energy export continuity, Sovereign intelligence not borrowed,
  National programme coordination, Domestic industrial capability. Cards are keyboard-focusable and report the playbook key.
