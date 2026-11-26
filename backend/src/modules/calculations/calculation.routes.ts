import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import * as controller from './calculation.controller.js';
import { importCostRequestSchema, calculationIdParamsSchema } from './calculation.schemas.js';

export const calculationRouter: Router = Router();

/**
 * Calculation contract. Returns an explicit `unsupported`/`needs_review` state
 * until verified rules are configured — never a fabricated landed cost.
 */
calculationRouter.post(
  '/calculations/import-cost',
  validate(importCostRequestSchema, 'body'),
  controller.calculateImportCost,
);

calculationRouter.get(
  '/calculations/import-cost/:calculationId',
  validate(calculationIdParamsSchema, 'params'),
  controller.getCalculationById,
);
