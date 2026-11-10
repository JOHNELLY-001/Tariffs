import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../src/config/env.js';

describe('parseEnvironment', () => {
  it('applies defaults for a minimal development environment', () => {
    const env = parseEnvironment({ NODE_ENV: 'development' });
    expect(env.PORT).toBe(3000);
    expect(env.API_BASE_PATH).toBe('/api/v1');
    expect(env.corsOrigins).toBe('*');
    expect(env.isDatabaseConfigured).toBe(false);
    expect(env.DATABASE_SSL).toBe(true);
  });

  it('requires DATABASE_URL in production', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
  });

  it('normalizes the API base path', () => {
    expect(parseEnvironment({ API_BASE_PATH: 'api/v2/' }).API_BASE_PATH).toBe('/api/v2');
    expect(parseEnvironment({ API_BASE_PATH: '/v1' }).API_BASE_PATH).toBe('/v1');
  });

  it('parses comma-separated CORS origins', () => {
    const env = parseEnvironment({ CORS_ORIGINS: 'https://a.test, https://b.test' });
    expect(env.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
  });

  it('rejects a non-postgres connection string without echoing it', () => {
    const secretLooking = 'https://user:supersecret@example.test/db';
    let message = '';
    try {
      parseEnvironment({ DATABASE_URL: secretLooking });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/postgres/);
    expect(message).not.toContain('supersecret');
  });

  it('rejects malformed booleans and numbers', () => {
    expect(() => parseEnvironment({ DATABASE_SSL: 'maybe' })).toThrow(/boolean/);
    expect(() => parseEnvironment({ PORT: 'eighty' })).toThrow(/integer/);
    expect(() => parseEnvironment({ PORT: '70000' })).toThrow(/between/);
  });

  it('treats false-like strings as false', () => {
    expect(parseEnvironment({ DATABASE_SSL: 'false' }).DATABASE_SSL).toBe(false);
    expect(parseEnvironment({ DATABASE_SSL: '0' }).DATABASE_SSL).toBe(false);
  });
});
