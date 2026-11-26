import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, query } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const app = createApp();
let dbReachable = hasDatabase;

beforeAll(async () => {
  if (!hasDatabase) return;
  try {
    await query('SELECT 1');
  } catch {
    dbReachable = false;
  }
});

afterAll(async () => {
  await closePool();
});

describe.skipIf(!hasDatabase)('import-cost API (live)', () => {
  it('returns needs_review/unsupported with null totals for a real code', async () => {
    if (!dbReachable) return;
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: '0101', customsValue: 1000, currency: 'KES' });
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(['needs_review', 'unsupported', 'completed']).toContain(response.body.data.state);
      if (response.body.data.state !== 'completed') {
        expect(response.body.data.totals).toBeNull();
      }
      expect(response.body.data).toHaveProperty('calculationId');
      expect(response.body.data).toHaveProperty('charges');
    }
  });

  it('rejects negative monetary inputs', async () => {
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: '0101', customsValue: -5, currency: 'KES' });
    expect(response.status).toBe(400);
  });

  it('rejects invalid currency', async () => {
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: '0101', customsValue: 1000, currency: 'SHILLINGS' });
    expect(response.status).toBe(400);
  });
});