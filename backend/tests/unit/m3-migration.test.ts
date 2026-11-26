import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { discoverMigrations } from '../../scripts/migrate.js';

describe('M3 migration content', () => {
  it('creates the btree_gist extension and an exclusion constraint', async () => {
    const migrations = await discoverMigrations();
    const m3 = migrations.find((m) => m.version === '0011');
    expect(m3).toBeDefined();
    const up = await readFile(m3!.files.up, 'utf8');
    expect(up).toMatch(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+btree_gist/i);
    expect(up).toMatch(/EXCLUDE\s+USING\s+gist/i);
    expect(up).toMatch(/daterange\(effective_from,\s*COALESCE\(effective_to,\s*'infinity'::date\),\s*'\[\]'\)/i);
  });

  it('preflight checks both tables', async () => {
    const migrations = await discoverMigrations();
    const m3 = migrations.find((m) => m.version === '0011');
    const preflight = await readFile(m3!.files.preflight, 'utf8');
    expect(preflight).toMatch(/import_tax_rules/);
    expect(preflight).toMatch(/import_tax_rule_dependencies/);
  });

  it('postflight checks columns, constraints, indexes and extension', async () => {
    const migrations = await discoverMigrations();
    const m3 = migrations.find((m) => m.version === '0011');
    const postflight = await readFile(m3!.files.postflight, 'utf8');
    expect(postflight).toMatch(/missing_extension_btree_gist/);
    expect(postflight).toMatch(/import_tax_rules_no_overlap/);
    expect(postflight).toMatch(/idx_import_tax_rules_scope/);
    expect(postflight).toMatch(/verification_status/);
  });

  it('up migration is accepted by the safety guard', async () => {
    const migrations = await discoverMigrations();
    const m3 = migrations.find((m) => m.version === '0011');
    const { assertUpStatementsSafe } = await import('../../scripts/migrate.js');
    const up = await readFile(m3!.files.up, 'utf8');
    expect(() => assertUpStatementsSafe(up)).not.toThrow();
  });
});