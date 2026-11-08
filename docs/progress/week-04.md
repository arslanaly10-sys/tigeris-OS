# Week 4 — Live movement map

## Working now
- **Fully offline basemap.** Natural Earth outlines (public domain) ship with the app as about 1.4 MB of GeoJSON. There is no tile server and no network call, so the map works on the air-gapped laptop. Dark map style (Q080) that opens on the whole GCC (Q081).
- **About 200 fictional ships** on approximate real shipping lanes: Gulf trunk through Hormuz, export spurs from Ras Tanura, Ras Laffan, Das Island, Jebel Ali and Hamad, routes to India and Asia, the Red Sea to Suez, and Fujairah and Sohar outside the strait.
  - Types: crude, product, LNG, container and grain carriers.
  - Arrows point along each ship's course; holding and rerouted ships are drawn differently.
- **40 labelled synthetic trucks** on 8 real road corridors (Dammam–Riyadh, Riyadh–Jeddah, Jebel Ali–Ruwais, Fujairah–Dubai, Sohar–Muscat and more).
- **Infrastructure layers** from the intelligence graph:
  - ports and terminals, refineries and fields, desalination and power plants, airports, chokepoints, borders and labels
  - pipelines with approximate routes: East-West, Habshan–Fujairah, Goreh–Jask, Dolphin, Saudi–Bahrain, SUMED
- **Replay** of a 24-hour day with play, pause, scrub and 1×/10×/60× speed. **Simulated live** follows the Riyadh clock. Both are clearly labelled.
- **Scenario overlays:**
  - *Hormuz disruption:* about 40% of ships on Hormuz lanes hold at anchorages either side of the strait. Transits counted across the strait drop from 32 to 21 in 24 h.
  - *Red Sea rerouting:* Red Sea traffic moves onto the Cape of Good Hope route, drawn dashed (54 ships rerouted).
- **3D globe** toggle (shows the Cape detour).
- **Signal ripples** at the entities of active signals. Each pulses twice, then holds; reduced motion shows the ring only. Clicking one opens the signal.
- **Selection drawer.**
  - Infrastructure: graph details, sourced figures with lineage, links, and "Open in the intelligence graph".
  - Ships and trucks: simulation id, route, speed and position, with a notice that the vessel is fictional and represents no real ship.
- **Map/table toggle:** every ship, truck and asset as an accessible table.
- **Command Centre** now shows the map (simulated live) beside the attention queue.
- Status strip always shows mode, SYNTHETIC MOVEMENT, active scenario, clock, Hormuz transits against baseline, and holding or rerouted counts.

## Honesty rules applied
No real vessel is tracked: names are fictional and ids are SIM-Vnnn. Coordinates are approximate. Live AIS and fleet telemetry are pilot-stage items, connected only after rights and deployment approval.

## Tests
API 37 · shared 12 (6 new movement-simulation tests: determinism, speed, Hormuz holding and transit drop, Cape rerouting) · web 3 · reasoning 2, all passing. Typecheck clean. Browser walk-through with no console errors.

## Fixed during the week
MapLibre sets its own positioning on the map element, which collapsed the container to zero height. It is now sized directly.

## Not done / blocked
- Code is still committed locally only (GitHub access, SCOPE B1).
- Docker package not re-verified (the daemon stops when the sandbox restarts).

## Next (week 5): reasoning and scenarios
Python reasoning engine: bounded propagation over the graph, deterministic calculators, the four horizons (72 h / 90 d / 1 y / 5 y), the day-by-day Hormuz cascade to about day 150, seven adjustable drivers, Monte Carlo ranges, the structural resilience score, and baseline plus two alternatives side by side, connected to the case Scenarios tab.
