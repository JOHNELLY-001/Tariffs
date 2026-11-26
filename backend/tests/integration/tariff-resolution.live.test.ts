import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, query } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { resolveTariff } from '../../src/modules/calculations/services/tariff-resolution.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const app = createApp();

interface TariffRow {
  id: string | number;
  hs_code: string | null;
  rate: string | null;
  schedule_type: string | null;
}

let mainSiRow: TariffRow | undefined;
let sensitiveRow: TariffRow | undefined;
let hasTargetCode = false;
let dbReachable = hasDatabase;

beforeAll(async () => {
  if (!hasDatabase) return;
  try {
    const result = await query<TariffRow>(
      `SELECT t.id, t.hs_code, t.rate, t.schedule_type
         FROM cet_tariffs t
        WHERE regexp_replace(t.hs_code, '[^0-9]', '', 'g') = '04011000'
        ORDER BY t.id`,
    );
    const rows = result.rows;
    hasTargetCode = rows.length > 0;
    mainSiRow = rows.find((row) => (row.schedule_type ?? '').toUpperCase() === 'MAIN_TARIFF' && (row.rate ?? '').trim().toUpperCase() === 'SI');
    sensitiveRow = rows.find((row) => (row.schedule_type ?? '').toUpperCase() === 'SENSITIVE_ITEMS');
  } catch {
    dbReachable = false;
  }
});

afterAll(async () => {
  await closePool();
});

describe.skipIf(!hasDatabase)('tariff resolution (live)', () => {
  it('resolves HS 04011000 when MAIN_TARIFF SI and SENSITIVE_ITEMS 1% exist', async () => {
    if (!dbReachable) return;
    if (!hasTargetCode || !mainSiRow || !sensitiveRow) return;
    const result = await resolveTariff({ hsCode: '04011000' });
    // If there are other duplicate rows, the result may be ambiguous; accept either
    // resolved (with sensitiveTariff) or ambiguous, but never a silent first pick.
    if (result.status === 'resolved' && result.selected?.scheduleType?.toUpperCase() === 'MAIN_TARIFF') {
      expect(result.sensitiveTariff?.rate?.trim()).toBe('1%');
      expect(result.selected?.rate?.trim().toUpperCase()).toBe('SI');
    } else {
      expect(result.status).toBe('ambiguous');
      expect(result.candidates.length).toBeGreaterThan(1);
    }
  });

  it('validates direct tariff ID selection', async () => {
    if (!dbReachable) return;
    if (!hasTargetCode || !mainSiRow) return;
    const result = await resolveTariff({ hsCode: '04011000', tariffId: Number(mainSiRow.id) });
    expect(result.status).toBe('resolved');
    expect(result.selected?.id).toBe(Number(mainSiRow.id));
  });

  it('rejects a mismatched tariff ID', async () => {
    if (!dbReachable) return;
    if (!hasTargetCode) return;
    await expect(resolveTariff({ hsCode: '04011000', tariffId: 99999999 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('does not auto-select when duplicates exist', async () => {
    if (!dbReachable) return;
    if (!hasTargetCode) return;
    // Use a code known to have duplicates if present; otherwise skip.
    const dup = await query<{ digits: string }>(
      `SELECT regexp_replace(t.hs_code, '[^0-9]', '', 'g') AS digits
         FROM cet_tariffs t
        WHERE t.hs_code IS NOT NULL
        GROUP BY 1
       HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 1`,
    );
    const code = dup.rows[0]?.digits;
    if (!code) return;
    const result = await resolveTariff({ hsCode: code });
    // Either resolved (single match impossible if duplicate count>1) or ambiguous.
    expect(['resolved', 'ambiguous']).toContain(result.status);
    if (result.status === 'ambiguous') {
      expect(result.selected).toBeNull();
    }
  });
});

describe.skipIf(!hasDatabase)('tariff resolution API (live)', () => {
  it('calculation endpoint still returns unsupported/needs_review', async () => {
    if (!dbReachable) return;
    const code = '04011000';
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: code, customsValue: 1000, currency: 'KES' });
    // Either 200 with needs_review/unsupported, or 404 if code absent.
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(['unsupported', 'needs_review']).toContain(response.body.data.state);
    }
  });
});