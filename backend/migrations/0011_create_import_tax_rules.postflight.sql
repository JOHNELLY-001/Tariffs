-- Postflight: return one row per missing table, column, constraint, index or extension.
SELECT 'missing_table_import_tax_rules' AS anomaly
  WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'import_tax_rules')
UNION ALL
SELECT 'missing_table_import_tax_rule_dependencies'
  WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'import_tax_rule_dependencies')
UNION ALL
SELECT 'missing_extension_btree_gist'
  WHERE NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
UNION ALL
SELECT 'missing_column_' || col
  FROM (VALUES
    ('id'),('rule_code'),('rule_scope'),('jurisdiction'),('tax_name'),('tax_type'),
    ('rate_type'),('rate_value'),('rate_expression'),('calculation_base'),
    ('calculation_order'),('applicability_conditions'),('exemption_conditions'),
    ('effective_from'),('effective_to'),('source_title'),('source_url'),
    ('source_provision'),('verification_status'),('dependencies'),
    ('supersedes_rule_id'),('created_at'),('updated_at')
  ) AS required(col)
  WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'import_tax_rules' AND column_name = required.col)
UNION ALL
SELECT 'missing_constraint_' || con
  FROM (VALUES
    ('import_tax_rules_pkey'),('import_tax_rules_effective_range'),
    ('import_tax_rules_verification_status'),('import_tax_rules_unique_version'),
    ('import_tax_rules_no_overlap'),('import_tax_rule_dependencies_pkey'),
    ('import_tax_rule_dependencies_no_self')
  ) AS required(con)
  WHERE NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = required.con)
UNION ALL
SELECT 'missing_index_' || idx
  FROM (VALUES
    ('idx_import_tax_rules_scope'),('idx_import_tax_rules_status'),
    ('idx_import_tax_rule_dependencies_dep')
  ) AS required(idx)
  WHERE NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = required.idx);