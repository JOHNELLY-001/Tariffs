import { readFileSync } from 'node:fs';
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
 *
 * TLS policy:
 *  - `sslmode` is removed from the connection string so pg-connection-string
 *    cannot apply ambiguous/legacy semantics (or emit its v2 deprecation
 *    warning). TLS is configured explicitly here instead.
 *  - Certificates are verified by default (`DATABASE_SSL_VERIFY=true`).
 *  - A private CA (for example Neon's root certificate) can be supplied with
 *    `DATABASE_SSL_CA_PATH`.
 *  - `sslmode=disable` in the URL is still honoured as an explicit opt-out.
 */



let pool: Pool | undefined;
let warnedAboutVerification = false;

export interface ConnectionConfig {
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
}

function readCa(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `DATABASE_SSL_CA_PATH could not be read (${(error as NodeJS.ErrnoException).code ?? 'unknown error'}). ` +
        'Provide a readable PEM file or unset the variable.',
    );
  }
}

/**
 * Build pool configuration from the validated environment.
 *
 * Exported so the migration runner and inspection scripts use exactly the same
 * TLS and connection semantics as the API.
 */
export function buildConnectionConfig(options: { applicationName?: string } = {}): ConnectionConfig {
  if (!env.DATABASE_URL) {
    throw databaseNotConfigured();
  }

  const url = new URL(env.DATABASE_URL);
  const requestedSslMode = url.searchParams.get('sslmode')?.toLowerCase() ?? null;

  // Removed deliberately: our explicit `ssl` object is authoritative.
  url.searchParams.delete('sslmode');
  url.searchParams.delete('uselibpqcompat');

  const sslDisabledByUrl = requestedSslMode === 'disable';
  const sslEnabled = env.DATABASE_SSL && !sslDisabledByUrl;

  if (!sslEnabled) {
    if (!env.DATABASE_SSL_VERIFY) {
      logger.warn('TLS is disabled for the tariff database connection (DATABASE_SSL=false or sslmode=disable).');
    }
    return { connectionString: url.toString(), ssl: false };
  }

  const ca = readCa(env.DATABASE_SSL_CA_PATH);

  if (!env.DATABASE_SSL_VERIFY && !warnedAboutVerification) {
    warnedAboutVerification = true;
    logger.warn(
      'TLS certificate verification is DISABLED (DATABASE_SSL_VERIFY=false). Set DATABASE_SSL_CA_PATH to the database CA and re-enable verification.',
    );
  }

  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: env.DATABASE_SSL_VERIFY,
      ...(ca ? { ca } : {}),
    },
  };
}

export function isDatabaseConfigured(): boolean {
  return env.isDatabaseConfigured;
}

export function getPool(): Pool {
  if (!pool) {
    const connection = buildConnectionConfig();
    pool = new Pool({
      ...connection,
      max: env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
      statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      query_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
      application_name: 'cet-tariff-backend',
      keepAlive: true,
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
