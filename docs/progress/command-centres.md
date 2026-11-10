# Sector Command Centres

Eight sector screens built from the supplied mockups as routes inside the app:
`/command-centres/<sector>` for supply-chain, real-estate, manufacturing, infrastructure, sovereign-capital, energy,
banking and insurance. `/command-centres#energy` (or any sector hash) resolves to the sector route.

- One config (`apps/web/src/lib/command-centres.ts`) and one renderer per block type (`components/command-centre.tsx`).
- No numbers: metrics show "—" with "Source not connected", charts are empty states, specialists show "Awaiting data",
  mandate items show "Approval required". Maps and skylines are illustrative crops of the mockups, labelled in alt text.
- Every button opens a dialog; nothing executes. Nav items other than Sovereign Overview say "Available in the pilot".
- EN | العربية switches the screen to `dir="rtl"`; copy stays English until Arabic copy is supplied.
- Layout: 12 columns, 2 columns under 1100px, 1 column under 640px; sidebar becomes a drawer under 900px.
- Checked at 1440, 1024 and 390px: no horizontal overflow, no console errors, 30 of 30 action buttons on Real Estate open a dialog.

Screenshots at 1440px are in `docs/progress/command-centres/`.
