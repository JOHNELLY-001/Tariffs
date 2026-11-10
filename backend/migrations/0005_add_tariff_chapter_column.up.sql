-- 0005 — Add cet_tariffs.chapter_code
-- FORWARD — additive nullable column
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_tariffs
  ADD COLUMN IF NOT EXISTS chapter_code VARCHAR(2);
