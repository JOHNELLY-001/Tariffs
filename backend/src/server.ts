import { createServer } from 'node:http';
import { createApp } from './app.js';
import { closePool } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

/**
 * Process entry point.
 *
 * Owns the HTTP server lifecycle: listen, request timeout, and graceful
 * shutdown that stops accepting connections and closes the PostgreSQL pool.
 */

const app = createApp();
const server = createServer(app);

// Bound how long a single request may occupy a connection.
server.requestTimeout = env.REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

if (!env.isDatabaseConfigured) {
  logger.warn(
    'DATABASE_URL is not configured — tariff endpoints will return 503 until it is set. /health/live and the API documentation remain available.',
  );
}

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, apiBasePath: env.API_BASE_PATH },
    'CET tariff backend listening',
  );
});

let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ reason }, 'shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  try {
    await closePool();
  } catch (error) {
    logger.error({ err: error }, 'failed to close the database pool');
  }

  clearTimeout(forceExit);
  logger.info('shutdown complete');
  process.exit(exitCode);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason instanceof Error ? reason : new Error(String(reason)) }, 'unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  void shutdown('uncaughtException', 1);
});
