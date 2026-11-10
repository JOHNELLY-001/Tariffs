-- 0002 — Add cet_chapter_notes.section_code
-- ROLLBACK
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_chapter_notes DROP COLUMN IF EXISTS section_code;
