-- 0004 — Add chapter→section foreign key and index
-- FORWARD — constraint added NOT VALID, then validated without blocking writes for long
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_chapter_notes DROP CONSTRAINT IF EXISTS fk_chapter_section;

ALTER TABLE cet_chapter_notes
  ADD CONSTRAINT fk_chapter_section
  FOREIGN KEY (section_code)
  REFERENCES cet_section_notes(section_code)
  NOT VALID;

ALTER TABLE cet_chapter_notes VALIDATE CONSTRAINT fk_chapter_section;

CREATE INDEX IF NOT EXISTS idx_chapter_section_code
  ON cet_chapter_notes(section_code);
