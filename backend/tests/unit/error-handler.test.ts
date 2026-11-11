import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { AppError, databaseError, internalError } from '../../src/shared/errors/app-error.js';

/**
 * The API must never leak SQL, connection strings, stack traces or other
 * internal detail. These tests drive the central error handler directly with a
 * fake Express response so no database or socket is required.
 */

interface CapturedResponse {
  status: number;
  body: unknown;
  ended: boolean;
}

function runHandler(error: unknown): CapturedResponse {
  const captured: CapturedResponse = { status: 0, body: undefined, ended: false };

  const res = {
    locals: { requestId: 'test-request-id' },
    headersSent: false,
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
    end() {
      captured.ended = true;
      return this;
    },
  } as unknown as Response;

  errorHandler(error, { method: 'GET', path: '/api/v1/search' } as Request, res, vi.fn() as NextFunction);
  return captured;
}

function bodyText(captured: CapturedResponse): string {
  return JSON.stringify(captured.body);
}

describe('error handler containment', () => {
  it('turns a database failure into a generic 503 without any internal detail', () => {
    const original = Object.assign(
      new Error('connection to postgres://cet:supersecret@db.example.test:5432/cet failed: password authentication failed'),
      { code: '28P01', routine: 'auth_failed' },
    );

    const captured = runHandler(databaseError(original));

    expect(captured.status).toBe(503);
    expect(captured.body).toMatchObject({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'The tariff database is temporarily unavailable',
        details: [],
      },
      meta: { requestId: 'test-request-id' },
    });

    const serialized = bodyText(captured);
    expect(serialized).not.toContain('supersecret');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('28P01');
    expect(serialized).not.toContain('auth_failed');
  });

  it('never exposes a stack trace for an unexpected error', () => {
    const captured = runHandler(internalError(new Error('SELECT * FROM cet_tariffs failed')));

    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: [] },
    });
    expect(bodyText(captured)).not.toMatch(/SELECT|at\s+\w+\s+\(/);
  });

  it('preserves a safe, deliberate AppError contract', () => {
    const captured = runHandler(new AppError('NOT_FOUND', 404, 'No tariff record exists with id 42'));

    expect(captured.status).toBe(404);
    expect(captured.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No tariff record exists with id 42' },
    });
  });

  it('translates an oversized body without echoing the parser error', () => {
    const parserError = Object.assign(new Error('request entity too large with payload bytes ...'), {
      type: 'entity.too.large',
      status: 413,
    });

    const captured = runHandler(parserError);

    expect(captured.status).toBe(413);
    expect(captured.body).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(bodyText(captured)).not.toContain('payload bytes');
  });

  it('ends the response instead of writing when headers were already sent', () => {
    const res = {
      locals: { requestId: 'test-request-id' },
      headersSent: true,
      status: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    } as unknown as Response;

    errorHandler(new Error('late failure'), {} as Request, res, vi.fn() as NextFunction);

    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
