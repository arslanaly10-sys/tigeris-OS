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
Reasoning service:
```bash
cd services/reasoning && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000
```

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
