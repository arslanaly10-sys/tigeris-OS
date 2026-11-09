-- 0011 Sovereign gap diagnostic (commercial model, steps 1 to 3)
-- One row per assessment: the answers as given, the deterministic result (packages/shared/src/diagnostic.ts)
-- and the hash of its inputs, so a report can be reproduced. Rows are written once and never edited.
CREATE TABLE diagnostic_assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id),
  title             text NOT NULL,
  subject_label     text NOT NULL,
  aum_usd           numeric,
  data_mode         text NOT NULL DEFAULT 'self_assessment' CHECK (data_mode IN ('self_assessment','synthetic')),
  method_version    text NOT NULL,
  answers           jsonb NOT NULL,
  result            jsonb NOT NULL,
  input_hash        text NOT NULL,
  created_by        uuid NOT NULL,
  created_by_label  text NOT NULL,
  created_by_role   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);
CREATE INDEX diagnostic_assessments_recent ON diagnostic_assessments (institution_id, created_at DESC);
ALTER TABLE diagnostic_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON diagnostic_assessments USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution());
GRANT SELECT, INSERT ON diagnostic_assessments TO tigeris_app;
