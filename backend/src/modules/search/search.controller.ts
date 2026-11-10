import type { RequestHandler } from 'express';
import { getValidated } from '../../middleware/validate-request.js';
import { buildPaginationMeta, toPageRequest } from '../../shared/http/pagination.js';
import { sendSuccess } from '../../shared/http/response.js';
import { PAGINATION } from '../../config/constants.js';
import type { SearchQuery } from './search.schemas.js';
import * as searchService from './search.service.js';

export const searchTariffs: RequestHandler = async (_req, res) => {
  const query = getValidated<SearchQuery>(res, 'query');
  const page = toPageRequest(query);
  const result = await searchService.searchTariffs(
    { q: query.q, chapterCode: query.chapter_code },
    page,
  );

  sendSuccess(res, { items: result.items }, {
    meta: {
      pagination: buildPaginationMeta(page, result.total),
      query: result.query,
      limits: { maxPageSize: PAGINATION.maxPageSize },
      warnings: result.warnings,
    },
  });
};
