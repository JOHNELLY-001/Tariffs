import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import { paginationQuerySchema } from '../../shared/http/pagination.js';
import { chapterCodeParamsSchema } from '../../shared/http/code-params.js';
import * as controller from './tariff.controller.js';
import { hsCodeParamsSchema, tariffIdParamsSchema } from './tariff.schemas.js';

export const tariffRouter: Router = Router();

/** Exact HS-code lookup. Registered before the id route for clarity. */
tariffRouter.get(
  '/tariffs/hs/:code',
  validate(hsCodeParamsSchema, 'params'),
  controller.getTariffByHsCode,
);

/** Retrieve a tariff line by its stable database identifier. */
tariffRouter.get('/tariffs/:id', validate(tariffIdParamsSchema, 'params'), controller.getTariffById);

/** Tariff lines belonging to a chapter. */
tariffRouter.get(
  '/chapters/:code/tariffs',
  validate(chapterCodeParamsSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  controller.listChapterTariffs,
);
