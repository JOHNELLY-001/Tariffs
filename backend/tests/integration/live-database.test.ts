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
}

let sample: SampleRow | undefined;
let duplicateCode: string | undefined;

beforeAll(async () => {
  if (!hasDatabase) return;

  const result = await query<SampleRow>(
    `SELECT t.id, t.hs_code, t.rate
       FROM cet_tariffs t
      WHERE t.hs_code IS NOT NULL
      ORDER BY t.id
      LIMIT 1`,
  );
  sample = result.rows[0];

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
  });

  it('never silently chooses when an HS code is duplicated', async () => {
    if (!duplicateCode) return;
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/hs/${duplicateCode}`)
      .expect(200);

    expect(response.body.data.matches.length).toBeGreaterThan(1);
    expect(response.body.meta.ambiguous).toBe(true);
  });

  it('returns classification context in a bounded shape', async () => {
    const response = await request(app)
      .get(`${env.API_BASE_PATH}/tariffs/${sample?.id}/notes`)
      .expect(200);

    expect(response.body.data).toHaveProperty('tariff');
    expect(response.body.data).toHaveProperty('chapter');
    expect(response.body.data).toHaveProperty('section');
    expect(response.body.data).toHaveProperty('subheadingNotes');
    expect(typeof response.body.data.contextComplete).toBe('boolean');
    expect(['verified_column', 'derived_from_hs_code', 'none']).toContain(
      response.body.data.chapterSource,
    );
    expect(response.body.data.subheadingNotes.length).toBeLessThanOrEqual(100);
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
    for (const item of response.body.data.items) {
      expect(['exact_code', 'code_prefix', 'description']).toContain(item.matchType);
      expect(typeof item.relevance).toBe('number');
    }
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
