-- 0010 — OPTIONAL: trigram indexes for partial/fuzzy description matching
-- FORWARD — creates one extension and one index; no table data changes
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tariffs_description_trgm
  ON cet_tariffs USING gin (description gin_trgm_ops);
