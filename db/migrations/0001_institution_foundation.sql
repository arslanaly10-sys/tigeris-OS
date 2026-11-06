-- 0001 Institution foundation (SCH §3, §8 step 1)
-- Every institutional table carries institution_id and is protected by row-level security.
-- The application connects as tigeris_app (non-owner, NOBYPASSRLS) and sets app.institution_id
-- transaction-locally after validating the session.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION app_current_institution() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.institution_id', true), '')::uuid
$$;

CREATE TABLE institutions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  short_name      text NOT NULL,
  buyer_category  text NOT NULL,          -- e.g. "Sovereign wealth fund" (Q123: categories only)
  country         text NOT NULL,
  residency       text NOT NULL,          -- data residency shown in the header badge
  environment     text NOT NULL DEFAULT 'controlled_demo',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE divisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  name            text NOT NULL,
  UNIQUE (institution_id, id)
);

CREATE TABLE principals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  division_id     uuid,
  idp_issuer      text NOT NULL,          -- identity provider stays the source of authentication
  idp_subject     text NOT NULL,
  display_name    text NOT NULL,
  title           text NOT NULL,
  email           text NOT NULL,
  is_demo         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idp_issuer, idp_subject),
  UNIQUE (institution_id, id),
  FOREIGN KEY (institution_id, division_id) REFERENCES divisions(institution_id, id)
);

CREATE TABLE roles (
  key             text PRIMARY KEY,
  label           text NOT NULL
);

CREATE TABLE principal_roles (
  institution_id  uuid NOT NULL,
  principal_id    uuid NOT NULL,
  role_key        text NOT NULL REFERENCES roles(key),
  scope_division  uuid,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, role_key),
  FOREIGN KEY (institution_id, principal_id) REFERENCES principals(institution_id, id)
);

-- Sessions are looked up by token hash before the tenant is known, so they sit outside RLS.
-- They hold no institutional content: only who is signed in and whether MFA passed.
CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      text NOT NULL UNIQUE,
  principal_id    uuid NOT NULL REFERENCES principals(id),
  institution_id  uuid NOT NULL REFERENCES institutions(id),
  role_key        text NOT NULL REFERENCES roles(key),
  mfa_code_hash   text,
  mfa_verified_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz
);

-- Row-level security
ALTER TABLE divisions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE principals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE principal_roles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions        FORCE ROW LEVEL SECURITY;
ALTER TABLE principals       FORCE ROW LEVEL SECURITY;
ALTER TABLE principal_roles  FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON divisions       USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution());
CREATE POLICY tenant_isolation ON principals      USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution());
CREATE POLICY tenant_isolation ON principal_roles USING (institution_id = app_current_institution()) WITH CHECK (institution_id = app_current_institution());

-- Grants for the application role
GRANT USAGE ON SCHEMA public TO tigeris_app;
GRANT SELECT ON institutions, roles TO tigeris_app;
GRANT SELECT ON divisions, principals, principal_roles TO tigeris_app;
GRANT SELECT, INSERT, UPDATE ON sessions TO tigeris_app;
