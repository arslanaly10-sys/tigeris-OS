-- 0002 Append-only, hash-chained audit trail (FR-40, TR audit invariants, Q093)
-- Each institution has its own chain. hash = sha256(prev_hash || canonical payload).
-- The application role can only INSERT and SELECT; a trigger also blocks UPDATE/DELETE.

CREATE TABLE audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  seq             bigint NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  actor_type      text NOT NULL CHECK (actor_type IN ('human', 'service')),
  actor_id        text NOT NULL,
  actor_label     text NOT NULL,
  actor_role      text,
  action          text NOT NULL,
  resource_type   text NOT NULL,
  resource_id     text,
  case_id         uuid,
  correlation_id  uuid NOT NULL DEFAULT gen_random_uuid(),
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       text NOT NULL,
  hash            text NOT NULL,
  UNIQUE (institution_id, seq)
);

CREATE INDEX audit_events_case_idx ON audit_events (institution_id, case_id, occurred_at);
CREATE INDEX audit_events_resource_idx ON audit_events (resource_type, resource_id, occurred_at);

CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END $$;

CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_events
  USING (institution_id = app_current_institution())
  WITH CHECK (institution_id = app_current_institution());

GRANT SELECT, INSERT ON audit_events TO tigeris_app;
