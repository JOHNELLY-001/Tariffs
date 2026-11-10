-- 0007 — Add tariff→chapter foreign key and index
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'FK_MISSING' AS anomaly, 'fk_tariff_chapter' AS object
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'fk_tariff_chapter' AND contype = 'f'
 )
UNION ALL
SELECT 'FK_NOT_VALIDATED', conname
  FROM pg_constraint WHERE conname = 'fk_tariff_chapter' AND NOT convalidated
UNION ALL
SELECT 'INDEX_MISSING', 'idx_tariffs_chapter_code'
 WHERE to_regclass('public.idx_tariffs_chapter_code') IS NULL;
