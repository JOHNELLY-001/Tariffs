import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';

const app = createApp();

afterAll(async () => {
  await closePool();
});

describe('platform middleware', () => {
  it('serves liveness without touching the database', async () => {
    const response = await request(app).get('/health/live').expect(200);
    expect(response.body).toMatchObject({ success: true, data: { status: 'ok' } });
    expect(response.body.meta.requestId).toBeTruthy();
  });

  it('reports readiness honestly when the database is not configured', async () => {
    const response = await request(app).get('/health/ready');
    if (!env.isDatabaseConfigured) {
      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
      return;
    }
    expect([200, 503]).toContain(response.status);
    expect(response.body.meta.requestId).toBeTruthy();
  });

  it('returns the uniform 404 envelope for unknown routes', async () => {
    const response = await request(app).get('/nope').expect(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND', details: [] },
    });
  });

  it('returns 404 for unknown routes inside the versioned API', async () => {
    const response = await request(app).get('/api/v1/unknown').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('echoes a well-formed caller request id', async () => {
    const response = await request(app)
      .get('/health/live')
      .set('X-Request-Id', 'trace-abc_123')
      .expect(200);
    expect(response.headers['x-request-id']).toBe('trace-abc_123');
    expect(response.body.meta.requestId).toBe('trace-abc_123');
  });

  it('replaces an unsafe request id rather than trusting it', async () => {
    const response = await request(app)
      .get('/health/live')
      .set('X-Request-Id', 'bad id <script>')
      .expect(200);
    expect(response.headers['x-request-id']).not.toContain('<script>');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets baseline security headers and hides the framework', async () => {
    const response = await request(app).get('/health/live').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('exposes the OpenAPI contract from the versioned base path', async () => {
    const response = await request(app).get(`${env.API_BASE_PATH}/openapi.json`).expect(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/search',
        '/tariffs/{id}',
        '/tariffs/hs/{code}',
        '/tariffs/{id}/notes',
        '/sections',
        '/chapters',
        '/subheading-notes',
        '/calculations/import-cost',
      ]),
    );
    expect(response.body.components.schemas.Tariff).toBeTruthy();
  });

  it('rejects oversized JSON bodies with a safe error', async () => {
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: 'x'.repeat(200_000) })
      .set('Content-Type', 'application/json')
      .expect(413);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects malformed JSON with a safe error', async () => {
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .set('Content-Type', 'application/json')
      .send('{"hsCode": ')
      .expect(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('request validation', () => {
  it('rejects a too-short search query with field details', async () => {
    const response = await request(app).get(`${env.API_BASE_PATH}/search?q=a`).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].path).toBe('q');
  });

  it('rejects a page size above the cap', async () => {
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/search?q=tea&pageSize=500`)
      .expect(400);
    expect(response.body.error.details[0].path).toBe('pageSize');
  });

  it('rejects a non-numeric tariff id', async () => {
    const response = await request(app).get(`${env.API_BASE_PATH}/tariffs/abc`).expect(400);
    expect(response.body.error.details[0].path).toBe('id');
  });

  it('rejects a zero tariff id', async () => {
    await request(app).get(`${env.API_BASE_PATH}/tariffs/0`).expect(400);
  });

  it('rejects an HS code containing letters', async () => {
    const response = await request(app).get(`${env.API_BASE_PATH}/tariffs/hs/ABC123`);
    expect([400, 503]).toContain(response.status);
    if (response.status === 400) {
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects a non-numeric chapter code on both chapter routes', async () => {
    const detail = await request(app).get(`${env.API_BASE_PATH}/chapters/abc`).expect(400);
    expect(detail.body.error.details[0].path).toBe('code');
    const tariffs = await request(app).get(`${env.API_BASE_PATH}/chapters/abc/tariffs`).expect(400);
    expect(tariffs.body.error.details[0].path).toBe('code');
  });

  it('validates the import-cost body before touching the database', async () => {
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: '0101', customsValue: -5, currency: 'KES' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((detail: { path: string }) => detail.path)).toContain(
      'customsValue',
    );
  });

  it('rejects an invalid currency code', async () => {
    await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: '0101', customsValue: 1000, currency: 'SHILLINGS' })
      .expect(400);
  });
});
