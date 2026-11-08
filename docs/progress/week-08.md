# Week 8 — Cases and release

## Working now
- **Back-test on real prices.** The collector fetches EIA's daily Brent history (9,122 trading days) and keeps 25 days either side of four supply disruptions: Iraq–Kuwait 1990, Hurricane Katrina 2005, Libya 2011 and Abqaiq 2019. Disruption sizes are analyst estimates, labelled as assumptions. Every price is a sourced fact with lineage.
  - **Result.** The analyst's assumed price response (7.5% per 1% of world supply lost) overstated the historical first-three-day reaction by more than double. The fit is **3.20% per 1%**, about USD 2.56 at USD 80. Average error falls from 16.7 to 7.0 percentage points; leave-one-out error is 11.6.
  - **Adoption.** A domain expert other than the person who ran it adopts the result. Scenarios then use it, and their lineage says "Calibrated by back-test …".
  - **Agents.** The agents re-run a stale baseline after a new calibration is adopted, and rate model calibration medium, not high (few, varied episodes).
- **Reports module:**
  - the latest brief per case with export by audience
  - back-test reports
  - a printable governance report: policy, refusals, decisions, exports with redaction counts, model calls, and audit events by action
- **Architecture page** for investors. It shows a diagram of the data flow inside the institution's boundary with live counts, plus the stack, deployment options, roadmap and buyer categories.
- **Light guided mode.** A Guide button on every screen opens a docked, non-blocking panel with the ten-step demo story. It links to each screen and suggests a role, in English and Arabic. Progress is remembered per browser.
- **Arabic key screens.** Page descriptions for every module, case tabs and states, Command Centre panels and the guide are now in Arabic (draft, labelled). English case content keeps its own direction in Arabic mode, so punctuation sits correctly.
- **Tablet.** iPad portrait and landscape were checked on nine screens, with no horizontal overflow.
- **Laptop and VM packages.**
  - **Contents:** `scripts/package.sh` builds `dist/tigeris-<version>/` (1.6 GB). It holds the images, both local models, the signed data packages, compose files, `install.sh`, a README and SHA256SUMS.
  - **Laptop:** `./install.sh` checks every file, loads the images and starts the stack offline.
  - **VM:** `TIGERIS_DOMAIN=… ./install.sh vm` adds Caddy with automatic TLS and publishes only ports 80 and 443.
  - **Reasoning image:** two stages that compile llama.cpp for generic AVX2 CPUs without apt, so the same image runs on any recent laptop or VM.
- **One-click reset** is now safe while imports run: the reset holds a lock that the import worker respects.
- **Demo script** (`docs/demo-script.md`): a 25-minute talk track keyed to the guide, with setup, fallbacks and what not to claim.

## Verification
- **Docker package, installed from scratch.**
  - All TIGERIS images were deleted, then installed from `dist/` alone. Seeding, the web app, the local model and the embedding model all worked.
  - An agent analysis ran on the containerised local model (106 s uncached). The back-test reproduced exactly.
  - Memory search by meaning worked, and the security posture showed no failures.
- **Automated rehearsal of the full story** on a fresh reset. All 12 steps passed with no console errors: command centre, signal, case, scenarios, back-test adoption, agents, options, review, two-person decision with replay and drift, governance, memory, architecture. The automation took 61 s; the agent step took 26 s with cached model text.
- **Tests:**
  - API 77, including 4 new for the back-test, adoption rules, calibrated lineage, reports and architecture
  - reasoning 14, including 2 new back-test tests with hand-checkable numbers
  - shared 12 and web 3
  - typecheck clean

## Fixed this week
- **Reset deadlock:** a demo reset could deadlock with the import worker; fixed with the shared lock.
- **Container model path:** the reasoning service's default model path assumed the repository layout and crashed in the container; fixed.
- **Docker build:** the image build silently skipped compiler installation when apt failed; the build now fails fast, and apt is no longer needed.
- **Install script:** a quoting error in `install.sh` was caught by the clean-install test.

## Not done / blocked
- **GitHub push (SCOPE B1).** Code is committed locally only.
- **Hosted VM (SCOPE B5).** Not provisioned; the VM path is validated as configuration only. A real TLS certificate needs the DNS name.
- **Live foreign models (SCOPE B3).** Need keys in the deployment environment.
- **Arabic terminology** is our draft until a client reviewer approves it.
