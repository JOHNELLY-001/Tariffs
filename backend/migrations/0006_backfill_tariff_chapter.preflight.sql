-- 0006 — Derive tariff chapter codes from validated HS codes
-- PREFLIGHT — any row here needs owner review before proceeding
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'MALFORMED_HS_CODE' AS issue, t.id::text AS detail, t.hs_code
  FROM cet_tariffs t
 WHERE t.hs_code IS NOT NULL
   AND regexp_replace(t.hs_code, '[^0-9]', '', 'g') !~ '^[0-9]{2}'
UNION ALL
SELECT 'UNRESOLVED_CHAPTER', t.id::text, t.hs_code
  FROM cet_tariffs t
  LEFT JOIN cet_chapter_notes c
    ON lpad(c.chapter_code, 2, '0') = left(regexp_replace(t.hs_code, '[^0-9]', '', 'g'), 2)
 WHERE t.hs_code IS NOT NULL
   AND regexp_replace(t.hs_code, '[^0-9]', '', 'g') ~ '^[0-9]{2}'
   AND c.chapter_code IS NULL
LIMIT 200;
