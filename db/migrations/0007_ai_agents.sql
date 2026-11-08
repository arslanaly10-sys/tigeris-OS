-- 0007 Model gateway, bounded agents, recommendations and briefs (TR-020..TR-028, FR-17..FR-24, Q060..Q069)
-- Models only write text. Every call is recorded with provider, prompt hash, tokens, cost and outcome.
-- Blocked calls are recorded too, so the sovereignty controls can be shown working.

-- One row per institution. Outbound is off and foreign models are cut by default (CLAUDE.md rule 6).
CREATE TABLE sovereignty_settings (
  institution_id          uuid PRIMARY KEY REFERENCES institutions(id),
  foreign_models_enabled  boolean NOT NULL DEFAULT false,
  outbound_allowed        boolean NOT NULL DEFAULT false,
  allowed_providers       text[] NOT NULL DEFAULT ARRAY['local','deterministic'],
  default_provider        text NOT NULL DEFAULT 'local',
  foreign_max_classification text NOT NULL DEFAULT 'internal' CHECK (foreign_max_classification IN ('public','internal','confidential')),
  version                 integer NOT NULL DEFAULT 1,
  updated_by_label        text NOT NULL DEFAULT 'system default',
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  case_id          uuid,
  kind             text NOT NULL CHECK (kind IN ('case_analysis','ask','graph_question','brief')),
  status           text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  provider_requested text NOT NULL,
  question         text,
  summary          jsonb NOT NULL DEFAULT '{}'::jsonb,
  tokens_in        integer NOT NULL DEFAULT 0,
  tokens_out       integer NOT NULL DEFAULT 0,
  cost_usd         double precision NOT NULL DEFAULT 0,
  model_calls      integer NOT NULL DEFAULT 0,
  error            text,
  requested_by     uuid NOT NULL,
  requested_by_label text NOT NULL,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id)
);
CREATE INDEX agent_runs_case_idx ON agent_runs (institution_id, case_id, kind, started_at DESC);

-- One step per agent action: its tool calls, its sources, its output and how the output was checked.
CREATE TABLE agent_steps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  run_id           uuid NOT NULL,
  seq              integer NOT NULL,
  agent_key        text NOT NULL,
  phase            text NOT NULL CHECK (phase IN ('gather','analyse','challenge','recommend','govern','compose','answer')),
  title            text NOT NULL,
  tool_calls       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{tool, input, output_summary, ms}]
  sources          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{tag, kind, ref, label, text}]
  output           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- structured result (numbers come from tools only)
  text             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{sentence, tags, status: cited|unverified, reason}]
  writer           text NOT NULL,                        -- provider that wrote the text, or 'deterministic'
  fallback_reason  text,
  status           text NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  ms               integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  UNIQUE (run_id, seq),
  FOREIGN KEY (institution_id, run_id) REFERENCES agent_runs(institution_id, id)
);

CREATE TABLE model_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  run_id           uuid,
  step_seq         integer,
  agent_key        text NOT NULL,
  provider         text NOT NULL,
  model            text NOT NULL,
  prompt_hash      text NOT NULL,
  prompt_chars     integer NOT NULL,
  classification   text NOT NULL,
  outcome          text NOT NULL CHECK (outcome IN ('ok','cached','blocked','unavailable','error')),
  reason           text,
  tokens_in        integer NOT NULL DEFAULT 0,
  tokens_out       integer NOT NULL DEFAULT 0,
  latency_ms       integer NOT NULL DEFAULT 0,
  cost_usd         double precision NOT NULL DEFAULT 0,
  priced           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);
CREATE INDEX model_calls_inst_idx ON model_calls (institution_id, created_at DESC);

-- Response cache keyed by provider, model and prompt hash. It has no foreign key on purpose so a
-- demo reset keeps it (the reset re-creates the same institutions with the same ids); it is still
-- tenant-scoped under row-level security.
CREATE TABLE model_cache (
  institution_id   uuid NOT NULL,
  provider         text NOT NULL,
  model            text NOT NULL,
  prompt_hash      text NOT NULL,
  response_text    text NOT NULL,
  tokens_in        integer NOT NULL,
  tokens_out       integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, provider, model, prompt_hash)
);

CREATE TABLE recommendations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  case_id          uuid NOT NULL,
  run_id           uuid NOT NULL,
  option_key       text NOT NULL,
  title            text NOT NULL,
  description      text NOT NULL,
  driver_changes   jsonb NOT NULL,      -- engine drivers changed against the baseline
  effect           jsonb NOT NULL,      -- {var_90d:{base,with,delta}, resilience:{...}, shortfall_72h:{...}, input_hash}
  base_score       double precision NOT NULL,
  confidence       jsonb NOT NULL,      -- {band, components:[{key,label,value,basis}]}
  constraints      text[] NOT NULL DEFAULT '{}',
  owner_role       text NOT NULL,
  authority        text NOT NULL,
  governance       jsonb NOT NULL,      -- {result: PASS|HOLD, checks:[...]}
  sources          jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, run_id) REFERENCES agent_runs(institution_id, id)
);
CREATE INDEX recommendations_case_idx ON recommendations (institution_id, case_id, run_id);

-- Feedback is append-only. It re-ranks options of the same kind in this and later cases (Q067).
CREATE TABLE recommendation_feedback (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id),
  recommendation_id uuid NOT NULL,
  option_key        text NOT NULL,
  vote              smallint NOT NULL CHECK (vote IN (-1, 1)),
  reason            text NOT NULL,
  actor_id          uuid NOT NULL,
  actor_label       text NOT NULL,
  actor_role        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, recommendation_id) REFERENCES recommendations(institution_id, id)
);
CREATE INDEX recommendation_feedback_key_idx ON recommendation_feedback (institution_id, option_key);

-- Expert confidence adjustments: the original band is kept; the adjustment and its reason are recorded (Q065).
CREATE TABLE confidence_adjustments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  target_type      text NOT NULL CHECK (target_type IN ('signal','recommendation')),
  target_id        uuid NOT NULL,
  from_band        text NOT NULL CHECK (from_band IN ('low','medium','high')),
  to_band          text NOT NULL CHECK (to_band IN ('low','medium','high')),
  reason           text NOT NULL,
  actor_id         uuid NOT NULL,
  actor_label      text NOT NULL,
  actor_role       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);
CREATE INDEX confidence_adjustments_target_idx ON confidence_adjustments (institution_id, target_type, target_id, created_at DESC);

CREATE TABLE case_briefs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  case_id          uuid NOT NULL,
  run_id           uuid NOT NULL,
  version          integer NOT NULL,
  content          jsonb NOT NULL,
  content_hash     text NOT NULL,
  created_by_label text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  UNIQUE (case_id, version),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, run_id) REFERENCES agent_runs(institution_id, id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sovereignty_settings','agent_runs','agent_steps','model_calls','model_cache','recommendations','recommendation_feedback','confidence_adjustments','case_briefs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON sovereignty_settings, agent_runs, agent_steps TO tigeris_app;
GRANT SELECT, INSERT ON model_calls, model_cache, recommendations, recommendation_feedback, confidence_adjustments, case_briefs TO tigeris_app;
