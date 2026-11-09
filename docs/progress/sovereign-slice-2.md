# Sovereign intelligence, slice 2: map icons and aircraft (9 Nov 2026)

## Working now
- **Silhouettes instead of dots and arrows** (`apps/web/src/components/map-icons.ts`): top-down outlines that turn with
  each heading: crude and product tankers (deck line, bridge), LNG carriers (domes), container ships (coloured stacks),
  bulk carriers (hatches), tugs, passenger ships, fishing boats, trucks, and wide-body, narrow-body and freighter
  aircraft. Holding ships are drawn hollow, rerouted ships carry a dashed ring, and real ships and aircraft carry a
  solid ivory ring, so status and source read by shape, not colour alone. Icons grow as you zoom in.
- **Infrastructure symbols:** ports (anchor), refineries and fields (column and flare), desalination (drop), power
  (bolt), airports (plane) and chokepoints (ring).
- **Map key** in the layers panel, drawn with the same functions as the map.
- **Simulated flights:** 60 fictional flights on 11 approximate Gulf air corridors (to Europe, India, Asia, East Africa
  and between hubs), moving on the live clock; labelled synthetic.
- **Real flights:** `pnpm --filter @tigeris/collector adsb` queries adsb.lol (open data, ODbL) around six Gulf hubs,
  keeps airline flights only (private and general aviation dropped, as they can identify individuals) and writes a
  signed package. First capture: 106 airline flights from 333 aircraft reports. Imported as observed facts with
  lineage; each aircraft moves on its last track and speed for at most 20 minutes, labelled as an estimate.
- **New layers:** observed aircraft (ADS-B), simulated aircraft, air corridors; a table tab for observed aircraft; a
  details drawer per aircraft. Transport and aviation, defence and security, healthcare (and supply chain for real
  flights) switch them on through the industry lens.
- **Sign-in:** the backdrop shows the same ship silhouettes plus simulated flights.

## Verification
- Tests: API 86 (2 new for ADS-B import and lineage), shared 24 (3 new: flights, ADS-B summary), web 3; typecheck clean.
- 12-step rehearsal passes, no console errors.
- Screenshots in `docs/screenshots/slice2/`.

## Notes
- ADS-B packages, like AIS packages, are captured locally and not committed. Attribution: contains information from
  adsb.lol, made available under the ODbL.
- Next: slice 3 (Sovereignty module) needs the McKinsey article text.
