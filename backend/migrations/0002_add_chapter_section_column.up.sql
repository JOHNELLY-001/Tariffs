-- 0002 — Add cet_chapter_notes.section_code
-- FORWARD — additive nullable column; neither data nor existing columns change
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_chapter_notes
  ADD COLUMN IF NOT EXISTS section_code VARCHAR(10);
