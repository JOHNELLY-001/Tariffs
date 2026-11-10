import { describe, expect, it } from 'vitest';
import {
  assertDownStatementsSafe,
  assertUpStatementsSafe,
  discoverMigrations,
  stripSqlComments,
} from '../../scripts/migrate.js';

describe('migration discovery', () => {
  it('discovers the proposal in version order with all required scripts', async () => {
    const migrations = await discoverMigrations();
    expect(migrations.length).toBeGreaterThanOrEqual(9);
    expect(migrations.map((migration) => migration.version)).toEqual(
      [...migrations.map((migration) => migration.version)].sort(),
    );
    for (const migration of migrations) {
      expect(migration.files.preflight).toMatch(/\.preflight\.sql$/);
      expect(migration.files.up).toMatch(/\.up\.sql$/);
      expect(migration.files.postflight).toMatch(/\.postflight\.sql$/);
      expect(migration.files.down).toMatch(/\.down\.sql$/);
    }
  });
});

describe('forward migration guard', () => {
  it('allows additive DDL', () => {
    expect(() =>
      assertUpStatementsSafe('ALTER TABLE cet_chapter_notes ADD COLUMN IF NOT EXISTS section_code VARCHAR(10);'),
    ).not.toThrow();
  });

  it('allows an UPDATE limited to derived columns', () => {
    expect(() => assertUpStatementsSafe('UPDATE cet_tariffs SET chapter_code = NULL;')).not.toThrow();
  });

  it('rejects TRUNCATE', () => {
    expect(() => assertUpStatementsSafe('TRUNCATE cet_tariffs;')).toThrow(/TRUNCATE/);
  });

  it('rejects DELETE FROM', () => {
    expect(() => assertUpStatementsSafe('DELETE FROM cet_tariffs WHERE id = 1;')).toThrow(/DELETE/);
  });

  it('rejects DROP TABLE on a protected table', () => {
    expect(() => assertUpStatementsSafe('DROP TABLE cet_section_notes;')).toThrow(/DROP TABLE/);
    expect(() => assertUpStatementsSafe('drop table if exists public.cet_tariffs;')).toThrow(/DROP TABLE/);
  });

  it('rejects DROP COLUMN on a protected table', () => {
    expect(() =>
      assertUpStatementsSafe('ALTER TABLE cet_chapter_notes DROP COLUMN chapter_notes;'),
    ).toThrow(/DROP COLUMN/);
  });

  it('does not treat comments as statements', () => {
    expect(() =>
      assertUpStatementsSafe('-- we never TRUNCATE cet_tariffs\nALTER TABLE cet_tariffs ADD COLUMN note TEXT;'),
    ).not.toThrow();
  });

  it('strips block comments before inspection', () => {
    expect(stripSqlComments('/* DROP TABLE cet_tariffs */')).toBe('');
  });
});

describe('rollback guard', () => {
  it('allows reverting objects', () => {
    expect(() =>
      assertDownStatementsSafe('ALTER TABLE cet_chapter_notes DROP COLUMN IF EXISTS section_code;'),
    ).not.toThrow();
  });

  it('rejects data removal', () => {
    expect(() => assertDownStatementsSafe('DELETE FROM cet_tariffs;')).toThrow(/DELETE/);
    expect(() => assertDownStatementsSafe('TRUNCATE cet_tariffs;')).toThrow(/TRUNCATE/);
  });

  it('rejects dropping project tables', () => {
    expect(() => assertDownStatementsSafe('DROP TABLE cet_tariffs;')).toThrow(/tracking table/);
  });
});
