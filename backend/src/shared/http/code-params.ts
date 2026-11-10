import { z } from 'zod';

/**
 * Path-parameter schemas shared by more than one module (tariff lines are
 * listed under a chapter, so the tariffs and chapters modules must agree on
 * how a chapter code is validated).
 */

export const chapterCodeParamsSchema = z.object({
  code: z
    .string({ error: 'must be a chapter code' })
    .trim()
    .regex(/^\d{1,2}$/, 'must be a one- or two-digit chapter code'),
});

export type ChapterCodeParams = z.infer<typeof chapterCodeParamsSchema>;

export const sectionCodeParamsSchema = z.object({
  code: z
    .string({ error: 'must be a section code' })
    .trim()
    .min(1, 'must be a section code')
    .max(10, 'must be at most 10 characters'),
});

export type SectionCodeParams = z.infer<typeof sectionCodeParamsSchema>;
