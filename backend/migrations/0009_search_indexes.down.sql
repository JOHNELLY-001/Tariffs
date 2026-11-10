-- 0009 — Add search and normalized-code indexes
-- ROLLBACK — indexes only; the pg_trgm extension is intentionally retained
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

DROP INDEX IF EXISTS idx_tariffs_description_fts;
DROP INDEX IF EXISTS idx_tariffs_description_trgm;
DROP INDEX IF EXISTS idx_tariffs_hs_code_normalized;
