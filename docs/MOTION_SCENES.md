# Build Brief for Claude Code: TIGERIS Live Motion Scenes

> **What this is:** a prompt for Claude Code. Paste it in, or save it as `docs/MOTION_SCENES.md` and tell Claude Code to follow it.
>
> **What it builds:** the 13 TIGERIS theme images, rebuilt as **live, real-time animated scenes** that render in the browser and react to data. Not videos, not GIFs, not animated PNGs.
>
> **How it fits:** it extends the main TIGERIS prototype brief (v3) and follows its rules, especially §2 (data labels), §12 (the AI never produces numbers) and §13 (theme).

---

## 0. Setup (do this first)

```bash
npm install motion
npx motion-ai           # choose: this project · Claude Code
```

- `npx motion-ai` installs Motion's AI Kit for Claude Code:
  - the **`/motion` skill**,
  - the free **`motion` docs MCP server**, which searches current Motion documentation and examples.
- **Before writing any animation code, load the `/motion` skill.** Use the `motion` MCP server to confirm the exact current API for every Motion feature you use (imports, hooks, props). Do not rely on memory of older Framer Motion APIs.
- Import from `motion/react`, not `framer-motion`.
- **Optional (only if I say we have Motion+):** `npx motion-ai --plus` adds the Motion+ server (CSS spring generation, MotionScore audits, transition editor). Do not assume we have it.

### Inputs I will give you

| Input | Put it at | Use it for |
|---|---|---|
| The 13 reference images and their text-free versions | `/public/brand/plates/` and `/public/brand/plates/clean/` | The visual target: the final frame of each scene must match its plate |
| `TOKENS.md` | `/docs/brand/TOKENS.md` | Brand colours, fonts, grid and easing read from tigercapital.ai |
| `render_site.py` and `render_more.py` | `/docs/brand/plate-sources/` | The Python scripts that drew the plates. **Port their exact geometry**: coordinates, seeds, coastlines, radii, angles, label offsets |

---

## 1. Goal

Each image becomes a React scene component with three parts:

1. **An entry sequence** (2–4 s) that builds the picture in front of the viewer.
2. **A calm ambient loop** that keeps it alive without distracting a boardroom.
3. **Data-driven reactions**: when props change (a new signal, an approval, a slider moved), the scene animates to the new state in real time.

The final resting frame of every scene must look like its reference plate. The motion is the plate coming to life, never a different design.

---

## 2. Motion character: institutional, never playful

| Rule | Value |
|---|---|
| Brand easing | `cubic-bezier(.22, 1, .36, 1)` (site token `--ease-institutional`) |
| Durations | Colour changes `.3s`, surfaces and layout `.7s` (site tokens `--dur-color`, `--dur-surface`); entry pieces 0.6–1.4 s |
| Springs | Only for data changes (radar morph, progress arc). High damping, **no visible overshoot or bounce** |
| Ambient loops | Long periods (6–20 s), small amplitudes, offset phases so nothing pulses in unison |
| Stagger | 20–60 ms between siblings; outward from the centre of the composition |
| Colour | Brand tokens only, as CSS variables. Gold for structure, signal blue (`#1447E6`) only for live or active elements, flow colours by meaning |
| Motion vocabulary | Lines draw on (`pathLength`); things grow from their origin; particles flow along real paths. **No** spinning logos, parallax gimmicks, shaking, confetti or glows that flash |

---

## 3. Architecture

### 3.1 Folders

```
/components/scenes/
  primitives/            Grid, SceneChrome (header lockup, section label + rule, Fig. caption, pill), Node, Halo,
                         CurvedEdge, DashedChord, DataLabel, EngravedLines, CanvasLayer
  HorizonScene.tsx       01
  OperatingLoopScene.tsx 02
  ChokepointScene.tsx    03
  CoordinationScene.tsx  04
  LayersScene.tsx        05
  BriefingScene.tsx      06
  ShockScene.tsx         07
  DiagnosisScene.tsx     08
  MemoryScene.tsx        09
  LedgerScene.tsx        10
  GlobalGraphScene.tsx   11
  KernelScene.tsx        12
  UseCasesScene.tsx      13
/lib/motion/tokens.ts    eases, durations, stagger helpers, spring presets (no other place defines timing)
/lib/scene-data/         seeded geometry ported from the Python sources (one file per scene)
/app/scenes/page.tsx     gallery with controls (see §6)
```

### 3.2 Common props for every scene

```ts
type SceneProps = {
  mode?: 'entry' | 'ambient' | 'static'  // default 'entry' then 'ambient'
  playKey?: string | number               // change it to replay the entry
  speed?: number                          // 1 = normal; presenter can slow down
  chrome?: boolean                        // show header, section label, Fig. caption (false = background use)
  onEvent?: (e: SceneEvent) => void       // e.g. 'entry-complete', 'node-click'
}
```

Plus scene-specific data props (§5). Data comes in through props; scenes never fetch.

### 3.3 Rendering rules

- **Coordinates:** each scene uses a fixed `viewBox="0 0 1920 1080"` design space and scales to its container. It must be crisp at 4K and readable on a laptop.
- **SVG** for structure, labels and anything under about 2,500 elements.
- **Canvas** (`<CanvasLayer>`, DPR-aware) for dense particle work: dome dots (01), vessel tracks and moving vessels (03), rising particles (05). Drive canvas from Motion's frame loop (check `useAnimationFrame` in the docs) or Motion values. **No second animation library.**
- **Text:** stays real SVG/HTML text in the site fonts (Space Grotesk, Manrope, JetBrains Mono, self-hosted). Never bake text into canvas.
- **Randomness:** seeded and deterministic, using the same seeds as the Python sources, so the scene matches the plate every time.

### 3.4 Performance and accessibility (non-negotiable)

- **Frame rate:** 60 fps on a 2020+ laptop; under 4 ms of script per frame per scene. Profile it and report the numbers.
- **Off-screen and hidden:** pause all loops when the scene is off-screen (check Motion's `useInView`) or the tab is hidden.
- **What to animate:** transforms, opacity, `pathLength` and `strokeDashoffset` only. No layout-thrashing properties in loops.
- **Reduced motion:** respect `prefers-reduced-motion` (check `useReducedMotion`). Render the final static frame immediately, with no loops and no particles moving. Data changes cross-fade in 150 ms instead of morphing.
- **Pause control:** every scene works with `mode="static"`. A visible pause button pauses all ambient motion in the OS (WCAG 2.2.2).
- **Screen readers:** each scene has `role="img"` and an `aria-label` naming what it shows. Interactive parts (nodes, toggles) are keyboard reachable.
- **Data labels persist** (§2 of the main brief). `ILLUSTRATIVE`, `SYNTHETIC` and `LIVE` labels never animate away. Synthetic motion must never look like a live feed unless the data is live.

---

## 4. Shared primitives (build these first)

- **`Grid`:** the site's 24/96 px hairline grid. Static, or with a slow 0.5 px drift loop (60 s) when `ambient`.
- **`SceneChrome`:** "TIGER CAPITAL AI" lockup, numbered section label with a rule that draws left to right, pill on the right, `FIG. NN — …` caption.
  - Entry: the rule draws (0.7 s), then the labels fade up 6 px.
- **`Node`:** ring plus core in a flow colour.
  - Variants: `idle` | `active` | `pulse`.
  - `pulse` is a halo that scales 1→1.6 and fades over 3–4 s, with a random phase offset.
- **`CurvedEdge`:** a path that can draw on (`pathLength` 0→1) and carry **beads**, small dots travelling along the path at a set speed.
- **`DashedChord`:** a broken line for "fragmented" states. The gaps can drift slowly, and the line can dissolve.
- **`DataLabel`:** the provenance chip (`ILLUSTRATIVE` / `SYNTHETIC` / `MODELLED` / `LIVE`).

---

## 5. Scene-by-scene choreography

Timings are a guide; tune them by eye against the plate.

### 01 Sovereign Horizon (boot)

**Entry (~3.5 s):**
1. The horizon line draws outward from the centre (1.2 s).
2. Skyline buildings rise from the horizon (scaleY from the base), staggered outward from the centre.
3. Dome dots fade in ring by ring, inner to outer.
4. Arcs between nodes draw on.
5. Nodes appear with a soft halo.
6. The TIGERIS letters reveal left to right (y 12 px → 0, opacity), then the step line OBSERVE · REASON · … · LEARN types in.

**Ambient:**
- Each node's halo pulses on its own phase.
- A single bead travels along a random arc every 2–3 s.
- The reflection lines shimmer: a slow horizontal sine offset of ±6 px.
- The step line highlights one word at a time in gold, looping.

**Props:** `activeStep?` locks the highlight to one step.

### 02 Operating Loop

**Entry:**
1. The dial ticks fade in clockwise.
2. Step nodes appear in order 01→12.
3. The gold progress arc draws to `activeStep`.

**Ambient:**
- The dotted spokes of completed steps flow toward the centre (dash offset loop).
- The active node (signal blue) pulses.

**Props:** `activeStep: 1..12`. Changing it animates the arc with a high-damping spring; nodes passed fill gold in sequence.

### 03 Trade Corridor Chokepoint (signal layer)

**Entry:**
1. The panel and grid appear.
2. The coastlines draw on.
3. Land hatching fades in.
4. Tracks draw left to right.
5. The strait marker rings expand in.
6. The callout card slides in.

**Ambient (canvas):**
- Vessel dots travel continuously along the track paths, through the strait, at varied speeds.
- One vessel in four is signal blue.
- Vessels respawn at the start of their track.

**Props:**
- `throughputPct` (0–100): scales how many vessels are moving and how fast.
- `disruption: boolean`: tracks inside the strait shift toward `--flow-risk`; the strait ring pulses; vessels queue and slow before the gap.
- `vessels?: {id, lat, lon, type}[]`: optional live AIS mode. When provided, show these vessels instead of synthetic ones and switch the label to `LIVE`.
  - Keep the projection function in `/lib/scene-data/chokepoint.ts` so a real projection can replace the illustrative one later.

### 04 Coordination Debt, Resolved

**States:** `fragmented` → `resolved`.

**Fragmented:**
- Dashed chords between institutions flicker gently (dash drift).
- No spokes.
- The hub is dim.

**Transition to resolved (1.6 s):**
1. The chords dissolve.
2. Spokes draw from the hub out to each institution (staggered clockwise).
3. The hub ring brightens.
4. The labels settle.

**Ambient (resolved):**
- Beads flow along the spokes in both directions, in each institution's flow colour.
- The hub breathes (scale 1→1.02, 6 s).

**Props:** `state: 'fragmented' | 'resolved'`, `highlight?: institutionId`.

### 05 Architecture Layers

**Entry:**
1. The four planes slide up 24 px and fade in, staggered L1→L4.
2. Grids draw.
3. Labels and leader lines draw.

**Ambient (canvas):**
- A continuous stream of particles rises from L1 through L2 and L3 to L4, thinning at each layer: many in L1, few in L4.
- Particles that reach L4 converge on the apex.
- Each arrival makes the apex pulse once, and "Decision" glows.

**Props:**
- `flowRate`.
- `pulseOnDecision?: number`: increment it to trigger an extra arrival burst when a real decision is approved.

### 06 Briefing (welcome screen)

**Entry:**
1. The sun rises from behind the horizon (translateY, 2.4 s, brand easing).
2. The engraved rings expand from the sun's centre.
3. Reflection lines ripple in under the sun.
4. The headline reveals line by line (mask from y 100%); the third line is gold.
5. The meta line and rule follow.

**Ambient:**
- The rings expand very slowly (20 s loop).
- The reflection shimmers.

**Props:** none beyond the common ones. The copy comes from `/content/client-copy.ts` (§13A of the main brief), verbatim.

### 07 Shock Propagation (simulator)

**Entry:** triggered on mount and whenever `shockKey` changes.
1. A ripple expands from the centre.
2. First-order edges and nodes appear at 0.3 s.
3. Second-order at 1.1 s.
4. Third-order at 1.9 s.
5. Labels fade in after each ring.

**Ambient:**
- Faint ripples keep expanding from the centre every 4 s.
- Beads travel outward along the edges.

**Props:**
- `shockKey`.
- `durationDays`: scales ripple speed and intensity.
- `nodes / edges`: from the engine's `SimulationRun`.
- `highlightOrder?: 1 | 2 | 3`.

**Rule:** values shown on nodes come from the engine. The scene only animates them (main brief §12).

### 08 Gap Diagnosis

**Entry:**
1. The octagon grid draws.
2. The "before" polygon grows from the centre to its values (spring).
3. The right-panel markers slide to position.
4. Scores count up with tabular figures.

**Transition:** `showAfter` toggles to true → the "after TIGERIS" dashed blue polygon morphs out of the before shape. Blue segments draw between the markers on each track.

**Props:**
- `before: number[8]`, `after?: number[8]`, `showAfter: boolean`.
- `label: 'ILLUSTRATIVE' | 'MODELLED'`.

### 09 Institutional Memory

**Entry:**
1. The clusters fade in one after another.
2. Edges draw.
3. The highlighted chain draws node by node; each card appears as the line reaches it.

**Ambient:**
- Nodes drift with small seeded noise (±3 px, 10–16 s), and edges follow.
- Beads travel along the highlighted chain.

**Interaction:**
- Hovering or focusing a node highlights it and its neighbours and dims the rest.
- `query` prop: when a "what did we decide and why" answer returns a path of node IDs, animate a new chain along that path.

**Props:** `graph`, `highlightPath?: string[]`.

### 10 Decision Ledger

**Behaviour:** a live, append-only log.
- New entries enter at the bottom with a layout animation (check `AnimatePresence` and `layout`).
- The row background flashes once in the event's flow colour.
- The timeline line extends to the new node.
- The hash types in character by character.

**Ambient:** none. The ledger should feel still and trustworthy.

**Props:** `entries: LedgerEntry[]`. The scene animates only the difference between old and new entries; entries never reorder or disappear.

### 11 Global Sovereign Graph

**Entry:**
1. The graticule fades in.
2. Capital-pool halos grow.
3. City nodes appear.
4. Arcs draw out from Riyadh, staggered by distance.

**Ambient:**
- A small comet travels along a random arc every 2 s.
- The Miami–Riyadh arc (signal blue) carries a steady bead stream.
- The halos breathe in proportion to pool size.

**Props:** `cities`, `pools`, `hub`, `activeLinks?`.

### 12 One Kernel

**States:** `fragmented` → `unified`.
- **Fragmented:** the left-hand systems drift apart slightly; broken links flicker.
- **Transition to unified:** each system card morphs and travels into its domain node on the kernel (shared-element / `layoutId` style animation; check the docs). The kernel rings draw. "Shared memory · Shared governance · Ledger" fades up.

**Props:** `state`, `autoplay?: boolean` (loops fragmented → unified every 12 s for the investor screen).

### 13 Strategic Use Cases

**Entry:** cards rise in, staggered left to right.

**Each emblem has its own micro-motion:**
- **01 Allocation:** the sleeve arcs rebalance (lengths ease to new fractions).
- **02 Corridor:** lines converge into the strait and release.
- **03 Compute:** chips light in a travelling pattern.
- **04 Diplomacy:** the two circles slide to overlap, and the bridge lines draw.
- **05 Development:** bars grow, then the trend line draws.

**Ambient:**
- Emblem motion plays on hover or focus only.
- Scenario 02's blue top bar has a slow sheen (it is the live golden path).

**Props:** `scenarios` (copy verbatim from client copy), `activeId?`.

---

## 6. Gallery and controls (`/app/scenes`)

- A grid of all 13 scenes. Click one to open it full-screen.
- Controls per scene:
  - Replay entry,
  - mode (`entry` / `ambient` / `static`),
  - speed (0.25× to 2×),
  - simulate reduced motion,
  - a scene's own toggles (e.g. 04 `fragmented` / `resolved`, 08 `showAfter`, 03 `disruption` + `throughputPct` slider, 10 "append entry").
- **Compare mode:** overlay the reference plate PNG at 50% opacity over the live scene, to check alignment.

---

## 7. Where each scene lives in the OS

| Scene | Used in |
|---|---|
| 01 | Boot / splash, and the `/status` preflight page while checks run |
| 02 | Shell loop indicator (large version on the boardroom screen) |
| 03 | Signal Layer background; replaced by the real map when live AIS is on, or used as the "illustrative" fallback |
| 04 | Boardroom: flips to `resolved` when a decision package is approved in the golden path |
| 05 | Kernel page and Investor view |
| 06 | Welcome / Institutional Briefing screen |
| 07 | Simulator |
| 08 | Gap Report |
| 09 | Institutional Memory |
| 10 | Ledger panel |
| 11 | Investor view, operating footprint |
| 12 | Kernel page, Investor view |
| 13 | Mandates catalogue |

**Golden-path wiring** (main brief §11). These events must drive the scenes:

| Event | Scene reaction |
|---|---|
| Hormuz signal | 03 `disruption=true`, 07 `shockKey++` |
| Diagnosis ready | 08 animates in |
| Approval | 10 appends entries, 04 goes `resolved`, 05 `pulseOnDecision++` |

---

## 8. Quality bar and checks

- **Final frame matches the plate:** a Playwright test renders each scene in `static` mode at 1920×1080 and screenshots it next to the plate. A visual diff of positions, colours and type must be close. Keep the diffs in `/docs/brand/motion-review/`.
- **Smoothness:** record a 10-second Playwright trace per scene. Report fps and the longest frame. Fix anything below 55 fps.
- **Reduced motion:** with reduced motion on, every scene shows its final frame instantly and nothing loops.
- **Pausing:** scenes pause off-screen and in hidden tabs. Verify with a test.
- **Optional deliverable:** a script that records each scene's entry plus 8 s of ambient as MP4/WebM (Playwright video) for decks and social. This is a by-product, not the product.

---

## 9. Do NOT

- Ship video files or GIFs as the in-app scenes.
- Add a second animation library (GSAP, anime.js, Lottie) or a 3D engine.
- Invent new visual elements that aren't in the plates without asking me.
- Use colours outside `TOKENS.md`, or fonts other than the site's three.
- Let synthetic motion look like live data, or remove data labels.
- Let any number on screen come from anywhere but props / the engine.
- Use bounce, overshoot or playful easing.

---

## 10. Start here

1. Run §0 setup and confirm `/motion` and the `motion` MCP server are available.
2. Read `TOKENS.md` and both Python plate sources. List the geometry you will port for each scene.
3. Propose the build order. Suggested:
   - primitives,
   - 06 → 01 → 03 → 07 → 08 → 04 → 10 (the Thursday golden path),
   - then 02, 05, 09, 11, 12, 13.
4. Build one scene end to end (06), show it in the gallery next to its plate, and wait for my "go" before the rest.
