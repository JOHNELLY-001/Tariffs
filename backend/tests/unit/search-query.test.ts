import { describe, expect, it } from 'vitest';
import {
  buildSearchQuery,
  type SearchParams,
  type SearchStatement,
} from '../../src/modules/search/search.repository.js';

/**
 * The search bug that broke the live endpoint was a placeholder/bind mismatch:
 * a chapter value was bound even when the chapter predicate was not emitted,
 * so PostgreSQL rejected the statement with SQLSTATE 08P01.
 *
 * These tests assert the invariant directly and without a database:
 *   - every value passed to `pool.query` is referenced by the SQL text, and
 *   - every placeholder in the SQL text has a corresponding value.
 */

const PROJECTION = 't.id AS id, t.hs_code AS hs_code';

function placeholdersIn(statement: SearchStatement): number[] {
  const matches = statement.text.match(/\$\d+/g) ?? [];
  return [...new Set(matches.map((token) => Number(token.slice(1))))].sort((a, b) => a - b);
}

function expectParametersConsistent(statement: SearchStatement): void {
  const placeholders = placeholdersIn(statement);
  const highest = placeholders.at(-1) ?? 0;

  // Every bound value must be referenced by at least one placeholder.
  expect(highest).toBe(statement.values.length);

  // Every placeholder index from 1..highest must actually appear.
  expect(placeholders).toEqual(
    Array.from({ length: statement.values.length }, (_unused, index) => index + 1),
  );
}

function baseParams(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    text: 'tea',
    normalizedCode: '',
    chapterCode: null,
    scheduleType: null,
    limit: 5,
    offset: 0,
    ...overrides,
  };
}

describe('buildSearchQuery placeholder binding', () => {
  it('binds exactly the two core parameters when no filter is supplied', () => {
    const plan = buildSearchQuery(baseParams(), { chapterColumn: false, projection: PROJECTION });

    expectParametersConsistent(plan.list);
    expectParametersConsistent(plan.count);

    expect(plan.list.values).toEqual(['tea', '', 5, 0]);
    expect(plan.count.values).toEqual(['tea', '']);
    // No chapter or schedule predicate leaked into the statement.
    expect(plan.list.text).not.toMatch(/chapter_code/);
    expect(plan.list.text).not.toMatch(/schedule_type/);
  });

  it('keeps list and count consistent with every filter supplied', () => {
    const plan = buildSearchQuery(
      baseParams({ normalizedCode: '090121', chapterCode: '09', scheduleType: 'MAIN_TARIFF' }),
      { chapterColumn: true, projection: PROJECTION },
    );

    expectParametersConsistent(plan.list);
    expectParametersConsistent(plan.count);

    expect(plan.list.values).toEqual(['tea', '090121', '09', 'MAIN_TARIFF', 5, 0]);
    expect(plan.count.values).toEqual(['tea', '090121', '09', 'MAIN_TARIFF']);
  });

  it('binds the schedule filter without a chapter filter', () => {
    const plan = buildSearchQuery(baseParams({ scheduleType: 'SENSITIVE_ITEMS' }), {
      chapterColumn: false,
      projection: PROJECTION,
    });

    expectParametersConsistent(plan.list);
    expectParametersConsistent(plan.count);
    expect(plan.list.values).toEqual(['tea', '', 'SENSITIVE_ITEMS', 5, 0]);
    expect(plan.count.values).toEqual(['tea', '', 'SENSITIVE_ITEMS']);
    expect(plan.list.text).toMatch(/schedule_type/i);
  });

  it('binds the chapter filter without a schedule filter', () => {
    const plan = buildSearchQuery(baseParams({ chapterCode: '1' }), {
      chapterColumn: false,
      projection: PROJECTION,
    });

    expectParametersConsistent(plan.list);
    expectParametersConsistent(plan.count);
    // Chapter is normalized to two digits.
    expect(plan.list.values).toEqual(['tea', '', '01', 5, 0]);
  });

  it('uses the verified chapter column when it exists, and the derived form otherwise', () => {
    const params = baseParams({ chapterCode: '09' });

    const derived = buildSearchQuery(params, { chapterColumn: false, projection: PROJECTION });
    const verified = buildSearchQuery(params, { chapterColumn: true, projection: PROJECTION });

    expect(derived.list.text).toContain('AND left(regexp_replace(hs_code');
    expect(verified.list.text).toMatch(/t\.chapter_code = \$3/);
    // The verified-column form must not derive the chapter from the HS code.
    expect(verified.list.text).not.toContain('AND left(regexp_replace(hs_code');
  });

  it('injects the projection verbatim and never ships a template placeholder', () => {
    const plan = buildSearchQuery(baseParams(), { chapterColumn: false, projection: PROJECTION });
    expect(plan.list.text).toContain(PROJECTION);
    expect(plan.list.text).not.toContain('__PROJECTION__');
  });

  it('uses no optional extension function', () => {
    const plan = buildSearchQuery(baseParams({ chapterCode: '09', scheduleType: 'MAIN_TARIFF' }), {
      chapterColumn: false,
      projection: PROJECTION,
    });
    // Full-text search is core PostgreSQL; trigram/similarity are not used.
    expect(plan.list.text).toMatch(/to_tsvector/);
    expect(plan.list.text).not.toMatch(/similarity\(|%>|gin_trgm_ops|unaccent/);
  });
});
