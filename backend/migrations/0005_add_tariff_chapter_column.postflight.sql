-- 0005 — Add cet_tariffs.chapter_code
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'CHAPTER_CODE_COLUMN_MISSING' AS anomaly
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cet_tariffs'
      AND column_name = 'chapter_code'
 );
