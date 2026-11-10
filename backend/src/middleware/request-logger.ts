import { pinoHttp } from 'pino-http';
import type { RequestHandler, Response } from 'express';
import { logger } from '../config/logger.js';

/**
 * HTTP request logging with the correlation ID assigned by `requestId`.
 * Health probes are logged at debug level to keep production logs useful.
 */
export const requestLogger: RequestHandler = pinoHttp({
  logger,
  genReqId: (_req, res) => (res as Response).locals.requestId ?? 'unavailable',
  customLogLevel: (_req, res, error) => {
    if (error) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: (error: Error) => ({ type: error.name, message: error.message }),
  },
  autoLogging: {
    ignore: (req) => (req.url ?? '').includes('/health/live'),
  },
}) as unknown as RequestHandler;
