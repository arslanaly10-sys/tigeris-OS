-- 0008 Policy-as-code, named decisions, handoffs and institutional memory
-- (FR-29..FR-36, FR-41..FR-45, TR-041..TR-050, Q090..Q107)

-- Policy versions: source YAML, compiled rules, test results. Exactly one active version per institution.
CREATE TABLE policy_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  version          integer NOT NULL,
  status           text NOT NULL CHECK (status IN ('draft','active','retired')),
  source           text NOT NULL,
  compiled         jsonb NOT NULL,
  test_results     jsonb NOT NULL DEFAULT '[]'::jsonb,
  tests_passed     boolean NOT NULL DEFAULT false,
  content_hash     text NOT NULL,
  note             text NOT NULL DEFAULT '',
  created_by_label text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  activated_by_label text,
  activated_at     timestamptz,
  UNIQUE (institution_id, version),
  UNIQUE (institution_id, id)
);
CREATE UNIQUE INDEX policy_one_active ON policy_versions (institution_id) WHERE status = 'active';

-- A named decision on one option. The snapshot freezes every input so the decision can be replayed
-- and checked for drift later (FR-43, Q096).
CREATE TABLE decisions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES institutions(id),
  case_id            uuid NOT NULL,
  recommendation_id  uuid NOT NULL,
  option_key         text NOT NULL,
  option_title       text NOT NULL,
  outcome            text NOT NULL CHECK (outcome IN ('approve','reject','defer')),
  status             text NOT NULL CHECK (status IN ('pending','approved','rejected','deferred')),
  rationale          text NOT NULL,
  required_approvals integer NOT NULL DEFAULT 1,
  approval_roles     text[] NOT NULL DEFAULT '{}',
  approval_rule      text,
  policy_version_id  uuid NOT NULL,
  policy_hash        text NOT NULL,
  policy_trace       jsonb NOT NULL,
  snapshot           jsonb NOT NULL,
  snapshot_hash      text NOT NULL,
  proposed_by        uuid NOT NULL,
  proposed_by_label  text NOT NULL,
  proposed_by_role   text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  finalised_at       timestamptz,
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, recommendation_id) REFERENCES recommendations(institution_id, id),
  FOREIGN KEY (institution_id, policy_version_id) REFERENCES policy_versions(institution_id, id)
);
CREATE INDEX decisions_case_idx ON decisions (institution_id, case_id, created_at DESC);

CREATE TABLE decision_approvals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  decision_id      uuid NOT NULL,
  approver_id      uuid NOT NULL,
  approver_label   text NOT NULL,
  approver_role    text NOT NULL,
  vote             text NOT NULL CHECK (vote IN ('approve','reject')),
  rationale        text NOT NULL,
  policy_trace     jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, approver_id),
  FOREIGN KEY (institution_id, decision_id) REFERENCES decisions(institution_id, id)
);

-- Operations handoff: tasks created from an approved decision; status changes are append-only updates.
CREATE TABLE handoffs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  case_id          uuid NOT NULL,
  decision_id      uuid NOT NULL,
  title            text NOT NULL,
  description      text NOT NULL,
  owner_role       text NOT NULL,
  due_at           timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','blocked')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, decision_id) REFERENCES decisions(institution_id, id)
);
CREATE TABLE handoff_updates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  handoff_id       uuid NOT NULL,
  status           text NOT NULL CHECK (status IN ('open','in_progress','done','blocked')),
  note             text NOT NULL,
  actor_label      text NOT NULL,
  actor_role       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, handoff_id) REFERENCES handoffs(institution_id, id)
);

-- array_to_string is only STABLE; this wrapper is safe because the separator and input are fixed.
CREATE FUNCTION tigeris_join(text[]) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, ' ') $$;

-- Institutional memory: seeded precedents and approved entries from cases, searchable by keyword and meaning.
CREATE TABLE precedents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  key              text NOT NULL,
  title            text NOT NULL,
  summary          text NOT NULL,
  domain           text NOT NULL,
  event_type       text NOT NULL,
  region           text NOT NULL,
  period           text NOT NULL,
  outcome          text NOT NULL,
  lessons          text[] NOT NULL DEFAULT '{}',
  tags             text[] NOT NULL DEFAULT '{}',
  claim_class      text NOT NULL CHECK (claim_class IN ('observed','sourced','illustrative','synthetic')),
  source_label     text NOT NULL,
  case_id          uuid,
  decision_id      uuid,
  status           text NOT NULL CHECK (status IN ('proposed','approved','rejected')),
  proposed_by      uuid,
  proposed_by_label text NOT NULL,
  approved_by_label text,
  approved_at      timestamptz,
  embedding        vector(384),
  embedding_model  text,
  search           tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary,'') || ' ' || coalesce(outcome,'')), 'B') ||
    setweight(to_tsvector('english', tigeris_join(lessons) || ' ' || tigeris_join(tags) || ' ' || domain || ' ' || region), 'C')) STORED,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, key),
  UNIQUE (institution_id, id)
);
CREATE INDEX precedents_search_idx ON precedents USING gin (search);
CREATE INDEX precedents_embedding_idx ON precedents USING hnsw (embedding vector_cosine_ops);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['policy_versions','decisions','decision_approvals','handoffs','handoff_updates','precedents'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON policy_versions, decisions, handoffs, precedents TO tigeris_app;
GRANT SELECT, INSERT ON decision_approvals, handoff_updates TO tigeris_app;
