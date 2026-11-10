-- 0008 — Enforce subheading-note ownership
-- FORWARD
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

ALTER TABLE cet_subheading_notes
  DROP CONSTRAINT IF EXISTS chk_subheading_note_owner;

ALTER TABLE cet_subheading_notes
  ADD CONSTRAINT chk_subheading_note_owner
  CHECK (
    (chapter_code IS NOT NULL AND section_code IS NULL)
    OR
    (chapter_code IS NULL AND section_code IS NOT NULL)
  ) NOT VALID;

ALTER TABLE cet_subheading_notes VALIDATE CONSTRAINT chk_subheading_note_owner;
