-- 0003 — Load the reviewed chapter-to-section mapping
-- ROLLBACK — clears only the derived mapping values
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

-- The mapping is derived, not source text. Review before rolling back.
UPDATE cet_chapter_notes SET section_code = NULL;
