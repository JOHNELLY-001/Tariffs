-- 0009 — Add search and normalized-code indexes
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'FTS_INDEX_MISSING' AS anomaly, 'idx_tariffs_description_fts' AS object
 WHERE to_regclass('public.idx_tariffs_description_fts') IS NULL
UNION ALL
SELECT 'TRGM_INDEX_MISSING', 'idx_tariffs_description_trgm'
 WHERE to_regclass('public.idx_tariffs_description_trgm') IS NULL
UNION ALL
SELECT 'NORMALIZED_CODE_INDEX_MISSING', 'idx_tariffs_hs_code_normalized'
 WHERE to_regclass('public.idx_tariffs_hs_code_normalized') IS NULL;
