-- 0003 — Load the reviewed chapter-to-section mapping
-- FORWARD — updates ONLY the new nullable section_code column
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

UPDATE cet_chapter_notes c
   SET section_code = m.section_code
  FROM chapter_section_mapping_staging m
 WHERE lpad(c.chapter_code, 2, '0') = lpad(m.chapter_code, 2, '0')
   AND c.section_code IS DISTINCT FROM m.section_code;
