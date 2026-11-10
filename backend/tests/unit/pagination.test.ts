import { describe, expect, it } from 'vitest';
import {
  buildPaginationMeta,
  paginationQuerySchema,
  toPageRequest,
} from '../../src/shared/http/pagination.js';
import { PAGINATION } from '../../src/config/constants.js';

describe('paginationQuerySchema', () => {
  it('applies documented defaults', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(PAGINATION.defaultPage);
    expect(parsed.pageSize).toBe(PAGINATION.defaultPageSize);
  });

  it('coerces numeric query strings', () => {
    const parsed = paginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(parsed).toEqual({ page: 3, pageSize: 50 });
  });

  it('rejects a page size above the hard maximum', () => {
    const result = paginationQuerySchema.safeParse({ pageSize: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects zero, negative and non-integer values', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: '2.5' }).success).toBe(false);
  });

  it('rejects arrays and nested objects', () => {
    expect(paginationQuerySchema.safeParse({ page: ['1', '2'] }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: { nope: 1 } }).success).toBe(false);
  });
});

describe('buildPaginationMeta', () => {
  it('computes totals and navigation flags', () => {
    const page = toPageRequest({ page: 2, pageSize: 20 });
    expect(page.offset).toBe(20);
    expect(buildPaginationMeta(page, 45)).toEqual({
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('handles an empty result set', () => {
    const page = toPageRequest({ page: 1, pageSize: 20 });
    expect(buildPaginationMeta(page, 0)).toMatchObject({ totalPages: 0, hasNextPage: false });
  });
});
