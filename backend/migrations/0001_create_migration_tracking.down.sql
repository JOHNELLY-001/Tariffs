-- 0001 — Create migration tracking table
-- ROLLBACK — only the bookkeeping table is dropped
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

DROP TABLE IF EXISTS cet_schema_migrations;
