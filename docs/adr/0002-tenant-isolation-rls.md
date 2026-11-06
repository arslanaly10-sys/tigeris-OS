# ADR-0002 Institution isolation with PostgreSQL row-level security

Status: accepted · 6 Nov 2026

Context: FR-42 and the sovereignty requirements forbid any cross-institution read. The demo has two institutions to prove it (Q024).

Decision: every institutional table carries `institution_id`, has RLS enabled and FORCED, and uses composite foreign keys. The app connects as a non-owner role without BYPASSRLS and sets `app.institution_id` transaction-locally inside `withTenant()`. Pre-sign-in directory access uses a SECURITY DEFINER function that returns demo principals only.

Consequences: a missing tenant scope returns no rows rather than leaking. Isolation is checkable live from Governance & Audit and is covered by tests.
