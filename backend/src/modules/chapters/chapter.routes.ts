import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import * as controller from './chapter.controller.js';
import { chapterCodeParamsSchema, chapterListQuerySchema } from './chapter.schemas.js';

export const chapterRouter: Router = Router();

chapterRouter.get('/chapters', validate(chapterListQuerySchema, 'query'), controller.listChapters);

chapterRouter.get('/chapters/:code', validate(chapterCodeParamsSchema, 'params'), controller.getChapter);
