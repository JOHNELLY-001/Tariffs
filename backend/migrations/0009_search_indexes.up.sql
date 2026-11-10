-- 0009 — Add search and normalized-code indexes
-- FORWARD — indexes and one extension; no table data changes
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search over descriptions, matching the query in search.repository.ts.
CREATE INDEX IF NOT EXISTS idx_tariffs_description_fts
  ON cet_tariffs USING gin (to_tsvector('simple', COALESCE(description, '')));

-- Partial/typo tolerance for product-name fragments.
CREATE INDEX IF NOT EXISTS idx_tariffs_description_trgm
  ON cet_tariffs USING gin (description gin_trgm_ops);

-- Exact/prefix HS-code lookup on the same normalization the application uses.
CREATE INDEX IF NOT EXISTS idx_tariffs_hs_code_normalized
  ON cet_tariffs ((regexp_replace(hs_code, '[^0-9]', '', 'g')));
