-- 0006 — Derive tariff chapter codes from validated HS codes
-- FORWARD — fills ONLY the new nullable chapter_code column for resolvable rows
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

WITH parsed AS (
  SELECT t.id,
         left(regexp_replace(t.hs_code, '[^0-9]', '', 'g'), 2) AS derived_chapter
    FROM cet_tariffs t
   WHERE t.hs_code IS NOT NULL
     AND t.chapter_code IS NULL
)
UPDATE cet_tariffs t
   SET chapter_code = p.derived_chapter
  FROM parsed p
  JOIN cet_chapter_notes c
    ON lpad(c.chapter_code, 2, '0') = p.derived_chapter
 WHERE t.id = p.id;
