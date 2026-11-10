import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/http/pagination.js';

export const subheadingNoteQuerySchema = paginationQuerySchema.extend({
  chapter_code: z.string().trim().max(4, 'must be at most 4 characters').optional(),
  section_code: z.string().trim().max(10, 'must be at most 10 characters').optional(),
  reference: z.string().trim().max(60, 'must be at most 60 characters').optional(),
});

export type SubheadingNoteQuery = z.infer<typeof subheadingNoteQuerySchema>;
