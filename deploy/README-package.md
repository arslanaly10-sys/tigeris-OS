# TIGERIS demonstration package

Everything needed to run the demo without internet access: container images, the two local model
files, the signed data packages and the compose files.

## Requirements
- Docker Engine 24+ with Compose v2; 8 GB RAM (16 GB recommended); 10 GB free disk; an x86-64 CPU with AVX2.
- No internet access is needed. Foreign models stay off unless keys are set and an administrator allows them.

## Laptop
```
./install.sh
```
Open http://localhost:3000 after about a minute (`docker compose logs -f seed` shows progress).
Use `WEB_PORT=3100 ./install.sh` if port 3000 is taken.

## Hosted VM
Point a DNS name at the VM, open ports 80 and 443, then:
```
TIGERIS_DOMAIN=demo.example.org ./install.sh vm
```
Caddy obtains the TLS certificate automatically; the app is served only over HTTPS.

## Optional foreign models
Add to `.env` before starting, then enable the provider in Governance & Audit → AI models:
```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

## Integrity
`install.sh` checks every file against `SHA256SUMS` before loading anything.

## Stop, reset, remove
- Stop: `docker compose down`
- Reset the demo: header menu → Reset demo, or `docker compose run --rm seed`
- Remove everything, including data: `docker compose down -v`
