-- 0014 Engagements, rubric inputs and value assumptions (brief v3 §3, §4, §7.1)
-- An engagement is one institution's briefing → workshop → report → blueprint → pilot. Its rubric inputs and value
-- assumptions are edited live in workshop mode; every edit is an audit (Ledger) event in the same transaction.
CREATE TABLE engagements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  title            text NOT NULL,
  intake           jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'briefing' CHECK (status IN ('briefing','workshop','report','blueprint','pilot')),
  data_mode        text NOT NULL DEFAULT 'institution' CHECK (data_mode IN ('institution','synthetic')),
  rubric_version   text NOT NULL,
  created_by_label text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);
CREATE TABLE engagement_inputs (
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  engagement_id    uuid NOT NULL,
  metric_id        text NOT NULL,
  value            double precision,
  source           text NOT NULL DEFAULT '',
  label            text NOT NULL CHECK (label IN ('synthetic','workshop','client')),
  updated_by_label text NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (engagement_id, metric_id),
  FOREIGN KEY (institution_id, engagement_id) REFERENCES engagements(institution_id, id)
);
CREATE TABLE engagement_assumptions (
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  engagement_id    uuid NOT NULL,
  key              text NOT NULL,
  value            double precision NOT NULL,
  source           text NOT NULL,
  benchmark_status text NOT NULL CHECK (benchmark_status IN ('placeholder','unverified','sourced')),
  updated_by_label text NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (engagement_id, key),
  FOREIGN KEY (institution_id, engagement_id) REFERENCES engagements(institution_id, id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['engagements','engagement_inputs','engagement_assumptions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO tigeris_app', t);
  END LOOP;
END $$;
