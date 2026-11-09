-- 0012 The briefing question on every gap diagnostic (Tiger Capital's institutional briefing):
-- "What strategic priority, decision challenge or intelligence gap would you like to explore?"
ALTER TABLE diagnostic_assessments ADD COLUMN priority text CHECK (priority IS NULL OR length(priority) <= 500);
