-- 0010 — OPTIONAL: trigram indexes for partial/fuzzy description matching
-- POSTFLIGHT — anomalies reported as rows (zero rows = healthy)

SELECT 'PG_TRGM_EXTENSION_MISSING' AS anomaly, 'pg_trgm' AS object
 WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')
UNION ALL
SELECT 'TRGM_INDEX_MISSING', 'idx_tariffs_description_trgm'
 WHERE to_regclass('public.idx_tariffs_description_trgm') IS NULL;
