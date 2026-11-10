-- 0006 — Derive tariff chapter codes from validated HS codes
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'BACKFILL_INCOMPLETE' AS anomaly, COUNT(*)::text AS affected
  FROM cet_tariffs t
  JOIN cet_chapter_notes c
    ON lpad(c.chapter_code, 2, '0') = left(regexp_replace(t.hs_code, '[^0-9]', '', 'g'), 2)
 WHERE t.chapter_code IS NULL
   AND t.hs_code IS NOT NULL
HAVING COUNT(*) > 0;
