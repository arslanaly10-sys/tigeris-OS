# ADR-0004 Background jobs in PostgreSQL

Status: accepted · 6 Nov 2026

Context: ingestion, agent runs and scenario runs are asynchronous (TRD §11.2). Q115 left the choice to us. Temporal adds an extra service and is harder to run offline.

Decision: a PostgreSQL-backed job table using `SELECT … FOR UPDATE SKIP LOCKED`, with idempotency keys and bounded retries, introduced in week 2.

Consequences: no extra infrastructure; jobs are institution-scoped and audited like everything else. Revisit if throughput or long-running workflows outgrow it.
