-- 0008 — Enforce subheading-note ownership
-- PREFLIGHT — must return zero rows
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'INVALID_OWNER' AS issue, n.id::text AS detail,
       COALESCE(n.chapter_code, '(null)') AS chapter_code,
       COALESCE(n.section_code, '(null)') AS section_code
  FROM cet_subheading_notes n
 WHERE (n.chapter_code IS NULL AND n.section_code IS NULL)
    OR (n.chapter_code IS NOT NULL AND n.section_code IS NOT NULL);
