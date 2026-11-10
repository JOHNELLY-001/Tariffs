import { z } from 'zod';
import { HS_CODE } from '../../config/constants.js';

/**
 * Import-cost request contract.
 *
 * Inputs only. No tax base, sequence or rate is assumed here — those belong to
 * verified rules, which are not part of this release.
 */
export const importCostRequestSchema = z.object({
  hsCode: z
    .string({ error: 'an HS code is required' })
    .trim()
    .min(HS_CODE.minDigits, `must contain at least ${HS_CODE.minDigits} digits`)
    .max(40, 'must be at most 40 characters'),
  /** Declared customs value in `currency`. */
  customsValue: z
    .number({ error: 'must be a number' })
    .positive('must be greater than zero')
    .max(1_000_000_000_000, 'must be a realistic amount'),
  currency: z
    .string({ error: 'a currency is required' })
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'must be a three-letter ISO currency code')
    .transform((value) => value.toUpperCase()),
  quantity: z.number().positive('must be greater than zero').optional(),
  unit: z.string().trim().max(30).optional(),
  originCountry: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'must be a two-letter country code')
    .transform((value) => value.toUpperCase())
    .optional(),
  /** Caller-supplied context recorded verbatim in the result. */
  assumptions: z.array(z.string().trim().max(300)).max(20).optional(),
});

export type ImportCostRequest = z.infer<typeof importCostRequestSchema>;
