# Sovereign intelligence, slice 4: voyage anomalies and intelligence correlation (9 Nov 2026)

## Working now
- **Voyage anomaly detectors** (`packages/shared/src/anomalies.ts`): fixed, explainable rules over position tracks,
  each finding carrying the numbers it rests on: going dark (AIS gap over 90 min), loitering (within 3 nm at 3 kn or
  less for 3 h), ship-to-ship meeting (two ships within 0.5 nm at 1.5 kn or less for 90 min), route deviation (over
  12 nm from the declared corridor) and AIS spoofing (jumps implying over 45 kn). Ships and aircraft only.
- **Six scripted fictional ships** act out one behaviour each on a daily cycle near Hormuz (Northern Tide goes dark,
  Amber Crest and Cedar Light meet at sea, Desert Venture loiters, Silver Horizon leaves its corridor, Coral Navigator's
  positions jump). The detectors find exactly those five behaviours; a ship alongside another is reported once as a
  ship-to-ship meeting, not also as loitering.
- **Signals:** one SIMULATED signal per anomaly (defence and security, insurance, supply chain); spoofing and the AIS
  gap are added to the "Navigation safety and AIS spoofing near Hormuz" case.
- **Movement Map:** a "Voyage anomalies" layer: the scripted ships with a double red ring (drawn hollow while their
  AIS is off) and a warning marker per anomaly (D, L, S, R, J), each opening a details panel with the window, metrics
  and a link to its signal. On for energy, defence, insurance and supply chain.
- **Intelligence correlation** (Sovereignty, third tab): signals and anomalies in the same area and 72-hour window are
  weighed against three competing hypotheses (deliberate interference, sanctions evasion or concealed transfers,
  ordinary causes) in an Analysis of Competing Hypotheses matrix. Ranking follows the fewest inconsistencies; equal
  scores share a rank and the finding says the evidence cannot yet separate them. Confidence depends on how many
  independent kinds of evidence agree and whether any is observed; simulated and synthetic inputs are labelled.
- **Source packages:** each finding downloads as a JSON source package (members, matrix, method and thresholds,
  evidence lineage with file hashes, a notice that it supports a human judgement) with a SHA-256 content hash; every
  export is recorded on the audit chain (`correlation.package_exported`).

## Honest limits
- Real AIS currently keeps each ship's latest report only, so the track-based detectors cannot yet assess real ships;
  the anomalies shown come from the scripted fictional ships and are labelled simulated. A longer AIS capture that keeps
  tracks is the next step for real detections.
- With only simulated and synthetic inputs, correlation confidence is capped at medium.

## Verification
- Tests: API 93 (4 new: detections and signals, case corroboration, correlation ranking and tie, package hash and
  audit), shared 30 (6 new detector tests), web 3; typecheck clean; 12-step rehearsal passes, no console errors.
- Screenshots in `docs/screenshots/slice4/`.
