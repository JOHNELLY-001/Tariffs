-- Preflight: abort if either table already exists.
SELECT 1
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('import_tax_rules', 'import_tax_rule_dependencies');