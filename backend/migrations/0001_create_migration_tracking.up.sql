-- 0001 — Create migration tracking table
-- FORWARD — additive; no project data touched
-- Part of the M2 migration proposal. NOT applied without explicit owner approval.

CREATE TABLE IF NOT EXISTS cet_schema_migrations (
  version     VARCHAR(4)  PRIMARY KEY,
  description TEXT        NOT NULL,
  checksum    CHAR(64)    NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by  TEXT        NOT NULL
);
