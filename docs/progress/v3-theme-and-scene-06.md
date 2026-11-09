# Brief v3: client theme, welcome screen and scene 06

## Theme
- The whole app now uses tigercapital.ai's own tokens (docs/brand/TOKENS.md):
  - ivory surfaces on the site's 24/96 px hairline grid;
  - one gold accent and the blue signal colour;
  - near-square corners;
  - Space Grotesk, Manrope and JetBrains Mono, all self-hosted.
- The client has no dark theme, so the theme toggle is gone.
- Contrast is AA on every surface; `test/contrast.test.ts` enforces it.
- Page headers carry the site's numbered mono eyebrow with a hairline rule.
- The map is restyled to an ivory cartographic palette using the site's flow colours.

## Welcome screen (`/`, then `/welcome`)
- All client copy is verbatim from `apps/web/src/content/client-copy.ts`:
  - the invitation;
  - the four principles, each with a "See it in the OS" link to where the prototype demonstrates it;
  - the five use cases (only 02, the Hormuz corridor, is marked as running; the others say "Available in pilot");
  - the two engagement formats;
  - the disclaimer.
- The golden-path tenant is now "GCC Sovereign Fund A".

## Scene 06 · Briefing (docs/MOTION_SCENES.md)
- A live Motion scene in a 1920×1080 design space, matched to the reference plate. Geometry was measured from the plate, because the Python plate sources have not arrived yet.
- **Entry:**
  - the horizon draws;
  - the sun rises from behind it;
  - the rings expand;
  - the skyline rises outward from the sun;
  - the reflection ripples in;
  - the headline reveals line by line under a mask, with the third line in gold;
  - the rule and the meta line follow.
- **Ambient:** slow ring breathing and a reflection shimmer.
- **Accessibility and loops:** loops pause off screen, in hidden tabs, and under the global pause. Reduced motion and `mode="static"` show the final frame at once.
- **Gallery:** `/scenes` has replay, mode, speed, simulated reduced motion, pause, and a 50% plate overlay.
- The live scene is the welcome hero and, without its chrome, the sign-in figure.

Screenshots: `docs/screenshots/v3/`.
