-- Runs once as the database superuser when the container's data volume is first created.
CREATE ROLE tigeris_owner LOGIN PASSWORD 'tigeris_owner' CREATEDB;
CREATE ROLE tigeris_app LOGIN PASSWORD 'tigeris_app' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE tigeris OWNER tigeris_owner;
\connect tigeris
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
