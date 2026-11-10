import type { RequestHandler } from 'express';
import { getValidated } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../shared/http/response.js';
import type { ImportCostRequest } from './calculation.schemas.js';
import * as calculationService from './calculation.service.js';

export const calculateImportCost: RequestHandler = async (_req, res) => {
  const input = getValidated<ImportCostRequest>(res, 'body');
  const result = await calculationService.calculateImportCost(input);

  sendSuccess(res, result, {
    meta: {
      state: result.state,
      calculated: result.state === 'calculated',
      ruleIds: result.ruleIds,
    },
  });
};
