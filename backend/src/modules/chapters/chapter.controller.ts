import type { RequestHandler } from 'express';
import { getValidated } from '../../middleware/validate-request.js';
import { buildPaginationMeta, toPageRequest } from '../../shared/http/pagination.js';
import { sendSuccess } from '../../shared/http/response.js';
import type { ChapterCodeParams, ChapterListQuery } from './chapter.schemas.js';
import * as chapterService from './chapter.service.js';

export const listChapters: RequestHandler = async (_req, res) => {
  const query = getValidated<ChapterListQuery>(res, 'query');
  const page = toPageRequest(query);
  const { items, total } = await chapterService.listChapters(page, query.section_code);

  sendSuccess(res, { items }, { meta: { pagination: buildPaginationMeta(page, total) } });
};

export const getChapter: RequestHandler = async (_req, res) => {
  const { code } = getValidated<ChapterCodeParams>(res, 'params');
  const detail = await chapterService.getChapter(code);
  sendSuccess(res, detail, { meta: { contextComplete: detail.contextComplete } });
};
