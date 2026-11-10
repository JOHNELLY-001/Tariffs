import type { RequestHandler } from 'express';
import { notFound } from '../shared/errors/app-error.js';

/** Terminal middleware for unmatched routes. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`No route matches ${req.method} ${req.path}`));
};
