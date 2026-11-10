import type { ErrorRequestHandler } from 'express';
import { AppError, internalError } from '../shared/errors/app-error.js';
import { sendError } from '../shared/http/response.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
}

function translateBodyParserError(error: BodyParserError): AppError | undefined {
  if (error.type === 'entity.parse.failed') {
    return new AppError('BAD_REQUEST', 400, 'The request body is not valid JSON');
  }
  if (error.type === 'entity.too.large') {
    return new AppError('BAD_REQUEST', 413, 'The request body exceeds the permitted size');
  }
  return undefined;
}

/**
 * Central error handler.
 *
 * Only `AppError` instances expose their message. Unknown failures are logged
 * server-side with the request ID and returned as a generic 500 — never with a
 * stack trace, SQL fragment or connection string.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : 'unavailable';

  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else {
    const translated = translateBodyParserError(error as BodyParserError);
    if (translated) {
      appError = translated;
    } else if ((error as BodyParserError)?.type === 'request.aborted') {
      appError = new AppError('BAD_REQUEST', 400, 'The request was aborted');
    } else {
      appError = internalError(error);
    }
  }

  const logPayload = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: appError.statusCode,
    code: appError.code,
    err: error instanceof Error ? error : new Error(String(error)),
  };

  if (appError.statusCode >= 500) {
    logger.error(logPayload, 'request failed');
  } else {
    logger.warn(logPayload, 'request rejected');
  }

  if (res.headersSent) {
    res.end();
    return;
  }

  // In test mode, surface the original failure for debuggability without
  // changing the production contract.
  if (env.isTest && appError.code === 'INTERNAL_ERROR' && error instanceof Error) {
    logger.debug({ requestId, stack: error.stack }, 'unhandled error detail');
  }

  sendError(res, appError);
};
