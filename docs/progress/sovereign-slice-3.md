# Sovereign intelligence, slice 3: the Sovereignty module (9 Nov 2026)

## Working now
- **Sovereignty module** (Control → Sovereignty, `/sovereignty`), English and draft Arabic labels.
- **Sovereignty stack:** six layers, each answering one question, every line checked live against the running system:
  compute and hosting; data; models; keys and cryptography; applications and decisions; people and oversight.
  A layer is "sovereign" when every check passes, "partly sovereign" while any item is a warning or planned, and
  "at risk" on any failure. Today: 3 of 6 fully sovereign (models, applications, people); compute, data and keys are
  partly sovereign because confidential computing, encryption at rest and HSM key custody are planned for the pilot.
- **Data and keys:** an inventory of the cryptography in use (collector Ed25519 package signature with its trusted
  fingerprint, SHA-256 audit chain with its head hash, per-file evidence hashes, session token hashing, model-weight
  hash), each with purpose, custody and whether it is quantum-resistant. Ed25519 is flagged as the one item to migrate.
- **Planned for the pilot, never shown as working:** HSM key custody, encryption at rest, confidential computing and
  post-quantum cryptography, each with what it needs (e.g. FIPS 140-3 HSM and a key ceremony; Intel TDX or AMD SEV-SNP
  with attestation; ML-DSA and ML-KEM per NIST FIPS 204 and 203).
- **Command Centre panel:** the six layers at a glance under the attention queue, linking to each layer.

## Sources
- Concepts from the client's links: sovereign.ai (on-premises and air-gapped deployment, source provenance,
  human decisions, data pinned to a region) and Fortanix (keys under the institution's jurisdiction, confidential
  computing, post-quantum readiness, provable compliance). No brand, wording or figures copied.
- The McKinsey explainer could not be downloaded (the site refused automated access). The layering is TIGERIS's own
  framework and is labelled so on the page; it will be aligned with the McKinsey text when the client supplies it.

## Verification
- Tests: API 89 (3 new: layer statuses follow their checks; planned items never pass; cryptography inventory),
  shared 24, web 3; typecheck clean; 12-step rehearsal passes, no console errors.
- Screenshots in `docs/screenshots/slice3/`.

## Next
- Slice 4: voyage anomalies (going dark, loitering, ship-to-ship transfer, route deviation, AIS spoofing) on scripted
  simulated ships and real AIS, and intelligence correlation with source packages (the third Sovereignty tab).
