-- 0010 — OPTIONAL: trigram indexes for partial/fuzzy description matching
-- PREFLIGHT — blocking rows abort the migration
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.
--
-- This migration is separate from 0009 because it requires the pg_trgm
-- extension, which needs the `CREATE EXTENSION` privilege on the target
-- database. The API works without it; the extension only improves partial and
-- typo-tolerant matching performance.

SELECT 'PG_TRGM_NOT_AVAILABLE' AS issue, 'pg_trgm is not installed on this server' AS detail
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm'
 )
UNION ALL
SELECT 'LARGE_TABLE_REVIEW_REQUIRED', c.reltuples::bigint::text
  FROM pg_class c
 WHERE c.oid = to_regclass('public.cet_tariffs')
   AND c.reltuples > 500000;
