-- 0004 — Add chapter→section foreign key and index
-- PREFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'UNMAPPED_CHAPTER' AS issue, c.chapter_code::text AS detail
  FROM cet_chapter_notes c
 WHERE c.section_code IS NULL
UNION ALL
SELECT 'ORPHAN_SECTION_REFERENCE', c.chapter_code || ' → ' || c.section_code
  FROM cet_chapter_notes c
  LEFT JOIN cet_section_notes s ON s.section_code = c.section_code
 WHERE c.section_code IS NOT NULL AND s.section_code IS NULL
UNION ALL
SELECT 'SECTION_CODE_NOT_UNIQUE', s.section_code
  FROM cet_section_notes s
 GROUP BY s.section_code HAVING COUNT(*) > 1;
