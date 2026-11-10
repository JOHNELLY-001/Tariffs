-- 0007 — Add tariff→chapter foreign key and index
-- FORWARD
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_tariffs DROP CONSTRAINT IF EXISTS fk_tariff_chapter;

ALTER TABLE cet_tariffs
  ADD CONSTRAINT fk_tariff_chapter
  FOREIGN KEY (chapter_code)
  REFERENCES cet_chapter_notes(chapter_code)
  NOT VALID;

ALTER TABLE cet_tariffs VALIDATE CONSTRAINT fk_tariff_chapter;

CREATE INDEX IF NOT EXISTS idx_tariffs_chapter_code
  ON cet_tariffs(chapter_code);
