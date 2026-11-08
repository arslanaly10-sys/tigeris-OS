# Week 5 — Reasoning and scenarios

## Working now
- **Deterministic scenario engine** (Python, `services/reasoning/app/engine.py`). No language model writes a number.
  - Route availability follows a shock-and-recovery curve set by the drivers.
  - Gross loss = flow × (1 − availability). Usable pipeline bypass absorbs part of it, and the rest is the net shortfall.
  - The oil price premium scales with the shortfall as a share of world supply. World supply is derived from the EIA flow (20 mb/d) and share (20%) facts.
  - Holdings exposed through the graph lose value by path strength × sector sensitivity × severity, plus price and rate effects.
  - Staple reserve cover runs down while imports are disrupted.
- **Four horizons** (72 h, 90 d, 1 y, 5 y) with six measures each: net shortfall, oil price, oil volume lost, GCC crude export revenue change, portfolio value at risk, and lowest reserve cover. There is also war-risk insurance cost per tanker transit.
- **Seven adjustable drivers:** duration, base oil price, route availability, insurance premium, reserve buffer, rate/FX shock and demand change.
- **Monte Carlo ranges:** 200 seeded draws per scenario over the uncertain parameters give P10/P50/P90. The deterministic value is shown alongside.
- **Day-by-day cascade to day 150:** availability, gross loss, bypass, net shortfall, price, cumulative loss and reserve cover.
- **Structural resilience score** (0–100) with five components, each with its basis in words: size of the hit, speed of recovery, reserve buffers, alternatives available, and concentration.
- **Sensitivity:** which drivers move 90-day value at risk most.
- **Templates per case:** Hormuz, resilience, oil at USD 45, Red Sea, banking, food and pandemic. Each case uses its own template and its own institution's facts and graph.
- **Baseline plus two alternatives side by side** in the case Scenarios tab, with sliders for every driver.
- **Lineage for every scenario number:** formula, the facts used (each opens its own source lineage), and every assumption with its basis, engine version and input hash.
- **Replay:** recomputes a stored run from its saved input and confirms all 25 numbers are identical.
- **Charts** use the validated data-viz palette:
  - one axis, a hover crosshair and tooltip, a legend plus direct labels, and a different line style per series
  - a table view on every chart
  - P10–P90 range bars in the comparison table
- **Scenarios & Foresight module:** every saved comparison across the institution, linked to its case.
- Every run is audited and added to the case history. Runs, assumptions and results are write-once.

## Example (seeded Gulf Sovereign Fund, Hormuz case)
| | Baseline (30 days, 60% availability) | Longer closure (90 days, 35%) | Short disruption (7 days) |
|---|---|---|---|
| Resilience score | 65 | 42 | 69 |
| Net shortfall, first 72 h | 3.6 mb/d | 6.1 mb/d | 3.6 mb/d |
| Average oil price, first 72 h | USD 101 | USD 116 | USD 101 |

These are scenario outputs from stated assumptions, not forecasts. The price response parameter is an analyst assumption until back-testing in week 8 calibrates it.

## Tests
- API 42, including 5 new scenario tests: three-way comparison, lineage to EIA facts, identical replay, permissions and isolation, and the oil USD 45 template.
- Reasoning 9 new engine tests, including a hand-checkable shortfall: 20 × 40% − 2.6 × 0.85.
- Shared 12, web 3. All passing; typecheck clean; browser walk-through with no console errors.
- CI and Docker now start the reasoning service.

## Not done / blocked
- Code is still committed locally only (GitHub access, SCOPE B1).
- Docker package not re-verified (the daemon stops when the sandbox restarts).
- The Red Sea flow (8.6 mb/d) is an assumption, labelled as such, until an EIA Red Sea source is added to the evidence base.

## Next (week 6): AI and agents
Model gateway (Claude, OpenAI and a local open-weight model) with the offline switch and outbound blocking, ten bounded agents with full run traces and cost, a visible agent debate step, plain-language questions over the graph, "Ask TIGERIS" inside a case, and the executive brief writer. Needs API keys for Anthropic and OpenAI and a download of the local model (SCOPE B3, B4).
