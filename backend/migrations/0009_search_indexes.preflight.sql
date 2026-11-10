-- 0009 — Add search and normalized-code indexes
-- PREFLIGHT — blocks if the table is large enough that a non-concurrent build needs review
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'LARGE_TABLE_REVIEW_REQUIRED' AS issue, c.reltuples::bigint::text AS approx_rows
  FROM pg_class c
 WHERE c.oid = to_regclass('public.cet_tariffs')
   AND c.reltuples > 500000;
