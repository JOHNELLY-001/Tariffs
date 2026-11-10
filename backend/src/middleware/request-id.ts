import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { REQUEST } from '../config/constants.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Assign a correlation ID to every request. A well-formed caller-supplied
 * value is reused; anything else is replaced so untrusted input cannot inject
 * characters into logs.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST.idHeader);
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
