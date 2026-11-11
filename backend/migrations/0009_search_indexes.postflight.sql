-- 0009 — Add core search, schedule and normalized-code indexes
-- POSTFLIGHT — anomalies reported as rows (zero rows = healthy)

SELECT 'FTS_INDEX_MISSING' AS anomaly, 'idx_tariffs_description_fts' AS object
 WHERE to_regclass('public.idx_tariffs_description_fts') IS NULL
UNION ALL
SELECT 'NORMALIZED_CODE_INDEX_MISSING', 'idx_tariffs_hs_code_normalized'
 WHERE to_regclass('public.idx_tariffs_hs_code_normalized') IS NULL
UNION ALL
SELECT 'SCHEDULE_TYPE_INDEX_MISSING', 'idx_tariffs_schedule_type'
 WHERE to_regclass('public.idx_tariffs_schedule_type') IS NULL;
