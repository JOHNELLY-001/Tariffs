import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import * as controller from './search.controller.js';
import { searchQuerySchema } from './search.schemas.js';

export const searchRouter: Router = Router();

searchRouter.get('/search', validate(searchQuerySchema, 'query'), controller.searchTariffs);
