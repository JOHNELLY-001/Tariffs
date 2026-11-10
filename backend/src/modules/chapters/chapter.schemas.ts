import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/http/pagination.js';

export {
  chapterCodeParamsSchema,
  type ChapterCodeParams,
} from '../../shared/http/code-params.js';

/** Pagination plus the optional verified section filter, validated together. */
export const chapterListQuerySchema = paginationQuerySchema.extend({
  section_code: z.string().trim().max(10, 'must be at most 10 characters').optional(),
});

export type ChapterListQuery = z.infer<typeof chapterListQuerySchema>;
