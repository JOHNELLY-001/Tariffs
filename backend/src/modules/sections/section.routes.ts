import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import { paginationQuerySchema } from '../../shared/http/pagination.js';
import * as controller from './section.controller.js';
import { sectionCodeParamsSchema } from './section.schemas.js';

export const sectionRouter: Router = Router();

sectionRouter.get('/sections', validate(paginationQuerySchema, 'query'), controller.listSections);

sectionRouter.get(
  '/sections/:code',
  validate(sectionCodeParamsSchema, 'params'),
  controller.getSection,
);
