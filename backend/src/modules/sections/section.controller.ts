import type { RequestHandler } from 'express';
import { getValidated } from '../../middleware/validate-request.js';
import { buildPaginationMeta, toPageRequest, type PaginationQuery } from '../../shared/http/pagination.js';
import { sendSuccess } from '../../shared/http/response.js';
import type { SectionCodeParams } from './section.schemas.js';
import * as sectionService from './section.service.js';

export const listSections: RequestHandler = async (_req, res) => {
  const pagination = getValidated<PaginationQuery>(res, 'query');
  const page = toPageRequest(pagination);
  const { items, total } = await sectionService.listSections(page);

  sendSuccess(res, { items }, { meta: { pagination: buildPaginationMeta(page, total) } });
};

export const getSection: RequestHandler = async (_req, res) => {
  const { code } = getValidated<SectionCodeParams>(res, 'params');
  const detail = await sectionService.getSection(code);
  sendSuccess(res, detail, { meta: { contextComplete: detail.contextComplete } });
};
