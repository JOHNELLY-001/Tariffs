import pg from 'pg';
import { env } from '../src/config/env.js';

/**
 * Read-only schema inspection.
 *
 * Establishes the live schema, constraints, indexes and row counts before any
 * implementation or migration decision. Runs entirely inside a read-only
 * transaction and prints no connection details or credentials.
 */

interface Section {
  title: string;
  sql: string;
}

const sections: Section[] = [
  {
    title: 'Connection',
    sql: `SELECT current_database() AS database,
                 current_user AS role,
                 current_setting('transaction_read_only') AS read_only,
                 version() AS server_version`,
  },
  {
    title: 'Columns',
    sql: `SELECT table_name, ordinal_position, column_name, data_type,
                 character_maximum_length AS max_length, is_nullable, column_default
            FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name IN ('cet_tariffs','cet_section_notes','cet_chapter_notes','cet_subheading_notes')
           ORDER BY table_name, ordinal_position`,
  },
  {
    title: 'Constraints',
    sql: `SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
                 kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
           WHERE tc.table_schema = 'public'
             AND tc.table_name IN ('cet_tariffs','cet_section_notes','cet_chapter_notes','cet_subheading_notes')
           ORDER BY tc.table_name, tc.constraint_name`,
  },
  {
    title: 'Indexes',
    sql: `SELECT tablename, indexname, indexdef
            FROM pg_indexes
           WHERE schemaname = 'public'
             AND tablename IN ('cet_tariffs','cet_section_notes','cet_chapter_notes','cet_subheading_notes')
           ORDER BY tablename, indexname`,
  },
  {
    title: 'Row counts',
    sql: `SELECT 'cet_tariffs' AS table_name, COUNT(*) AS total FROM cet_tariffs
          UNION ALL SELECT 'cet_chapter_notes', COUNT(*) FROM cet_chapter_notes
          UNION ALL SELECT 'cet_section_notes', COUNT(*) FROM cet_section_notes
          UNION ALL SELECT 'cet_subheading_notes', COUNT(*) FROM cet_subheading_notes`,
  },
  {
    title: 'Extensions',
    sql: `SELECT e.extname, e.extversion
            FROM pg_extension e
           WHERE e.extname IN ('pg_trgm','unaccent')
           ORDER BY e.extname`,
  },
];

async function main(): Promise<void> {
  if (!env.DATABASE_URL) {
    console.error('DATABASE_URL is not configured. Set it in backend/.env.local first.');
    process.exitCode = 1;
    return;
  }

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    application_name: 'cet-db-check',
    statement_timeout: 20_000,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    for (const section of sections) {
      const result = await client.query(section.sql);
      console.log(`\n=== ${section.title} (${result.rows.length} rows) ===`);
      console.table(result.rows);
    }
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(`Inspection failed: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
