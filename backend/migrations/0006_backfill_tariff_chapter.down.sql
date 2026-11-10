-- 0006 — Derive tariff chapter codes from validated HS codes
-- ROLLBACK — clears only derived values
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

UPDATE cet_tariffs SET chapter_code = NULL WHERE chapter_code IS NOT NULL;
