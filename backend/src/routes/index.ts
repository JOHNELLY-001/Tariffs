import { Router } from 'express';
import { calculationRouter } from '../modules/calculations/calculation.routes.js';
import { chapterRouter } from '../modules/chapters/chapter.routes.js';
import { noteRouter } from '../modules/notes/note.routes.js';
import { searchRouter } from '../modules/search/search.routes.js';
import { sectionRouter } from '../modules/sections/section.routes.js';
import { tariffRouter } from '../modules/tariffs/tariff.routes.js';

/**
 * API surface for `/api/v1`.
 *
 * Modules are mounted on a single router: one deployable, clear internal
 * boundaries. No module imports another module's controller or routes.
 */
export function buildApiRouter(): Router {
  const router = Router();

  router.use(searchRouter);
  router.use(tariffRouter);
  router.use(sectionRouter);
  router.use(chapterRouter);
  router.use(noteRouter);
  router.use(calculationRouter);

  return router;
}
