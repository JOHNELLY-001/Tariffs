-- 0007 — Add tariff→chapter foreign key and index
-- PREFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'ORPHAN_CHAPTER_REFERENCE' AS issue, t.id::text AS detail, t.chapter_code
  FROM cet_tariffs t
  LEFT JOIN cet_chapter_notes c
    ON lpad(c.chapter_code, 2, '0') = t.chapter_code
 WHERE t.chapter_code IS NOT NULL AND c.chapter_code IS NULL
UNION ALL
SELECT 'CHAPTER_CODE_NOT_UNIQUE', c.chapter_code, COUNT(*)::text
  FROM cet_chapter_notes c
 GROUP BY c.chapter_code
HAVING COUNT(*) > 1;
