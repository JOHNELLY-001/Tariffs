-- 0007 — Add tariff→chapter foreign key and index
-- ROLLBACK
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_tariffs DROP CONSTRAINT IF EXISTS fk_tariff_chapter;
DROP INDEX IF EXISTS idx_tariffs_chapter_code;
