import pino, { type Logger } from 'pino';
import { env } from './env.js';

/**
 * Structured application logger.
 *
 * Credentials and connection details are never logged. Request logs are
 * produced by pino-http in the request-logger middleware.
 */

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'DATABASE_URL',
  'DATABASE_URL_READONLY',
  'connectionString',
  'password',
  '*.password',
];

function createLogger(): Logger {
  const usePrettyTransport = env.NODE_ENV === 'development';

  return pino({
    level: env.LOG_LEVEL,
    redact: { paths: redactPaths, censor: '[redacted]' },
    base: { service: 'cet-tariff-backend', env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...(usePrettyTransport
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
          },
        }
      : {}),
  });
}

export const logger: Logger = createLogger();
