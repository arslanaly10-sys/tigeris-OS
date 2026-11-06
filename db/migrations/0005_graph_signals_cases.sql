-- 0005 Intelligence graph, signals, cases, comments, notifications, domain packs
-- (SCH §4–5, FR-13..FR-16, TR-018..TR-022, App Flow §4, Q105). All institution-scoped under forced RLS.

-- Packages may now carry files intended for one institution only (synthetic institution context).
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_class_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_class_check
  CHECK (source_class IN ('public','third_party_derived','licensed','client_validated','synthetic','illustrative','reference'));

CREATE TABLE domain_packs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  key             text NOT NULL,
  name            text NOT NULL,
  description     text NOT NULL,
  status          text NOT NULL CHECK (status IN ('active','configured','planned')),
  entity_types    text[] NOT NULL DEFAULT '{}',
  priority        integer NOT NULL,
  UNIQUE (institution_id, key)
);

CREATE TABLE entities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  key             text NOT NULL,                     -- stable id, e.g. "port:jebel-ali", "vessel:imo:9123456"
  type            text NOT NULL,                     -- country, chokepoint, port, terminal, refinery, pipeline, ...
  name            text NOT NULL,
  country         text,                              -- ISO3
  lat             double precision,
  lon             double precision,
  location_quality text,                             -- e.g. "approximate (curated reference)"
  domain_keys     text[] NOT NULL DEFAULT '{}',
  attributes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  claim_class     text NOT NULL CHECK (claim_class IN ('observed','sourced','inferred','assumed','synthetic','illustrative')),
  evidence_id     uuid,                              -- record the entity was created from
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  valid_from      timestamptz,
  valid_to        timestamptz,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  search          tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(type,'') || ' ' || coalesce(country,''))) STORED,
  UNIQUE (institution_id, key),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, evidence_id) REFERENCES evidence_objects(institution_id, id)
);
CREATE INDEX entities_type_idx ON entities (institution_id, type);
CREATE INDEX entities_search_idx ON entities USING gin (search);

CREATE TABLE entity_aliases (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  entity_id       uuid NOT NULL,
  alias           text NOT NULL,
  PRIMARY KEY (entity_id, alias),
  FOREIGN KEY (institution_id, entity_id) REFERENCES entities(institution_id, id)
);

CREATE TABLE entity_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     uuid NOT NULL REFERENCES institutions(id),
  subject_id         uuid NOT NULL,
  predicate          text NOT NULL,                  -- e.g. located_in, exports_via, supplies, depends_on, exposed_to
  predicate_label    text NOT NULL,
  object_id          uuid NOT NULL,
  directed           boolean NOT NULL DEFAULT true,
  relationship_class text NOT NULL CHECK (relationship_class IN ('observed','sourced','inferred','assumed','synthetic')),
  impact_weight      double precision,              -- 0..1, used by propagation in week 5
  confidence         text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  valid_from         timestamptz,
  valid_to           timestamptz,
  graph_version      integer NOT NULL DEFAULT 1,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','challenged','retired')),
  recorded_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id),
  UNIQUE (institution_id, subject_id, predicate, object_id),
  FOREIGN KEY (institution_id, subject_id) REFERENCES entities(institution_id, id),
  FOREIGN KEY (institution_id, object_id) REFERENCES entities(institution_id, id)
);
CREATE INDEX rel_subject_idx ON entity_relationships (institution_id, subject_id, predicate);
CREATE INDEX rel_object_idx ON entity_relationships (institution_id, object_id, predicate);

CREATE TABLE relationship_evidence (
  institution_id   uuid NOT NULL REFERENCES institutions(id),
  relationship_id  uuid NOT NULL,
  evidence_id      uuid NOT NULL,
  fact_id          uuid,
  role             text NOT NULL CHECK (role IN ('supporting','contradicting','contextual')),
  note             text,
  PRIMARY KEY (relationship_id, evidence_id, role),
  FOREIGN KEY (institution_id, relationship_id) REFERENCES entity_relationships(institution_id, id),
  FOREIGN KEY (institution_id, evidence_id) REFERENCES evidence_objects(institution_id, id)
);

CREATE TABLE graph_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  scope           text NOT NULL,                     -- "institution" or a case id
  case_id         uuid,
  entity_count    integer NOT NULL,
  relationship_count integer NOT NULL,
  content_hash    text NOT NULL,
  created_by_label text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, id)
);

CREATE TABLE signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  key             text NOT NULL,                     -- dedupe key for rule-generated signals
  title           text NOT NULL,
  summary         text NOT NULL,
  domain          text NOT NULL,
  event_type      text NOT NULL,
  urgency         text NOT NULL CHECK (urgency IN ('low','medium','high','critical')),
  impact          text NOT NULL CHECK (impact IN ('low','medium','high')),
  data_mode       text NOT NULL CHECK (data_mode IN ('observed','simulated','synthetic')),
  event_time      timestamptz NOT NULL,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','monitoring','dismissed','in_case')),
  disposition_note text,
  disposition_by  text,
  confidence      jsonb NOT NULL DEFAULT '{}'::jsonb, -- {band, components:[{factor, level, basis}]}
  why_surfaced    text NOT NULL,
  detected_by     text NOT NULL,                     -- rule or stream id
  UNIQUE (institution_id, key),
  UNIQUE (institution_id, id)
);
CREATE INDEX signals_queue_idx ON signals (institution_id, status, detected_at DESC);

CREATE TABLE signal_evidence (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  signal_id       uuid NOT NULL,
  evidence_id     uuid,
  fact_id         uuid,
  role            text NOT NULL CHECK (role IN ('origin','corroborating','contradicting')),
  note            text,
  added_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, signal_id) REFERENCES signals(institution_id, id)
);

CREATE TABLE signal_entities (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  signal_id       uuid NOT NULL,
  entity_id       uuid NOT NULL,
  PRIMARY KEY (signal_id, entity_id),
  FOREIGN KEY (institution_id, signal_id) REFERENCES signals(institution_id, id),
  FOREIGN KEY (institution_id, entity_id) REFERENCES entities(institution_id, id)
);

CREATE SEQUENCE case_number_seq;
CREATE TABLE cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_key        text NOT NULL,                     -- human id, e.g. GSF-2026-0007
  title           text NOT NULL,
  objective       text NOT NULL,
  domain          text NOT NULL,
  depth           text NOT NULL DEFAULT 'full' CHECK (depth IN ('full','medium','short')),
  state           text NOT NULL CHECK (state IN ('detected','triaged','analysis','scenario','review','decision','handoff','closed')),
  closure         text CHECK (closure IN ('resolved','dismissed','non_actionable')),
  sensitivity     text NOT NULL DEFAULT 'confidential' CHECK (sensitivity IN ('public','internal','confidential','secret')),
  owner_id        uuid NOT NULL,
  owner_label     text NOT NULL,
  created_by      uuid NOT NULL,
  created_by_label text NOT NULL,
  source_signal_id uuid,
  linked_case_id  uuid,
  situation       text NOT NULL DEFAULT '',
  why_it_matters  text NOT NULL DEFAULT '',
  open_questions  text[] NOT NULL DEFAULT '{}',
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  search          tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(case_key,'') || ' ' || coalesce(title,'') || ' ' || coalesce(objective,'') || ' ' || coalesce(situation,''))) STORED,
  UNIQUE (institution_id, case_key),
  UNIQUE (institution_id, id)
);
CREATE INDEX cases_queue_idx ON cases (institution_id, state, last_activity_at DESC);
CREATE INDEX cases_search_idx ON cases USING gin (search);

CREATE TABLE case_participants (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_id         uuid NOT NULL,
  principal_id    uuid NOT NULL,
  role            text NOT NULL CHECK (role IN ('owner','analyst','expert','approver','operations','observer')),
  PRIMARY KEY (case_id, principal_id, role),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id)
);

CREATE TABLE case_signals (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_id         uuid NOT NULL,
  signal_id       uuid NOT NULL,
  PRIMARY KEY (case_id, signal_id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, signal_id) REFERENCES signals(institution_id, id)
);

CREATE TABLE case_evidence (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_id         uuid NOT NULL,
  evidence_id     uuid NOT NULL,
  fact_id         uuid,
  note            text,
  added_by_label  text NOT NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, evidence_id) REFERENCES evidence_objects(institution_id, id)
);

CREATE TABLE case_entities (
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_id         uuid NOT NULL,
  entity_id       uuid NOT NULL,
  role            text NOT NULL DEFAULT 'affected' CHECK (role IN ('origin','affected','exposure','alternative')),
  PRIMARY KEY (case_id, entity_id),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id),
  FOREIGN KEY (institution_id, entity_id) REFERENCES entities(institution_id, id)
);

-- Append-only case history: state transitions and analyst/reviewer actions.
CREATE TABLE case_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_id         uuid NOT NULL,
  kind            text NOT NULL,                     -- created, transition, signal_attached, evidence_attached, comment, ...
  from_state      text,
  to_state        text,
  actor_id        uuid,
  actor_label     text NOT NULL,
  actor_role      text,
  rationale       text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id)
);
CREATE INDEX case_events_idx ON case_events (institution_id, case_id, occurred_at);

CREATE TABLE case_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  case_id         uuid NOT NULL,
  author_id       uuid NOT NULL,
  author_label    text NOT NULL,
  author_role     text NOT NULL,
  body            text NOT NULL,
  mentions        uuid[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, case_id) REFERENCES cases(institution_id, id)
);

CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  recipient_id    uuid NOT NULL,
  kind            text NOT NULL,                     -- mention, assigned, review_requested, signal_high
  title           text NOT NULL,
  body            text NOT NULL,
  link            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz
);
CREATE INDEX notifications_idx ON notifications (institution_id, recipient_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['domain_packs','entities','entity_aliases','entity_relationships','relationship_evidence','graph_snapshots','signals','signal_evidence','signal_entities','cases','case_participants','case_signals','case_evidence','case_entities','case_events','case_comments','notifications'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution())', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON domain_packs, entities, entity_aliases, entity_relationships, relationship_evidence, graph_snapshots,
  signals, signal_evidence, signal_entities, cases, case_participants, case_signals, case_evidence, case_entities, notifications TO tigeris_app;
GRANT DELETE ON entity_aliases, relationship_evidence, signal_entities, case_entities TO tigeris_app;
GRANT SELECT, INSERT ON case_events, case_comments TO tigeris_app;
GRANT USAGE ON SEQUENCE case_number_seq TO tigeris_app;
