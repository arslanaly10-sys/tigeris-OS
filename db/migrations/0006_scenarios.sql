-- 0006 Scenario runs with full lineage (SCH §5, TR-035..TR-040, FR-26..FR-28)
-- A comparison group holds a baseline and up to two alternatives. Every result row points at the
-- facts and assumptions it was computed from (exactly one per lineage row).

ALTER TABLE cases ADD COLUMN scenario_template text NOT NULL DEFAULT 'hormuz';

CREATE TABLE scenario_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  case_id          uuid NOT NULL,
  group_id         uuid NOT NULL,                       -- runs compared side by side
  variant          text NOT NULL CHECK (variant IN ('baseline','alt1','alt2')),
  name             text NOT NULL,
  template         text NOT NULL,
  model_version    text NOT NULL,
  input_hash       text NOT NULL,
  payload          jsonb NOT NULL,                      -- exact engine input, for replay (FR-43)
  graph_snapshot_id uuid,
  derived          jsonb NOT NULL,
  cascade          jsonb NOT NULL,
  resilience       jsonb NOT NULL,
  sensitivity      jsonb NOT NULL,
  top_exposures    jsonb NOT NULL,
  monte_carlo_runs integer NOT NULL,
  duration_ms      integer NOT NULL,
  created_by       uuid NOT NULL,
  created_by_label text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id)
);
CREATE INDEX scenario_runs_case_idx ON scenario_runs (institution_id, case_id, created_at DESC);

CREATE TABLE scenario_assumptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  run_id          uuid NOT NULL,
  key             text NOT NULL,
  label           text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('driver','parameter')),
  value_num       double precision,
  unit            text,
  basis           text NOT NULL,
  UNIQUE (institution_id, id),
  UNIQUE (run_id, key),
  FOREIGN KEY (institution_id, run_id) REFERENCES scenario_runs(institution_id, id)
);

CREATE TABLE scenario_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  run_id          uuid NOT NULL,
  key             text NOT NULL,
  label           text NOT NULL,
  horizon         text NOT NULL CHECK (horizon IN ('72h','90d','1y','5y')),
  unit            text NOT NULL,
  value           double precision NOT NULL,
  p10             double precision,
  p50             double precision,
  p90             double precision,
  method          text NOT NULL,
  formula         text NOT NULL,
  result_class    text NOT NULL DEFAULT 'calculated',
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, run_id) REFERENCES scenario_runs(institution_id, id)
);
CREATE INDEX scenario_results_run_idx ON scenario_results (run_id, horizon, key);

CREATE TABLE scenario_result_inputs (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  result_id       uuid NOT NULL,
  fact_id         uuid,
  assumption_id   uuid,
  note            text,
  CHECK ((fact_id IS NULL) <> (assumption_id IS NULL)),
  FOREIGN KEY (institution_id, result_id) REFERENCES scenario_results(institution_id, id),
  FOREIGN KEY (institution_id, fact_id) REFERENCES evidence_facts(institution_id, id),
  FOREIGN KEY (institution_id, assumption_id) REFERENCES scenario_assumptions(institution_id, id)
);
CREATE INDEX scenario_result_inputs_idx ON scenario_result_inputs (result_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scenario_runs','scenario_assumptions','scenario_results','scenario_result_inputs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
  END LOOP;
END $$;

-- Runs, assumptions and results are written once and never changed.
GRANT SELECT, INSERT ON scenario_runs, scenario_assumptions, scenario_results, scenario_result_inputs TO tigeris_app;
