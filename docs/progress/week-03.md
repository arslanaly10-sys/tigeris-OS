# Week 3 — Graph, signals and cases

## Working now
- **Intelligence graph:** about 2,270 entities and 3,000 relationships per institution, built from evidence only:
  - **Curated GCC reference geography** (signed package): 171 entities and 385 relationships. Real place names, approximate coordinates, no operators named. Includes the 6 GCC states and neighbours, Hormuz, Bab el-Mandeb, Suez and Malacca, 38 ports and terminals, 11 fields, 6 pipelines, 16 refineries, 20 desalination plants and 21 power plants, 16 cities, 10 airports, routes, commodities and import markets. Capacities are labelled ILLUSTRATIVE.
  - **EIA figures** attached as SOURCED, with lineage: 20 mb/d through Hormuz, 2.6 mb/d of bypass capacity, 84% of crude to Asia.
  - **1,952 sanctioned vessels** from OFAC and UK lists (OBSERVED), linked to their regimes.
  - **Synthetic institution context**, a different file for each institution: mandates and 100 fictional holdings with exposures. Each institution's file is skipped unopened by the other.
- **Impact paths:** direct, second- and third-order effects with link direction, depth limit, cycle protection, cumulative strength and evidence count per link. Bypass pipelines are listed as alternatives. From Hormuz the paths reach terminals, ports, cities and holdings.
- **Graph screen:** search, a one- to three-hop view (link styles differ by claim class), and an entity panel with sourced figures (click for lineage) and every link with its evidence.
- **Signals:**
  - Every signal has a reason it was surfaced and a confidence band built from four named components (source quality, corroboration, freshness, graph coverage). There is no bare percentage.
  - Analysts monitor, dismiss (rationale required) or open a case.
  - **Simulated live feed:** corridor transit counts streamed and labelled SIMULATED, plus presenter buttons that raise labelled simulated events.
  - **Live corroboration moment:** uploading the sample shipping advisory corroborates the open Hormuz signals and lifts their confidence.
- **Cases:**
  - 9 seeded cases per institution: 3 full (Hormuz, resilience, oil USD 45), 4 medium, 2 short. They are spread across the 8 states, so every role has work.
  - Moves are enforced on the server, with PASS / HOLD / BLOCK:
    - wrong role → BLOCK
    - missing rationale or evidence → HOLD
    - the person who opened a case cannot approve it (separation of duties)
  - Every move is written to the case history and the audit trail.
- **Case workspace:**
  - Situation, Evidence (numbers open their lineage), Impact graph, Discussion and History.
  - Placeholders for Scenarios (week 5), Options (week 6) and Decision and memory (week 7).
- **Comments and mentions:** mentioned colleagues are notified. Mentions of people outside the institution are dropped.
- **Notifications** (bell with unread count) and **global search** across cases, signals, entities and evidence.
- **Command Centre** attention queue: what needs this role now, and why.
- **Domains:** the 8 packs with status, entity types and counts.

## Tests
API 36 · shared 6 · web 3 · reasoning 2, all passing. Typecheck clean. Browser walk-through with no console errors.

## Changed during the week
- The graph view now renders without layout animation. The animation was throwing an error when graphs were swapped. Map motion arrives in week 4.
- The live stream is marked "no-transform" so compression does not buffer it.

## Not done / blocked
- Code is still committed locally only (GitHub access, SCOPE B1).
- Docker package not re-verified this week (the daemon stops when the sandbox restarts).

## Next (week 4): live movement map
MapLibre with packaged offline tiles and a 3D globe · about 200 ships and labelled synthetic trucks · ports, pipelines, refineries, desalination, power, airports, corridors, borders and chokepoints · replay timeline and labelled simulated live mode · rerouting around the Cape · map/table toggle · the Command Centre map panel. Needs a source for offline map tiles (SCOPE B4).
