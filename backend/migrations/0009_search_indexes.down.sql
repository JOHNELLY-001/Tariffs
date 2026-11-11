-- 0009 — Add core search, schedule and normalized-code indexes
-- ROLLBACK — indexes only; no table data touched

DROP INDEX IF EXISTS idx_tariffs_description_fts;
DROP INDEX IF EXISTS idx_tariffs_hs_code_normalized;
DROP INDEX IF EXISTS idx_tariffs_schedule_type;
