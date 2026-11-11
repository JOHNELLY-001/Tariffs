-- 0009 — Add core search, schedule and normalized-code indexes
-- FORWARD — core PostgreSQL only. NO extension is required or created.
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.
--
-- The description-search endpoints use to_tsvector/websearch_to_tsquery, which
-- are core PostgreSQL functions. The trigram indexes that need the optional
-- pg_trgm extension live in 0010 and are applied separately.

-- Full-text search over descriptions, matching the query in search.repository.ts.
CREATE INDEX IF NOT EXISTS idx_tariffs_description_fts
  ON cet_tariffs USING gin (to_tsvector('simple', COALESCE(description, '')));

-- Exact/prefix HS-code lookup on the same normalization the application uses.
CREATE INDEX IF NOT EXISTS idx_tariffs_hs_code_normalized
  ON cet_tariffs ((regexp_replace(hs_code, '[^0-9]', '', 'g')));

-- Schedule filtering (MAIN_TARIFF / SENSITIVE_ITEMS) and schedule-aware ordering.
CREATE INDEX IF NOT EXISTS idx_tariffs_schedule_type
  ON cet_tariffs (schedule_type);
