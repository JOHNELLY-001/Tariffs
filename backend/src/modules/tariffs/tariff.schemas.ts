import { z } from 'zod';
import { HS_CODE, TARIFF_LOOKUP } from '../../config/constants.js';

export const tariffIdParamsSchema = z.object({
  id: z.coerce
    .number({ error: 'must be a positive integer' })
    .int('must be a positive integer')
    .positive('must be a positive integer')
    .max(Number.MAX_SAFE_INTEGER, 'must be a valid database identifier'),
});

export type TariffIdParams = z.infer<typeof tariffIdParamsSchema>;

export const hsCodeParamsSchema = z.object({
  code: z
    .string({ error: 'must be a tariff code' })
    .trim()
    .min(HS_CODE.minDigits, `must contain at least ${HS_CODE.minDigits} digits`)
    .max(40, 'must be at most 40 characters'),
});

export type HsCodeParams = z.infer<typeof hsCodeParamsSchema>;

export const tariffLookupLimit = TARIFF_LOOKUP.maxMatchesPerCode;
