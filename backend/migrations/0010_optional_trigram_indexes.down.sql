-- 0010 — OPTIONAL: trigram indexes for partial/fuzzy description matching
-- ROLLBACK — drops the index only; the shared extension is intentionally kept

DROP INDEX IF EXISTS idx_tariffs_description_trgm;
