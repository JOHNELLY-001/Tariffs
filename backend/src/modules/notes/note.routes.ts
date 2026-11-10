import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import { tariffIdParamsSchema } from '../tariffs/tariff.schemas.js';
import * as controller from './note.controller.js';
import { subheadingNoteQuerySchema } from './note.schemas.js';

export const noteRouter: Router = Router();

/** Classification context for one tariff line: chapter, section, notes. */
noteRouter.get(
  '/tariffs/:id/notes',
  validate(tariffIdParamsSchema, 'params'),
  controller.getTariffContext,
);

/** Browse/search subheading guidance. */
noteRouter.get(
  '/subheading-notes',
  validate(subheadingNoteQuerySchema, 'query'),
  controller.listSubheadingNotes,
);
