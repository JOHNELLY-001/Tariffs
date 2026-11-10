-- 0002 — Add cet_chapter_notes.section_code
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'SECTION_CODE_COLUMN_MISSING' AS anomaly
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cet_chapter_notes'
      AND column_name = 'section_code'
 );
