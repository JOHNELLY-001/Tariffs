import { z } from 'zod';
import { HS_CODE } from '../../config/constants.js';

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d+)?$/.test(value), 'must be a non-negative decimal');

const quantitySchema = z.union([
  z.number().positive(),
  z.object({
    value: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
    unit: z.string().trim().min(1).max(30),
  }),
]);

export const importCostRequestSchema = z.object({
  destination: z.enum(['TZ_MAINLAND']).default('TZ_MAINLAND'),
  simulationDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)')
    .default(() => new Date().toISOString().slice(0, 10)),
  reference: z.string().trim().max(120).optional(),
  hsCode: z
    .string({ error: 'an HS code is required' })
    .trim()
    .min(HS_CODE.minDigits, `must contain at least ${HS_CODE.minDigits} digits`)
    .max(40, 'must be at most 40 characters'),
  tariffId: z.coerce.number().int().positive().optional(),
  originCountry: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'must be a two-letter country code')
    .transform((value) => value.toUpperCase())
    .optional(),
  currency: z
    .string({ error: 'a currency is required' })
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'must be a three-letter ISO currency code')
    .transform((value) => value.toUpperCase()),
  invoiceValue: decimalString.optional(),
  customsValue: decimalString.optional(),
  freight: decimalString.default('0'),
  insurance: decimalString.default('0'),
  otherCosts: decimalString.default('0'),
  quantity: quantitySchema.optional(),
  unit: z.string().trim().max(30).optional(),
  preferentialTreatment: z.boolean().default(false),
  assumptions: z.array(z.string().trim().max(300)).max(20).optional(),
}).refine((data) => data.invoiceValue !== undefined || data.customsValue !== undefined, {
  message: 'either invoiceValue or customsValue is required',
  path: ['invoiceValue'],
});

export type ImportCostRequest = z.infer<typeof importCostRequestSchema>;

export const calculationIdParamsSchema = z.object({
  calculationId: z.string().uuid('must be a valid calculation id'),
});

export type CalculationIdParams = z.infer<typeof calculationIdParamsSchema>;
