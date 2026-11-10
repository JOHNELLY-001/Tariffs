import type { RequestHandler } from 'express';
import { getValidated } from '../../middleware/validate-request.js';
import { buildPaginationMeta, toPageRequest } from '../../shared/http/pagination.js';
import { sendSuccess } from '../../shared/http/response.js';
import type { TariffIdParams } from '../tariffs/tariff.schemas.js';
import * as noteService from './note.service.js';
import type { SubheadingNoteQuery } from './note.schemas.js';

export const getTariffContext: RequestHandler = async (_req, res) => {
  const { id } = getValidated<TariffIdParams>(res, 'params');
  const context = await noteService.getTariffContext(id);

  sendSuccess(res, context, {
    meta: {
      contextComplete: context.contextComplete,
      chapterSource: context.chapterSource,
      subheadingNoteCount: context.subheadingNotes.length,
    },
  });
};

export const listSubheadingNotes: RequestHandler = async (_req, res) => {
  const query = getValidated<SubheadingNoteQuery>(res, 'query');
  const page = toPageRequest(query);
  const { items, total } = await noteService.listSubheadingNotes(
    {
      chapterCode: query.chapter_code,
      sectionCode: query.section_code,
      reference: query.reference,
    },
    query,
  );

  sendSuccess(res, { items }, { meta: { pagination: buildPaginationMeta(page, total) } });
};
