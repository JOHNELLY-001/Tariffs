import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { databaseError, databaseNotConfigured } from '../shared/errors/app-error.js';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Shared PostgreSQL connection pool (node-postgres).
 *
 * The pool is created lazily so the process can boot — and serve
 * `/health/live` plus documentation — even when DATABASE_URL is not yet
 * configured. Every database call goes through `query()`, which uses
 * parameterized SQL only.
 */

let pool: Pool | undefined;

export function isDatabaseConfigured(): boolean {
  return env.isDatabaseConfigured;
}

export function getPool(): Pool {
  if (!env.DATABASE_URL) {
    throw databaseNotConfigured();
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
      statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      query_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      application_name: 'cet-tariff-backend',
      keepAlive: true,
      // Neon presents a managed certificate chain; TLS remains mandatory.
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    });

    pool.on('error', (error) => {
      // Idle client failures must never crash the process.
      logger.error({ err: error }, 'postgres pool reported an idle client error');
    });
  }

  return pool;
}

/**
 * Execute a parameterized query. `values` are always passed separately from
 * the SQL text; no user input is ever concatenated.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const activePool = getPool();
  try {
    return await activePool.query<T>(text, values as unknown[]);
  } catch (error) {
    logger.error({ err: error, sqlHint: text.slice(0, 120) }, 'database query failed');
    throw databaseError(error);
  }
}

/** Run work inside a transaction, always releasing the client. */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface DatabaseHealth {
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
}

/** Bounded readiness probe. Never returns connection details. */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!env.isDatabaseConfigured) {
    return { configured: false, connected: false, latencyMs: null };
  }

  const startedAt = process.hrtime.bigint();
  try {
    await query('SELECT 1 AS ok');
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    return { configured: true, connected: true, latencyMs: Math.round(latencyMs * 100) / 100 };
  } catch {
    return { configured: true, connected: false, latencyMs: null };
  }
}

/** Close the pool during graceful shutdown. */
export async function closePool(): Promise<void> {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}
