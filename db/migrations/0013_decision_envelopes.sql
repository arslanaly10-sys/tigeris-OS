-- 0013 Decision envelopes (Playbook "decision velocity"; FR-34, FR-35, TR-046)
-- A committee pre-approves an envelope once: domain, the authority it delegates, a size limit, who may authorise
-- inside it and an expiry. A decision that fits needs one named authoriser instead of the committee's approvals.
-- Proposed by one person, activated by a different one; revocable; every step audited. Nothing executes.
CREATE TABLE decision_envelopes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id),
  name              text NOT NULL,
  mandate           text NOT NULL,
  domain            text NOT NULL,
  authority         text NOT NULL,
  max_var_usd       numeric NOT NULL CHECK (max_var_usd > 0),
  authoriser_roles  text[] NOT NULL CHECK (cardinality(authoriser_roles) > 0),
  expires_at        timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','active','revoked')),
  data_mode         text NOT NULL DEFAULT 'institution' CHECK (data_mode IN ('institution','synthetic')),
  proposed_by       uuid NOT NULL,
  proposed_by_label text NOT NULL,
  activated_by      uuid,
  activated_by_label text,
  activated_at      timestamptz,
  activation_note   text,
  revoked_by_label  text,
  revoked_at        timestamptz,
  revoke_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  CHECK (status <> 'active' OR activated_by IS DISTINCT FROM proposed_by)
);
CREATE INDEX decision_envelopes_status_idx ON decision_envelopes (institution_id, status, expires_at);
ALTER TABLE decision_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_envelopes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON decision_envelopes USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution());
GRANT SELECT, INSERT, UPDATE ON decision_envelopes TO tigeris_app;

ALTER TABLE decisions ADD COLUMN envelope_id uuid;
ALTER TABLE decisions ADD CONSTRAINT decisions_envelope_fk FOREIGN KEY (institution_id, envelope_id) REFERENCES decision_envelopes(institution_id, id);
