-- 0008 — Enforce subheading-note ownership
-- ROLLBACK
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_subheading_notes DROP CONSTRAINT IF EXISTS chk_subheading_note_owner;
