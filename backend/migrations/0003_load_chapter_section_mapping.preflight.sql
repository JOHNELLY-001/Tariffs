-- 0003 — Load the reviewed chapter-to-section mapping
-- PREFLIGHT — requires chapter_section_mapping_staging to be loaded from migrations/data/chapter_section_mapping.csv
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

-- If the staging table has not been loaded this query errors, which safely
-- aborts the migration. Every row returned here is a blocking problem.
SELECT 'CHAPTER_WITHOUT_MAPPING' AS issue, c.chapter_code::text AS detail
  FROM cet_chapter_notes c
  LEFT JOIN chapter_section_mapping_staging m
    ON lpad(m.chapter_code, 2, '0') = lpad(c.chapter_code, 2, '0')
 WHERE m.chapter_code IS NULL
UNION ALL
SELECT 'UNKNOWN_SECTION_CODE', m.section_code
  FROM chapter_section_mapping_staging m
  LEFT JOIN cet_section_notes s ON s.section_code = m.section_code
 WHERE s.section_code IS NULL
UNION ALL
SELECT 'DUPLICATE_STAGING_CHAPTER', d.chapter_code
  FROM (
    SELECT chapter_code FROM chapter_section_mapping_staging
     GROUP BY chapter_code HAVING COUNT(*) > 1
  ) d
UNION ALL
SELECT 'MAPPING_SOURCE_PAGE_MISSING', m.chapter_code
  FROM chapter_section_mapping_staging m
 WHERE m.source_page IS NULL OR m.source_reference IS NULL OR btrim(m.source_reference) = '';
