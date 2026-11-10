-- 0004 — Add chapter→section foreign key and index
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'FK_MISSING' AS anomaly, 'fk_chapter_section' AS object
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'fk_chapter_section' AND contype = 'f'
 )
UNION ALL
SELECT 'FK_NOT_VALIDATED', conname
  FROM pg_constraint WHERE conname = 'fk_chapter_section' AND NOT convalidated
UNION ALL
SELECT 'INDEX_MISSING', 'idx_chapter_section_code'
 WHERE to_regclass('public.idx_chapter_section_code') IS NULL;
