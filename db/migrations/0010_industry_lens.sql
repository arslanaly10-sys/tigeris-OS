-- 0010 Industry lens (9 Nov 2026): the industry a person works in is chosen at sign-in and kept on the session.
-- Permissions stay with the role; the industry only sets what the OS shows first. Valid keys live in
-- packages/shared/src/industries.ts and are checked by the API before they are written.
ALTER TABLE sessions ADD COLUMN industry_key text NOT NULL DEFAULT 'sovereign_capital';
