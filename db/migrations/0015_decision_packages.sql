-- 0015 Decision packages and their tasks (brief v3 §6): governor question → brief → package → approval → owners.
CREATE TABLE decision_packages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES institutions(id),
  engagement_id      uuid NOT NULL,
  question           text NOT NULL,
  brief              jsonb NOT NULL,
  facts              jsonb NOT NULL,
  recommended        text NOT NULL,
  authority_required text NOT NULL,
  authority_rule     text NOT NULL,
  authority_role     text NOT NULL,
  approval_threshold text NOT NULL,
  status             text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','changes_requested')),
  prompt_version     text NOT NULL,
  model              text NOT NULL,
  input_hash         text NOT NULL,
  created_by_label   text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  decided_by_label   text,
  decided_at         timestamptz,
  decision_comment   text,
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, engagement_id) REFERENCES engagements(institution_id, id)
);
CREATE TABLE package_tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  package_id       uuid NOT NULL,
  action           text NOT NULL,
  owner_label      text NOT NULL,
  due_at           timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, package_id) REFERENCES decision_packages(institution_id, id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['decision_packages','package_tasks'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO tigeris_app', t);
  END LOOP;
END $$;
-- Inputs measured by the product itself (e.g. signal-to-owner latency when a package is approved).
ALTER TABLE engagement_inputs DROP CONSTRAINT engagement_inputs_label_check;
ALTER TABLE engagement_inputs ADD CONSTRAINT engagement_inputs_label_check CHECK (label IN ('synthetic','workshop','client','measured'));
