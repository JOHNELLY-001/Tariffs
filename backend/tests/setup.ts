/**
 * Test bootstrap.
 *
 * Runs before any test module, so `src/config/env.ts` parses a deterministic
 * test environment. A real `.env.local` may still provide DATABASE_URL for
 * integration tests; dotenv never overrides existing variables.
 */
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX = '10000';
