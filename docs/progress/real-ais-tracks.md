# Real AIS tracks (9 Nov 2026) · FR-30, Q086

## Working now
- The collector keeps each ship's track in the capture window (one report a minute, at most 720 points). The
  default window is 30 minutes, up to 6 hours (`--minutes`).
- Import stores the track as an `ais_track` fact with lineage, next to the latest position, speed and destination.
- The Movement Map draws observed tracks as lines under the observed-ship layer.
- The voyage checks used on the scripted ships (going dark, loitering, ship-to-ship meeting, position jumps) also
  run on real tracks. Anything found becomes an OBSERVED signal and joins intelligence correlation, linked to the
  capture. Ships reporting "At anchor" or "Moored" are not flagged as loitering.

## What the capture actually holds
- A 2-hour capture (11:44–13:44 UTC, 9 Nov) received 20 messages from 6 vessels inside the Hormuz box.
- One vessel (the dredger HAM 318) has a real track: 12 reports over 51 minutes. The other five sent one report each.
- No real anomaly was found: the checks need longer tracks (90 minutes for going dark, 3 hours for loitering).
  The anomalies on the map still come from the six scripted fictional ships and stay labelled simulated.

## Honest limits
- aisstream.io's coverage near Hormuz depends on volunteer receivers and is thin; the same window over a busy
  European strait returns thousands of reports. A commercial or satellite AIS feed would be needed for a real picture.
- AIS packages are not committed (aisstream.io terms); run the collector with your own key.
