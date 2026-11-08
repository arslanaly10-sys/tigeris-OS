# TIGERIS · Sovereign Intelligence OS — working rules for Claude Code

## What this is
An institution-owned intelligence and decision layer for sovereign institutions. Demo build (8 weeks) per `docs/SCOPE.md`.
Requirement IDs (FR-xx, TR-xxx, AC-xx, Qxxx) come from the requirements register and the build questionnaire. Reference one in every change.

## Layout
- `apps/web` Next.js 15 + React 19 + Tailwind 4. Follow `DESIGN.md` (surface ladder, scarce gold, Plex Sans UI, serif titles). Tokens in `src/app/globals.css`. Dark is default.
- `apps/api` Fastify TypeScript core. Routes in `src/routes`. Guard every protected route with `requirePermission(...)`.
- `packages/shared` roles, permission matrix, labels (data classes, classifications, case states).
- `services/reasoning` Python FastAPI. All numbers are calculated here or in deterministic TS code, never by a model.
- `db/migrations` plain SQL, applied in order by `pnpm db:migrate`. Never edit an applied migration; add a new one.

## Non-negotiable rules
1. Every institutional table has `institution_id`, row-level security with FORCE, and composite FKs. Query tenant data only through `withTenant()`.
2. The app connects as `tigeris_app` (no BYPASSRLS). The owner pool is for migrations, seed and reset only.
3. Every protected mutation writes an `appendAudit()` event in the same transaction. The audit table is append-only.
4. No external action executes. Recommendations need a named human decision.
5. No model is the source of truth for data, arithmetic, policy or authority. Model text must cite evidence or be marked unverified.
6. No external network call from the product unless the policy and offline switch allow it. Default is outbound off.
7. Every displayed number links to its lineage, or is suppressed / marked UNVERIFIED. Synthetic data is always labelled.
8. Never show target institutions (PIF, Mubadala, ADIA, Aramco) by name; use buyer categories. Institutions and people are fictional.
9. Copy follows the Foundation voice: no "predicts", "fully autonomous", "real-time intelligence", "guaranteed".
10. Every model call goes through `apps/api/src/ai/gateway.ts` (allowlist, foreign switch, classification ceiling, egress, key). Agents get numbers from tools only; their text passes `verifyText()` or is shown UNVERIFIED.
11. Status is never colour alone. Respect reduced motion. Keep nav and key screens Arabic-ready (RTL, logical CSS properties: `ms-`, `me-`, `start-`, `end-`).

## Commands
```
pnpm install
pnpm db:migrate && pnpm db:seed     # local PostgreSQL 16 + pgvector
pnpm dev                            # web :3000, api :4000
pnpm typecheck && pnpm test         # API tests need the database
cd services/reasoning && .venv/bin/pytest -q
docker compose up --build           # full package
```
