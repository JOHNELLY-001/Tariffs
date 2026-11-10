-- 0005 — Add cet_tariffs.chapter_code
-- PREFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'cet_tariffs'
   AND column_name = 'chapter_code'
   AND (data_type <> 'character varying' OR COALESCE(character_maximum_length, 0) <> 2);
