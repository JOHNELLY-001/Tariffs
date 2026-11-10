-- 0002 — Add cet_chapter_notes.section_code
-- PREFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

-- Blocking: the column exists with an unexpected type or length.
SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'cet_chapter_notes'
   AND column_name = 'section_code'
   AND (data_type <> 'character varying' OR COALESCE(character_maximum_length, 0) <> 10);
