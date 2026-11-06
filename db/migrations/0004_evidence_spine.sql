-- 0004 Evidence spine (SCH §4, §8 step 2; FR-06..FR-11; TR-001..TR-017)
-- Sources, trusted package signers, a PostgreSQL job queue (ADR-0004), immutable evidence objects,
-- validation runs and extracted facts. All institution-scoped under forced row-level security.

CREATE TABLE sources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid NOT NULL REFERENCES institutions(id),
  key                   text NOT NULL,                 -- stable id used in packages, e.g. "worldbank.wdi"
  name                  text NOT NULL,
  publisher             text NOT NULL,
  source_class          text NOT NULL CHECK (source_class IN ('public','third_party_derived','licensed','client_validated','synthetic','illustrative')),
  country               text,                          -- null = international
  access_method         text NOT NULL,                 -- api | file_download | web_page | upload | manual
  url                   text,
  licence               text NOT NULL,
  terms_ref             text,
  owner_label           text NOT NULL,                 -- named owner inside the institution
  allowed_purposes      text[] NOT NULL DEFAULT '{}',
  cadence               text NOT NULL,
  freshness_limit_hours integer NOT NULL,
  status                text NOT NULL CHECK (status IN ('approved','pending_review','suspended','unreachable')),
  status_note           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, key),
  UNIQUE (institution_id, id)
);

-- Public keys whose signatures this institution accepts on imported packages (air-gap pattern, TR-017).
CREATE TABLE trusted_signers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  name            text NOT NULL,
  public_key_pem  text NOT NULL,
  fingerprint     text NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, fingerprint)
);

-- Durable job queue: claimed with FOR UPDATE SKIP LOCKED, idempotent per institution and key.
CREATE TABLE ingestion_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  kind             text NOT NULL CHECK (kind IN ('package_import','document_upload')),
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed')),
  idempotency_key  text NOT NULL,
  label            text NOT NULL,
  payload_ref      text NOT NULL,                      -- vault key of the uploaded bytes
  payload_sha256   text NOT NULL,
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 3,
  run_after        timestamptz NOT NULL DEFAULT now(),
  locked_at        timestamptz,
  result           jsonb,
  error            text,
  created_by       uuid,
  created_by_label text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  UNIQUE (institution_id, idempotency_key),
  UNIQUE (institution_id, id)
);
CREATE INDEX ingestion_jobs_queue_idx ON ingestion_jobs (status, run_after);

CREATE TABLE evidence_objects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id),
  source_id         uuid NOT NULL,
  ingestion_job_id  uuid NOT NULL,
  external_key      text NOT NULL,                    -- record key at the source (file name, URL, dataset id)
  title             text NOT NULL,
  original_url      text,
  media_type        text NOT NULL,
  size_bytes        bigint NOT NULL,
  sha256            text NOT NULL,
  vault_key         text NOT NULL,
  event_time        timestamptz,                      -- as-of / effective time stated by the source
  retrieved_at      timestamptz NOT NULL,
  source_version    text,
  data_class        text NOT NULL,
  classification    text NOT NULL DEFAULT 'internal' CHECK (classification IN ('public','internal','confidential','secret')),
  rights            text NOT NULL,
  transformations   jsonb NOT NULL DEFAULT '[]'::jsonb, -- collector-side filters, recorded as provenance
  validation_state  text NOT NULL CHECK (validation_state IN ('accepted','warning','quarantined','rejected')),
  duplicate_of      uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, source_id) REFERENCES sources(institution_id, id),
  FOREIGN KEY (institution_id, ingestion_job_id) REFERENCES ingestion_jobs(institution_id, id)
);
CREATE INDEX evidence_source_time_idx ON evidence_objects (institution_id, source_id, event_time);
CREATE INDEX evidence_validation_idx ON evidence_objects (validation_state, retrieved_at);
CREATE INDEX evidence_sha_idx ON evidence_objects (institution_id, sha256);

CREATE TABLE validation_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  evidence_id      uuid NOT NULL,
  rule_set_version text NOT NULL,
  checks           jsonb NOT NULL,                     -- [{rule, result: pass|warn|fail, detail}]
  outcome          text NOT NULL CHECK (outcome IN ('accepted','warning','quarantined','rejected')),
  evaluator        text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, evidence_id) REFERENCES evidence_objects(institution_id, id)
);

CREATE TABLE evidence_facts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES institutions(id),
  evidence_id        uuid NOT NULL,
  subject            text NOT NULL,                   -- e.g. "SAU", "Strait of Hormuz", vessel name
  subject_label      text NOT NULL,
  predicate          text NOT NULL,                   -- e.g. "gdp_current_usd", "oil_transit_flow"
  predicate_label    text NOT NULL,
  value_num          double precision,
  value_text         text,
  unit               text,
  period             text,                            -- "2024", "2025-03"
  qualifier          text,                            -- e.g. "IMF projection", "estimate"
  claim_class        text NOT NULL CHECK (claim_class IN ('observed','sourced','inferred','assumed','synthetic','illustrative')),
  review_state       text NOT NULL DEFAULT 'accepted' CHECK (review_state IN ('accepted','needs_review','rejected')),
  locator            text,                            -- row, JSON path or page reference
  excerpt            text,
  extraction_method  text NOT NULL,
  extraction_version text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, evidence_id) REFERENCES evidence_objects(institution_id, id)
);
CREATE INDEX evidence_facts_lookup_idx ON evidence_facts (institution_id, predicate, subject, period);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sources','trusted_signers','ingestion_jobs','evidence_objects','validation_runs','evidence_facts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON sources, trusted_signers, ingestion_jobs, evidence_objects TO tigeris_app;
GRANT SELECT, INSERT ON validation_runs, evidence_facts TO tigeris_app;
GRANT UPDATE (review_state) ON evidence_facts TO tigeris_app;

-- The worker claims jobs across institutions. This SECURITY DEFINER function returns the id and
-- institution of the next due job without exposing any payload; the worker then processes it
-- inside that institution's RLS scope.
CREATE OR REPLACE FUNCTION claim_next_ingestion_job()
RETURNS TABLE (job_id uuid, institution_id uuid)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE inst record; j record;
BEGIN
  FOR inst IN SELECT id FROM institutions LOOP
    PERFORM set_config('app.institution_id', inst.id::text, true);
    SELECT id INTO j FROM ingestion_jobs
     WHERE (status = 'queued' AND run_after <= now())
        OR (status = 'running' AND locked_at < now() - interval '5 minutes')  -- recover jobs from a crashed worker
     ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    IF FOUND THEN
      UPDATE ingestion_jobs SET status = 'running', locked_at = now(), attempts = attempts + 1 WHERE id = j.id;
      PERFORM set_config('app.institution_id', '', true);
      job_id := j.id; institution_id := inst.id;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  PERFORM set_config('app.institution_id', '', true);
END $$;
REVOKE ALL ON FUNCTION claim_next_ingestion_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_ingestion_job() TO tigeris_app;
