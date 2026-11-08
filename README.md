# TIGERIS · Sovereign Intelligence OS

Demonstration build of an AI-native sovereign intelligence operating system: validated evidence, a shared intelligence graph, governed multi-horizon reasoning and named human decisions, inside each institution's own boundary.

Confidential · Client IP. All institutions and people in this build are fictional; data is public snapshots plus clearly labelled synthetic data.

## Run it

### Docker (laptop or cloud VM)
```bash
docker compose up --build
```
Open http://localhost:3000, choose an institution, then either the simulated SSO or the demo entry. The MFA step shows a demo code.

### Local development
Requirements: Node 22, pnpm 10, Python 3.13, PostgreSQL 16 with pgvector.
```bash
psql -U postgres -f db/init/00-roles.sql
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```
Reasoning service (needed for scenarios and for the API tests):
```bash
cd services/reasoning && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000
```

## Models (week 6)
The agents run on a local open-weight model by default; nothing leaves the host.
```
mkdir -p data/models
curl -L -o data/models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf
services/reasoning/.venv/bin/pip install -r services/reasoning/requirements-llm.txt
```
Memory search also uses a small local embedding model:
```
curl -L -o data/models/bge-small-en-v1.5-q8_0.gguf \
  https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/resolve/main/bge-small-en-v1.5-q8_0.gguf
```
On an air-gapped machine, copy the same files into `data/models/` (sha256 `6a1a2eb6…407e`). Without it the agents
use the deterministic writer. Foreign models are optional and off by default: set `ANTHROPIC_API_KEY` and/or
`OPENAI_API_KEY` (plus `OPENAI_MODEL`) in the deployment environment, then an administrator must put the provider on
the allowlist, switch foreign models on, allow outbound access and set the classification ceiling in Governance & Audit.

## Offline package (laptop or VM)
```
TIGERIS_VERSION=demo docker compose build
scripts/package.sh demo          # → dist/tigeris-demo/ (images, models, data, install.sh)
```
Copy the folder to the target machine and run `./install.sh` (laptop) or `TIGERIS_DOMAIN=… ./install.sh vm`.
See `deploy/README-package.md` and the demo talk track in `docs/demo-script.md`.

## Refresh the public data snapshot
The collector runs outside the sovereign boundary and writes a signed package to `data/packages/`. Import it from Data & Sources, or run `pnpm db:seed` to reset and import.
```bash
pnpm --filter @tigeris/collector collect
pnpm --filter @tigeris/collector demo-docs   # regenerates the two synthetic demo PDFs
pnpm --filter @tigeris/collector reference   # re-signs the reference geography and synthetic institution packages
```

## Tests
```bash
pnpm typecheck
pnpm test
cd services/reasoning && .venv/bin/pytest -q
```

## Repository
| Path | Purpose |
|---|---|
| `apps/web` | Next.js web app: sign-in, OS shell, modules |
| `apps/api` | TypeScript API: identity, sessions, audit, governance |
| `packages/shared` | Roles, permission matrix, shared labels |
| `tools/collector` | External collector: fetches public sources and signs a transfer package |
| `services/reasoning` | Python deterministic reasoning: horizons, propagation, scenarios |
| `db/migrations` | SQL migrations with row-level security |
| `docs/SCOPE.md` | Locked demo scope and the 8-week plan |
| `docs/adr` | Architecture decision records |
| `docs/progress` | Weekly progress notes |
