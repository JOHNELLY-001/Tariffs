-- 0004 — Add chapter→section foreign key and index
-- ROLLBACK
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_chapter_notes DROP CONSTRAINT IF EXISTS fk_chapter_section;
DROP INDEX IF EXISTS idx_chapter_section_code;
