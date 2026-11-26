CREATE TABLE IF NOT EXISTS import_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  destination TEXT NOT NULL,
  simulation_date DATE NOT NULL,
  reference TEXT,
  hs_code_input TEXT NOT NULL,
  hs_code_normalized TEXT NOT NULL,
  tariff_id BIGINT REFERENCES cet_tariffs(id),
  sensitive_tariff_id BIGINT REFERENCES cet_tariffs(id),
  origin_country CHAR(2),
  currency CHAR(3) NOT NULL,
  invoice_value NUMERIC(18,6) NOT NULL,
  freight NUMERIC(18,6) NOT NULL DEFAULT 0,
  insurance NUMERIC(18,6) NOT NULL DEFAULT 0,
  other_costs NUMERIC(18,6) NOT NULL DEFAULT 0,
  other_costs_included NUMERIC(18,6) NOT NULL DEFAULT 0,
  quantity_value NUMERIC(18,6),
  quantity_unit TEXT,
  preferential_treatment BOOLEAN NOT NULL DEFAULT FALSE,
  exchange_rate NUMERIC(18,6),
  exchange_rate_source TEXT,
  exchange_rate_effective_date DATE,
  customs_value NUMERIC(18,6),
  customs_currency CHAR(3) NOT NULL DEFAULT 'TZS',
  total_import_charges NUMERIC(18,6),
  estimated_landed_cost NUMERIC(18,6),
  state TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  tariff_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  tax_rule_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_calculations_state_check CHECK (state IN ('calculated','completed','partially_calculated','unsupported','needs_review','failed'))
);

CREATE INDEX IF NOT EXISTS idx_import_calculations_created_at ON import_calculations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_calculations_hs_code ON import_calculations (hs_code_normalized);

CREATE TABLE IF NOT EXISTS import_calculation_charges (
  id BIGSERIAL PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES import_calculations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_type TEXT NOT NULL,
  rate_type TEXT NOT NULL,
  rate TEXT NOT NULL,
  taxable_base NUMERIC(18,6) NOT NULL,
  formula TEXT NOT NULL,
  amount NUMERIC(18,6) NOT NULL,
  currency CHAR(3) NOT NULL,
  source TEXT NOT NULL,
  rule_id TEXT,
  rule_version TEXT,
  calculation_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_calculation_charges_calculation_id ON import_calculation_charges (calculation_id);