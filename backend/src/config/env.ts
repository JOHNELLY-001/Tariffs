import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { DEFAULT_API_BASE_PATH } from './constants.js';

/**
 * Environment validation.
 *
 * The process fails fast on invalid configuration. Validation messages never
 * echo values, so a malformed connection string can never reach the logs.
 */

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Load `.env.local` first, then `.env`. Real credentials only ever live there. */
export function loadEnvironmentFiles(): void {
  loadDotenv({
    path: [join(backendRoot, '.env.local'), join(backendRoot, '.env')],
    quiet: true,
  });
}

const booleanFromString = (defaultValue: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      const normalized = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      throw new Error('must be a boolean (true/false)');
    });

const integerFromString = (defaultValue: number, min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return defaultValue;
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        ctx.addIssue({ code: 'custom', message: 'must be an integer' });
        return z.NEVER;
      }
      if (parsed < min || parsed > max) {
        ctx.addIssue({ code: 'custom', message: `must be between ${min} and ${max}` });
        return z.NEVER;
      }
      return parsed;
    });

const optionalConnectionString = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        ctx.addIssue({ code: 'custom', message: 'must use the postgres:// or postgresql:// protocol' });
        return z.NEVER;
      }
      return value;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be a valid connection URL' });
      return z.NEVER;
    }
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: integerFromString(3000, 0, 65535),

    DATABASE_URL: optionalConnectionString,
    DATABASE_SSL: booleanFromString(true),
    /** Verify the database server certificate (recommended: true). */
    DATABASE_SSL_VERIFY: booleanFromString(true),
    /** Path to a PEM root certificate when the database uses a private CA. */
    DATABASE_SSL_CA_PATH: z.string().trim().max(1024).optional(),
    DATABASE_POOL_MAX: integerFromString(10, 1, 50),
    DATABASE_CONNECTION_TIMEOUT_MS: integerFromString(10_000, 500, 120_000),
    DATABASE_IDLE_TIMEOUT_MS: integerFromString(30_000, 1_000, 600_000),
    DATABASE_STATEMENT_TIMEOUT_MS: integerFromString(15_000, 500, 120_000),

    API_BASE_PATH: z
      .string()
      .trim()
      .optional()
      .transform((value) => {
        if (!value) return DEFAULT_API_BASE_PATH;
        const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
        return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      }),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    BODY_LIMIT: z.string().trim().regex(/^\d+(b|kb|mb)$/i, 'must look like 100kb').default('100kb'),
    REQUEST_TIMEOUT_MS: integerFromString(30_000, 1_000, 300_000),
    SHUTDOWN_TIMEOUT_MS: integerFromString(10_000, 1_000, 120_000),

    CORS_ORIGINS: z.string().trim().optional().default('*'),

    RATE_LIMIT_WINDOW_MS: integerFromString(15 * 60 * 1000, 1_000, 86_400_000),
    RATE_LIMIT_MAX: integerFromString(300, 1, 100_000),

    /** Explicit second switch for data-changing migration commands. */
    ALLOW_MIGRATE: booleanFromString(false),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && !value.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'is required when NODE_ENV=production',
      });
    }
  });

export type RawEnvironment = Record<string, string | undefined>;

export type Environment = z.infer<typeof envSchema> & {
  readonly corsOrigins: string[] | '*';
  readonly isDatabaseConfigured: boolean;
  readonly isProduction: boolean;
  readonly isTest: boolean;
};

/**
 * Parse and freeze environment configuration. Throws a compact, value-free
 * error when configuration is invalid.
 */
export function parseEnvironment(source: RawEnvironment = process.env): Environment {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${issues}`);
  }

  const parsed = result.data;
  const corsOrigins =
    parsed.CORS_ORIGINS === '*' || parsed.CORS_ORIGINS === ''
      ? '*'
      : parsed.CORS_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

  return Object.freeze({
    ...parsed,
    corsOrigins,
    isDatabaseConfigured: Boolean(parsed.DATABASE_URL),
    isProduction: parsed.NODE_ENV === 'production',
    isTest: parsed.NODE_ENV === 'test',
  });
}

loadEnvironmentFiles();

export const env: Environment = parseEnvironment();
