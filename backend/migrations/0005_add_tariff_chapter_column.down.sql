-- 0005 — Add cet_tariffs.chapter_code
-- ROLLBACK
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_tariffs DROP COLUMN IF EXISTS chapter_code;
