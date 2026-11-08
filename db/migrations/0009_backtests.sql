-- 0009 Back-test runs and adopted calibration (TR-039, Q050)
-- A run fits the price response on historical episodes from sourced Brent prices and assumed
-- disruption sizes. A domain expert other than the runner adopts it; scenarios then use it.
CREATE TABLE backtest_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  model_version    text NOT NULL,
  input_hash       text NOT NULL,
  method           text NOT NULL,
  episodes         jsonb NOT NULL,
  fitted           jsonb NOT NULL,
  prior            jsonb NOT NULL,
  metrics          jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','adopted','superseded')),
  run_by           uuid NOT NULL,
  run_by_label     text NOT NULL,
  adopted_by_label text,
  adopted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);
CREATE UNIQUE INDEX backtest_one_adopted ON backtest_runs (institution_id) WHERE status = 'adopted';
ALTER TABLE backtest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtest_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON backtest_runs USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution());
GRANT SELECT, INSERT, UPDATE ON backtest_runs TO tigeris_app;
