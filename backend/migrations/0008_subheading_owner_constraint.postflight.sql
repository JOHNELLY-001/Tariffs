-- 0008 — Enforce subheading-note ownership
-- POSTFLIGHT
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

SELECT 'OWNER_CONSTRAINT_MISSING' AS anomaly
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_subheading_note_owner' AND contype = 'c'
 )
UNION ALL
SELECT 'OWNER_CONSTRAINT_NOT_VALIDATED', conname
  FROM pg_constraint
 WHERE conname = 'chk_subheading_note_owner' AND NOT convalidated;
