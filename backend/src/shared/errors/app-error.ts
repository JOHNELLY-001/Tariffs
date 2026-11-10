/**
 * Application error taxonomy.
 *
 * Errors carry a stable machine-readable code, an HTTP status and optional
 * safe details. Anything not derived from an AppError is treated as an
 * internal failure and its message is never exposed to clients.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'RATE_LIMITED',
  'DATABASE_NOT_CONFIGURED',
  'DATABASE_ERROR',
  'UNSUPPORTED_OPERATION',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  readonly path?: string;
  readonly message: string;
  readonly code?: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: ErrorDetail[];
  readonly expose: boolean;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    details: ErrorDetail[] = [],
    options?: { cause?: unknown; expose?: boolean },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.expose = options?.expose ?? true;
  }
}

export const badRequest = (message = 'The request could not be processed', details: ErrorDetail[] = []) =>
  new AppError('BAD_REQUEST', 400, message, details);

export const validationError = (
  message = 'The request parameters are invalid',
  details: ErrorDetail[] = [],
) => new AppError('VALIDATION_ERROR', 400, message, details);

export const notFound = (message = 'The requested resource was not found') =>
  new AppError('NOT_FOUND', 404, message);

export const conflict = (message = 'The request conflicts with the current state', details: ErrorDetail[] = []) =>
  new AppError('CONFLICT', 409, message, details);

export const unprocessable = (message = 'The request could not be processed', details: ErrorDetail[] = []) =>
  new AppError('UNPROCESSABLE_ENTITY', 422, message, details);

export const rateLimited = (message = 'Too many requests') => new AppError('RATE_LIMITED', 429, message);

export const databaseNotConfigured = () =>
  new AppError(
    'DATABASE_NOT_CONFIGURED',
    503,
    'The tariff database connection is not configured',
    [{ message: 'Set DATABASE_URL in the backend environment file.' }],
  );

export const databaseError = (cause?: unknown) =>
  new AppError('DATABASE_ERROR', 503, 'The tariff database is temporarily unavailable', [], { cause });

export const unsupportedOperation = (message = 'This operation is not supported', details: ErrorDetail[] = []) =>
  new AppError('UNSUPPORTED_OPERATION', 422, message, details);

export const internalError = (cause?: unknown) =>
  new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred', [], { cause, expose: false });
