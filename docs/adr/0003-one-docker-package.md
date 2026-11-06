# ADR-0003 One Docker Compose package for laptop and cloud VM

Status: accepted · 6 Nov 2026

Context: the demo is delivered as a hosted link and an offline laptop package (Q006). A real local model and a Python service cannot run on Vercel, so the hosted version runs on a cloud VM (follow-up decision).

Decision: a single `docker-compose.yml` (PostgreSQL + pgvector, seed job, API, reasoning, web) runs unchanged on both. Map tiles and the local model will be packaged into the images or volumes so the laptop works with no network.

Consequences: hosted and offline behave identically. The VM provider is a pending decision (SCOPE B5).
