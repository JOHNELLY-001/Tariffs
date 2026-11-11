import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { closePool, query } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';

/**
 * Integration tests run only when DATABASE_URL is configured (a Neon branch or
 * dedicated test database). They never write to the four tariff tables.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const app = createApp();

interface SampleRow {
  id: string | number;
  hs_code: string | null;
  rate: string | null;
  schedule_type: string | null;
}

let sample: SampleRow | undefined;
let duplicateCode: string | undefined;
let crossScheduleCode: string | undefined;
let sensitiveItemRateRow: SampleRow | undefined;
let sensitiveItemsScheduleCode: string | undefined;

beforeAll(async () => {
  if (!hasDatabase) return;

  const result = await query<SampleRow>(
    `SELECT t.id, t.hs_code, t.rate, t.schedule_type
       FROM cet_tariffs t
      WHERE t.hs_code IS NOT NULL
      ORDER BY t.id
      LIMIT 1`,
  );
  sample = result.rows[0];

  // Any normalized code stored more than once, regardless of schedule.
  const duplicate = await query<{ digits: string; count: string }>(
    `SELECT regexp_replace(t.hs_code, '[^0-9]', '', 'g') AS digits, COUNT(*)::text AS count
       FROM cet_tariffs t
      WHERE t.hs_code IS NOT NULL
      GROUP BY 1
     HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 1`,
  );
  duplicateCode = duplicate.rows[0]?.digits;

  // A code that appears in BOTH schedules — the case that must never collapse.
  const crossSchedule = await query<{ digits: string }>(
    `SELECT regexp_replace(t.hs_code, '[^0-9]', '', 'g') AS digits
       FROM cet_tariffs t
      WHERE t.hs_code IS NOT NULL
      GROUP BY 1
     HAVING COUNT(DISTINCT COALESCE(t.schedule_type, '(null)')) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 1`,
  );
  crossScheduleCode = crossSchedule.rows[0]?.digits;

  // A main-schedule row whose rate is the SI reference.
  const sensitiveRate = await query<SampleRow>(
    `SELECT t.id, t.hs_code, t.rate, t.schedule_type
       FROM cet_tariffs t
      WHERE btrim(upper(t.rate)) = 'SI'
      ORDER BY t.id
      LIMIT 1`,
  );
  sensitiveItemRateRow = sensitiveRate.rows[0];

  // A code that exists only in the SENSITIVE_ITEMS schedule.
  const sensitiveOnly = await query<{ digits: string }>(
    `SELECT regexp_replace(t.hs_code, '[^0-9]', '', 'g') AS digits
       FROM cet_tariffs t
      WHERE t.hs_code IS NOT NULL
        AND UPPER(t.schedule_type) = 'SENSITIVE_ITEMS'
      GROUP BY 1
     HAVING COUNT(*) FILTER (WHERE UPPER(t.schedule_type) = 'SENSITIVE_ITEMS') > 0
        AND COUNT(*) FILTER (WHERE UPPER(t.schedule_type) <> 'SENSITIVE_ITEMS') = 0
      ORDER BY COUNT(*) DESC, 1
      LIMIT 1`,
  );
  sensitiveItemsScheduleCode = sensitiveOnly.rows[0]?.digits;
});

afterAll(async () => {
  await closePool();
});

describe.skipIf(!hasDatabase)('live tariff retrieval', () => {
  it('retains the documented baseline row counts', async () => {
    const result = await query<{ table_name: string; total: string }>(
      `SELECT 'cet_tariffs' AS table_name, COUNT(*)::text AS total FROM cet_tariffs
       UNION ALL SELECT 'cet_chapter_notes', COUNT(*)::text FROM cet_chapter_notes
       UNION ALL SELECT 'cet_section_notes', COUNT(*)::text FROM cet_section_notes
       UNION ALL SELECT 'cet_subheading_notes', COUNT(*)::text FROM cet_subheading_notes`,
    );
    const counts = Object.fromEntries(result.rows.map((row) => [row.table_name, Number(row.total)]));
    expect(counts.cet_tariffs).toBeGreaterThanOrEqual(5_000);
    expect(counts.cet_chapter_notes).toBeGreaterThanOrEqual(90);
    expect(counts.cet_section_notes).toBeGreaterThanOrEqual(20);
  });

  it('retrieves the exact source row by id without rewriting values', async () => {
    expect(sample).toBeDefined();
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/${sample?.id}`)
      .expect(200);

    expect(response.body.data.hsCode).toBe(sample?.hs_code);
    expect(response.body.data.rate).toBe(sample?.rate);
    expect(response.body.data.scheduleType).toBe(sample?.schedule_type);
    expect(response.body.meta.source).toBe('cet_tariffs');
  });

  it('returns 404 for an id that does not exist', async () => {
    await request(app).get(`${env.API_BASE_PATH}/tariffs/99999999`).expect(404);
  });

  it('looks up a stored HS code by its normalized form', async () => {
    const digits = (sample?.hs_code ?? '').replace(/\D/g, '');
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/hs/${digits}`)
      .expect(200);

    const matchIds = response.body.data.matches.map((match: { id: number }) => match.id);
    expect(matchIds).toContain(Number(sample?.id));
    expect(response.body.meta.normalization.normalized).toBe(digits);
    expect(typeof response.body.meta.ambiguous).toBe('boolean');
    // Schedule is always exposed, never inferred or dropped.
    expect(Array.isArray(response.body.meta.schedules)).toBe(true);
  });

  it('never silently chooses when an HS code is duplicated', async () => {
    if (!duplicateCode) return;
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/hs/${duplicateCode}`)
      .expect(200);

    expect(response.body.data.matches.length).toBeGreaterThan(1);
    expect(response.body.meta.ambiguous).toBe(true);
  });

  it('keeps MAIN_TARIFF and SENSITIVE_ITEMS matches distinct for the same code', async () => {
    if (!crossScheduleCode) return;
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/hs/${crossScheduleCode}`)
      .expect(200);

    const schedules = response.body.data.matches.map(
      (match: { scheduleType: string | null }) => match.scheduleType,
    );
    expect(new Set(schedules).size).toBeGreaterThan(1);
    expect(schedules).toEqual(expect.arrayContaining(['MAIN_TARIFF', 'SENSITIVE_ITEMS']));
    expect(response.body.meta.schedules).toEqual(
      expect.arrayContaining(['MAIN_TARIFF', 'SENSITIVE_ITEMS']),
    );
  });

  it('returns classification context in a bounded shape', async () => {
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/${sample?.id}/notes`)
      .expect(200);

    expect(response.body.data).toHaveProperty('tariff');
    expect(response.body.data).toHaveProperty('chapter');
    expect(response.body.data).toHaveProperty('section');
    expect(response.body.data).toHaveProperty('subheadingNotes');
    expect(response.body.data).toHaveProperty('sensitiveItemsReference');
    expect(typeof response.body.data.contextComplete).toBe('boolean');
    expect(['verified_column', 'derived_from_hs_code', 'none']).toContain(
      response.body.data.chapterSource,
    );
    expect(response.body.data.subheadingNotes.length).toBeLessThanOrEqual(100);
  });

  it('cross-references Sensitive Items entries for an SI rate', async () => {
    if (!sensitiveItemRateRow) return;
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/${sensitiveItemRateRow.id}/notes`)
      .expect(200);

    const reference = response.body.data.sensitiveItemsReference;
    expect(reference).toBeTruthy();
    expect(reference.reason).toMatch(/SI|Sensitive Items/i);
    expect(Array.isArray(reference.matches)).toBe(true);
    for (const match of reference.matches) {
      expect(match.scheduleType).toBe('SENSITIVE_ITEMS');
    }
    // The original rate is still reported unchanged.
    expect(response.body.data.tariff.rate).toBe(sensitiveItemRateRow.rate);
  });

  it('lists sections with pagination metadata', async () => {
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/sections?pageSize=5`)
      .expect(200);
    expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    expect(response.body.meta.pagination.total).toBeGreaterThan(0);
  });

  it('lists chapters in stable order', async () => {
    const response = await request(app).get(`${env.API_BASE_PATH}/chapters?pageSize=10`).expect(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
  });

  it('lists subheading notes with ownership derived from populated columns', async () => {
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/subheading-notes?pageSize=5`)
      .expect(200);
    for (const note of response.body.data.items) {
      expect(['chapter', 'section', 'unassigned']).toContain(note.ownership);
    }
  });

  it('performs description search with match metadata', async () => {
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/search?q=tea&pageSize=5`)
      .expect(200);
    expect(response.body.meta.disclaimer ?? response.body.meta.warnings).toBeTruthy();
    expect(response.body.meta.pagination.total).toBeGreaterThan(0);
    for (const item of response.body.data.items) {
      expect(['exact_code', 'code_prefix', 'description']).toContain(item.matchType);
      expect(typeof item.relevance).toBe('number');
      expect(item.scheduleType).toBeDefined();
    }
  });

  it('keeps search results stable when a chapter filter is applied', async () => {
    // Exercises the predicate that previously caused the bind mismatch.
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/search?q=tea&chapter_code=09&pageSize=5`)
      .expect(200);
    expect(response.body.meta.pagination.total).toBeGreaterThan(0);
    for (const item of response.body.data.items) {
      expect(item.hsCode.replace(/\D/g, '')).toMatch(/^09/);
    }
  });

  it('filters search results by schedule_type without dropping the other schedule', async () => {
    if (!sensitiveItemsScheduleCode) return;
    const response = await request(app)
      .get(
        `${env.API_BASE_PATH}/search?q=${sensitiveItemsScheduleCode}&schedule_type=SENSITIVE_ITEMS&pageSize=5`,
      )
      .expect(200);

    expect(response.body.meta.pagination.total).toBeGreaterThan(0);
    expect(response.body.meta.query.scheduleType).toBe('SENSITIVE_ITEMS');
    for (const item of response.body.data.items) {
      expect(item.scheduleType).toBe('SENSITIVE_ITEMS');
      expect(item.hsCode.replace(/\D/g, '')).toMatch(new RegExp(`^${sensitiveItemsScheduleCode}`));
    }
  });

  it('returns both schedules for a code search when no schedule filter is given', async () => {
    if (!crossScheduleCode) return;
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/search?q=${crossScheduleCode}&pageSize=10`)
      .expect(200);

    const schedules = new Set(
      response.body.data.items.map((item: { scheduleType: string | null }) => item.scheduleType),
    );
    expect(schedules).toEqual(new Set(['MAIN_TARIFF', 'SENSITIVE_ITEMS']));
  });

  it('reports unsupported import-cost states rather than inventing amounts', async () => {
    const digits = (sample?.hs_code ?? '').replace(/\D/g, '');
    const response = await request(app)
      .post(`${env.API_BASE_PATH}/calculations/import-cost`)
      .send({ hsCode: digits, customsValue: 1000, currency: 'KES' })
      .expect(200);

    expect(['unsupported', 'needs_review']).toContain(response.body.data.state);
    expect(response.body.data.totals).toBeNull();
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.disclaimer).toMatch(/not a customs assessment/i);
  });
});
