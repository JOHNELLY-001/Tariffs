SELECT 'missing_table_import_calculations' AS anomaly
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='import_calculations')
UNION ALL
SELECT 'missing_table_import_calculation_charges'
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='import_calculation_charges')
UNION ALL
SELECT 'missing_column_' || col
  FROM (VALUES ('id'),('state'),('rule_version'),('tariff_snapshot'),('tax_rule_versions')) AS required(col)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='import_calculations' AND column_name=required.col)
UNION ALL
SELECT 'missing_fk_import_calculation_charges'
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='import_calculation_charges' AND constraint_type='FOREIGN KEY');