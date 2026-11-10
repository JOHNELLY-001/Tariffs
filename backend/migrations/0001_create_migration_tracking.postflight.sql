-- 0001 — Create migration tracking table
-- POSTFLIGHT — anomalies reported as rows (zero rows = healthy)
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'TRACKING_TABLE_MISSING' AS anomaly
 WHERE NOT EXISTS (
   SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cet_schema_migrations'
 );
