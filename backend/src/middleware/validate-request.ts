import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { validationError } from '../shared/errors/app-error.js';

export type RequestSource = 'body' | 'query' | 'params';

/**
 * Validate one request source with a Zod schema.
 *
 * Parsed values are stored on `res.locals.validated` (Express 5 does not allow
 * assigning to `req.query`/`req.params`) and are read by controllers through
 * `getValidated()`. Controllers therefore never touch raw input.
 */
export function validate(schema: ZodType, source: RequestSource): RequestHandler {
  return (req, res, next) => {
    const input = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = schema.safeParse(input ?? {});

    if (!result.success) {
      next(
        validationError(
          'The request parameters are invalid',
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        ),
      );
      return;
    }

    if (source === 'body') {
      req.body = result.data;
    }

    const store = (res.locals.validated ?? {}) as Record<string, unknown>;
    store[source] = result.data;
    res.locals.validated = store;
    next();
  };
}

export function getValidated<T>(res: Response, source: RequestSource): T {
  const store = res.locals.validated as Record<string, unknown> | undefined;
  const value = store?.[source];
  if (value === undefined) {
    throw new Error(`No validated ${source} available — validate() middleware is missing on this route`);
  }
  return value as T;
}
