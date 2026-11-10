import { z } from 'zod';
import { SEARCH } from '../../config/constants.js';
import { paginationQuerySchema } from '../../shared/http/pagination.js';

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z
    .string({ error: 'a search query is required' })
    .trim()
    .min(SEARCH.minQueryLength, `must contain at least ${SEARCH.minQueryLength} characters`)
    .max(SEARCH.maxQueryLength, `must contain at most ${SEARCH.maxQueryLength} characters`),
  chapter_code: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, 'must be a one- or two-digit chapter code')
    .optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
