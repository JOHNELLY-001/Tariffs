import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../src/config/env.js';

/**
 * Guarded migration runner.
 *
 * Safety model:
 *  - `--dry-run` (default) executes ONLY the preflight queries, inside a
 *    read-only transaction, and reports blocking rows. Nothing is written.
 *  - `--apply` requires BOTH the flag and `ALLOW_MIGRATE=true` in the
 *    environment. Every migration body runs in a transaction, followed by a
 *    postflight anomaly check; any anomaly rolls the migration back.
 *  - `--down <version>` additionally requires `ALLOW_MIGRATE=true` and
 *    `--confirm-rollback`.
 *  - A static guard rejects destructive statements in forward migrations.
 *  - Applied migrations are recorded in `cet_schema_migrations` with a
 *    checksum of the forward SQL.
 *
 * Postflight convention: a postflight query returns ANOMALY ROWS. Zero rows
 * means healthy; any row aborts (and rolls back) the migration.
 */

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const TRACKING_TABLE = 'cet_schema_migrations';
const PROTECTED_TABLES = ['cet_tariffs', 'cet_section_notes', 'cet_chapter_notes', 'cet_subheading_notes'];

export interface Migration {
  version: string;
  name: string;
  files: {
    preflight: string;
    up: string;
    postflight: string;
    down: string | null;
  };
}

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reject destructive statements in forward migrations. */
export function assertUpStatementsSafe(sql: string): void {
  const body = stripSqlComments(sql).toUpperCase();
  const violations: string[] = [];

  if (/\bTRUNCATE\b/.test(body)) violations.push('TRUNCATE is not permitted in a forward migration');
  if (/\bDELETE\s+FROM\b/.test(body)) violations.push('DELETE FROM is not permitted in a forward migration');

  for (const table of PROTECTED_TABLES) {
    const upper = table.toUpperCase();
    if (new RegExp(`\\bDROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?(PUBLIC\\.)?${upper}\\b`).test(body)) {
      violations.push(`DROP TABLE ${table} is forbidden`);
    }
    if (new RegExp(`\\bALTER\\s+TABLE\\s+(ONLY\\s+)?(PUBLIC\\.)?${upper}\\b[^;]*\\bDROP\\s+COLUMN\\b`).test(body)) {
      violations.push(`ALTER TABLE ${table} ... DROP COLUMN is forbidden in a forward migration`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Unsafe forward migration:\n - ${violations.join('\n - ')}`);
  }
}

/** Rollback scripts may drop their own objects, but never data rows. */
export function assertDownStatementsSafe(sql: string): void {
  const body = stripSqlComments(sql).toUpperCase();
  const violations: string[] = [];

  if (/\bTRUNCATE\b/.test(body)) violations.push('TRUNCATE is never permitted');
  if (/\bDELETE\s+FROM\b/.test(body)) violations.push('DELETE FROM is never permitted');

  const dropTableMatches = body.match(/\bDROP\s+TABLE\s+(IF\s+EXISTS\s+)?(PUBLIC\.)?([A-Z_]+)/g) ?? [];
  for (const statement of dropTableMatches) {
    if (!statement.includes(TRACKING_TABLE.toUpperCase())) {
      violations.push(`Rollback may only drop the migration tracking table, found: ${statement}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Unsafe rollback script:\n - ${violations.join('\n - ')}`);
  }
}

export async function discoverMigrations(): Promise<Migration[]> {
  const entries = await readdir(migrationsDir);
  const versions = [
    ...new Set(
      entries
        .filter((entry) => /^\d{4}_.+\.up\.sql$/.test(entry))
        .map((entry) => entry.slice(0, 4)),
    ),
  ].sort();

  const migrations: Migration[] = [];
  for (const version of versions) {
    const entry = entries.find((file) => file.startsWith(`${version}_`) && file.endsWith('.up.sql'));
    if (!entry) continue;
    const base = entry.slice(0, -'.up.sql'.length);
    const find = (suffix: string) => entries.find((file) => file === `${base}.${suffix}.sql`);
    const preflight = find('preflight');
    const postflight = find('postflight');
    if (!preflight || !postflight) {
      throw new Error(`Migration ${base} must provide .preflight.sql and .postflight.sql`);
    }
    migrations.push({
      version,
      name: base,
      files: {
        preflight: join(migrationsDir, preflight),
        up: join(migrationsDir, entry),
        postflight: join(migrationsDir, postflight),
        down: find('down') ? join(migrationsDir, find('down') as string) : null,
      },
    });
  }

  return migrations;
}

function readonlyConnection(): pg.Pool {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured for migration commands');
  }
  return new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    application_name: 'cet-migrate',
    statement_timeout: 60_000,
  });
}

async function tableExists(client: pg.PoolClient): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass('public.' || $1) IS NOT NULL AS exists`,
    [TRACKING_TABLE],
  );
  return result.rows[0]?.exists === true;
}

async function appliedVersions(client: pg.PoolClient): Promise<Map<string, string>> {
  if (!(await tableExists(client))) return new Map();
  const result = await client.query<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM ${TRACKING_TABLE}`,
  );
  return new Map(result.rows.map((row) => [row.version, row.checksum]));
}

async function reportPreflight(
  client: pg.PoolClient,
  migration: Migration,
  sql: string,
): Promise<number> {
  const result = await client.query(sql);
  if (result.rows.length > 0) {
    console.error(`\n✗ ${migration.name}: preflight returned ${result.rows.length} blocking row(s)`);
    console.error(JSON.stringify(result.rows, null, 2));
    return result.rows.length;
  }
  console.log(`✓ ${migration.name}: preflight clear`);
  return 0;
}

async function runPostflight(
  client: pg.PoolClient,
  migration: Migration,
  sql: string,
): Promise<number> {
  const result = await client.query(sql);
  if (result.rows.length > 0) {
    console.error(`\n✗ ${migration.name}: postflight reported anomalies`);
    console.error(JSON.stringify(result.rows, null, 2));
    return result.rows.length;
  }
  console.log(`✓ ${migration.name}: postflight healthy (0 anomalies)`);
  return 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const status = args.includes('--status');
  const apply = args.includes('--apply');
  const downIndex = args.indexOf('--down');
  const downVersion = downIndex >= 0 ? args[downIndex + 1] : undefined;
  const confirmRollback = args.includes('--confirm-rollback');

  const migrations = await discoverMigrations();
  for (const migration of migrations) {
    assertUpStatementsSafe(await readFile(migration.files.up, 'utf8'));
    if (migration.files.down) {
      assertDownStatementsSafe(await readFile(migration.files.down, 'utf8'));
    }
  }

  const pool = readonlyConnection();
  const client = await pool.connect();

  try {
    const applied = await appliedVersions(client);

    if (status) {
      console.log(`\nMigration state (${migrations.length} discovered):`);
      for (const migration of migrations) {
        const checksum = createHash('sha256')
          .update(await readFile(migration.files.up, 'utf8'))
          .digest('hex');
        const recorded = applied.get(migration.version);
        const state = !recorded ? 'pending' : recorded === checksum ? 'applied' : 'CHECKSUM MISMATCH';
        console.log(`  ${migration.version}  ${state.padEnd(16)} ${migration.name}`);
      }
      return;
    }

    if (downVersion) {
      if (!env.ALLOW_MIGRATE) {
        throw new Error('Refusing to roll back: set ALLOW_MIGRATE=true to enable data-changing commands');
      }
      if (!confirmRollback) {
        throw new Error('Refusing to roll back: pass --confirm-rollback after reviewing the down script');
      }
      const migration = migrations.find((item) => item.version === downVersion);
      if (!migration?.files.down) throw new Error(`No rollback script for version ${downVersion}`);

      const sql = await readFile(migration.files.down, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        if (await tableExists(client)) {
          await client.query(`DELETE FROM ${TRACKING_TABLE} WHERE version = $1`, [migration.version]);
        }
        await client.query('COMMIT');
        console.log(`✓ rolled back ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      return;
    }

    const pending = migrations.filter((migration) => !applied.has(migration.version));
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    if (!apply) {
      console.log(`\nDRY RUN — preflight only. ${pending.length} pending migration(s). Nothing will be written.\n`);
      for (const migration of pending) {
        await client.query('BEGIN TRANSACTION READ ONLY');
        try {
          await reportPreflight(client, migration, await readFile(migration.files.preflight, 'utf8'));
        } finally {
          await client.query('ROLLBACK');
        }
      }
      console.log('\nReview the proposal in docs/migrations/M2-proposal.md, then apply with:');
      console.log('  ALLOW_MIGRATE=true npm run db:migrate -- --apply\n');
      return;
    }

    if (!env.ALLOW_MIGRATE) {
      throw new Error('Refusing to apply: set ALLOW_MIGRATE=true to enable data-changing commands');
    }

    for (const migration of pending) {
      const upSql = await readFile(migration.files.up, 'utf8');
      const checksum = createHash('sha256').update(upSql).digest('hex');

      console.log(`\n→ ${migration.name}`);
      await client.query('BEGIN');
      try {
        await reportPreflight(client, migration, await readFile(migration.files.preflight, 'utf8'));
        await client.query(upSql);
        await runPostflight(client, migration, await readFile(migration.files.postflight, 'utf8'));
        await client.query(
          `INSERT INTO ${TRACKING_TABLE} (version, description, checksum, applied_at, applied_by)
           VALUES ($1, $2, $3, now(), current_user)
           ON CONFLICT (version) DO UPDATE
             SET checksum = EXCLUDED.checksum, applied_at = now(), applied_by = current_user`,
          [migration.version, migration.name, checksum],
        );
        await client.query('COMMIT');
        console.log(`✓ applied ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error(`✗ ${migration.name} rolled back`);
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]).replace(/\.(ts|js)$/, '') === fileURLToPath(import.meta.url).replace(/\.(ts|js)$/, '');

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
