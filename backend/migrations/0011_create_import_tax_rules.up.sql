CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS import_tax_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_code TEXT NOT NULL,
  rule_scope TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  tax_name TEXT NOT NULL,
  tax_type TEXT NOT NULL,
  rate_type TEXT NOT NULL,
  rate_value NUMERIC(18,6),
  rate_expression TEXT,
  calculation_base TEXT NOT NULL,
  calculation_order INTEGER NOT NULL,
  applicability_conditions JSONB,
  exemption_conditions JSONB,
  effective_from DATE NOT NULL,
  effective_to DATE,
  source_title TEXT NOT NULL,
  source_url TEXT,
  source_provision TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  supersedes_rule_id BIGINT REFERENCES import_tax_rules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_tax_rules_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT import_tax_rules_verification_status CHECK (verification_status IN ('VERIFIED','SECONDARY','UNVERIFIED')),
  CONSTRAINT import_tax_rules_unique_version UNIQUE (rule_scope, jurisdiction, effective_from),
  CONSTRAINT import_tax_rules_no_overlap EXCLUDE USING gist (
    rule_scope WITH =,
    jurisdiction WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS idx_import_tax_rules_scope ON import_tax_rules (rule_scope, jurisdiction, effective_from);
CREATE INDEX IF NOT EXISTS idx_import_tax_rules_status ON import_tax_rules (verification_status);

CREATE TABLE IF NOT EXISTS import_tax_rule_dependencies (
  rule_id BIGINT NOT NULL REFERENCES import_tax_rules(id) ON DELETE CASCADE,
  depends_on_rule_id BIGINT NOT NULL REFERENCES import_tax_rules(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, depends_on_rule_id),
  CONSTRAINT import_tax_rule_dependencies_no_self CHECK (rule_id <> depends_on_rule_id)
);

CREATE INDEX IF NOT EXISTS idx_import_tax_rule_dependencies_dep ON import_tax_rule_dependencies (depends_on_rule_id);