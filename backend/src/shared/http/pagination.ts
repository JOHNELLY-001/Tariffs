import { z } from 'zod';
import { PAGINATION } from '../../config/constants.js';
import type { PaginationMeta } from './response.js';

/**
 * Pagination is offset-based: the dataset is small, deterministic ordering is
 * guaranteed by a stable tie-breaker, and totals are cheap to compute.
 */

const positiveIntegerQuery = (defaultValue: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === '' ? undefined : value),
    z.coerce
      .number({ error: 'must be a number' })
      .int('must be an integer')
      .min(min, `must be at least ${min}`)
      .max(max, `must be at most ${max}`)
      .default(defaultValue),
  );

export const paginationQuerySchema = z.object({
  page: positiveIntegerQuery(PAGINATION.defaultPage, 1, 1_000_000),
  pageSize: positiveIntegerQuery(PAGINATION.defaultPageSize, 1, PAGINATION.maxPageSize),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PageRequest {
  page: number;
  pageSize: number;
  offset: number;
}

export function toPageRequest(query: PaginationQuery): PageRequest {
  return {
    page: query.page,
    pageSize: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  };
}

export function buildPaginationMeta(page: PageRequest, total: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);
  return {
    page: page.page,
    pageSize: page.pageSize,
    total,
    totalPages,
    hasNextPage: page.page < totalPages,
    hasPreviousPage: page.page > 1 && totalPages > 0,
  };
}
