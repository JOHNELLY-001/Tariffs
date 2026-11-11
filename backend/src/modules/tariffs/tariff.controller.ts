import type { RequestHandler } from 'express';
import { buildPaginationMeta, toPageRequest, type PaginationQuery } from '../../shared/http/pagination.js';
import { sendSuccess } from '../../shared/http/response.js';
import { getValidated } from '../../middleware/validate-request.js';
import type { HsCodeParams, TariffIdParams } from './tariff.schemas.js';
import * as tariffService from './tariff.service.js';

export const getTariffById: RequestHandler = async (_req, res) => {
  const { id } = getValidated<TariffIdParams>(res, 'params');
  const tariff = await tariffService.getTariffById(id);
  sendSuccess(res, tariff, { meta: { source: 'cet_tariffs' } });
};

export const getTariffByHsCode: RequestHandler = async (_req, res) => {
  const { code } = getValidated<HsCodeParams>(res, 'params');
  const result = await tariffService.getTariffsByHsCode(code);
  sendSuccess(res, { matches: result.matches }, {
    meta: {
      matchCount: result.matches.length,
      ambiguous: result.ambiguous,
      schedules: result.schedules,
      normalization: result.normalization,
      notes: result.ambiguous
        ? [
            'Multiple tariff records share this HS code (for example across schedules). All matches are returned with their scheduleType; none is selected on your behalf.',
          ]
        : [],
      disclaimer: 'A tariff-code match is a candidate tariff line, not a legally confirmed classification ruling.',
    },
  });
};

export const listChapterTariffs: RequestHandler = async (_req, res) => {
  const { code } = getValidated<{ code: string }>(res, 'params');
  const pagination = getValidated<PaginationQuery>(res, 'query');
  const page = toPageRequest(pagination);
  const { items, total } = await tariffService.getChapterTariffs(code, page);

  sendSuccess(res, { items }, { meta: { pagination: buildPaginationMeta(page, total) } });
};
