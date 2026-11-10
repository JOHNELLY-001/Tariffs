-- 0001 — Create migration tracking table
-- PREFLIGHT — blocking rows abort the migration
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

-- Blocking: a table with this name already exists with an unexpected shape.
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'cet_schema_migrations'
   AND column_name NOT IN ('version', 'description', 'checksum', 'applied_at', 'applied_by');
