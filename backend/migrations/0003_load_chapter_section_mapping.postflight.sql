-- 0003 — Load the reviewed chapter-to-section mapping
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'WRONG_SECTION_MAPPED' AS anomaly, c.chapter_code, c.section_code, m.section_code AS expected
  FROM cet_chapter_notes c
  JOIN chapter_section_mapping_staging m
    ON lpad(m.chapter_code, 2, '0') = lpad(c.chapter_code, 2, '0')
 WHERE c.section_code IS DISTINCT FROM m.section_code
UNION ALL
SELECT 'MAPPING_NOT_APPLIED', c.chapter_code, NULL, 'missing'
  FROM cet_chapter_notes c
  LEFT JOIN chapter_section_mapping_staging m
    ON lpad(m.chapter_code, 2, '0') = lpad(c.chapter_code, 2, '0')
 WHERE m.chapter_code IS NULL;
