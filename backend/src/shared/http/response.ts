import type { Response } from 'express';
import type { AppError } from '../errors/app-error.js';

/**
 * Uniform response envelope.
 *
 * Successful responses: { success: true, data, meta }
 * Failed responses:     { success: false, error: { code, message, details }, meta }
 */

export interface ResponseMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function requestIdOf(res: Response): string {
  const value = res.locals?.requestId;
  return typeof value === 'string' ? value : 'unavailable';
}

export function buildMeta(res: Response, extra: Record<string, unknown> = {}): ResponseMeta {
  return { requestId: requestIdOf(res), ...extra };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: Record<string, unknown> } = {},
): Response {
  return res.status(options.status ?? 200).json({
    success: true,
    data,
    meta: buildMeta(res, options.meta ?? {}),
  });
}

export function sendError(res: Response, error: AppError): Response {
  return res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    meta: buildMeta(res),
  });
}
