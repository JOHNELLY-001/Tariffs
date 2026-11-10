import type { CalculationState } from '../../config/constants.js';
import * as tariffService from '../tariffs/tariff.service.js';
import type { ImportCostRequest } from './calculation.schemas.js';
import { evaluateDuty, type DutyResult } from './duty.service.js';
import { analyzeRate, type RateAnalysis } from './rate-parser.service.js';
import { listVerifiedRules } from './rules-registry.js';
import { evaluateTaxes, type TaxResult } from './tax.service.js';
import { valuate, type ValuationResult } from './valuation.service.js';

/**
 * Import-cost orchestration.
 *
 * The workflow is wired end to end, but every amount-producing step is gated
 * behind a verified rule. This release therefore reports `unsupported` (or
 * `needs_review` when the HS code is ambiguous) and never invents a landed
 * cost.
 */

export const CALCULATION_DISCLAIMER =
  'This response is not a customs assessment. No duty, levy, VAT or landed cost has been calculated.';

export interface CalculationTariff {
  id: number;
  hsCode: string;
  description: string | null;
  rate: string | null;
  rateAnalysis: RateAnalysis;
  sourcePage: number | null;
  extractionPhase: string | null;
}

export interface ImportCostResult {
  state: CalculationState;
  inputs: ImportCostRequest;
  tariff: CalculationTariff | null;
  candidates: Array<{ id: number; hsCode: string; rate: string | null; extractionPhase: string | null }>;
  valuation: ValuationResult;
  duty: DutyResult;
  tax: TaxResult;
  items: Array<Record<string, never>>;
  totals: null;
  assumptions: string[];
  ruleIds: string[];
  warnings: string[];
  disclaimer: string;
  generatedAt: string;
}

export async function calculateImportCost(input: ImportCostRequest): Promise<ImportCostResult> {
  const lookup = await tariffService.getTariffsByHsCode(input.hsCode);
  const [selected] = lookup.matches;
  const ambiguous = lookup.ambiguous;
  const tariff = selected
    ? {
        id: selected.id,
        hsCode: selected.hsCode,
        description: selected.description,
        rate: selected.rate,
        rateAnalysis: selected.rateAnalysis,
        sourcePage: selected.sourcePage,
        extractionPhase: selected.extractionPhase,
      }
    : null;

  const rateAnalysis = selected?.rateAnalysis ?? analyzeRate(null);

  const valuation = valuate({
    customsValue: input.customsValue,
    currency: input.currency,
    quantity: input.quantity,
    unit: input.unit,
    originCountry: input.originCountry,
  });
  const duty = evaluateDuty({
    rateAnalysis,
    customsValue: valuation.customsValue,
    quantity: input.quantity,
    currency: input.currency,
  });
  const tax = evaluateTaxes({
    customsValue: valuation.customsValue,
    dutyAmount: null,
    currency: input.currency,
  });

  const stages: CalculationState[] = [valuation.state, duty.state, tax.state];
  const state: CalculationState = ambiguous
    ? 'needs_review'
    : stages.every((stage) => stage === 'calculated')
      ? 'calculated'
      : stages.includes('needs_review')
        ? 'needs_review'
        : 'unsupported';

  const warnings = new Set<string>([
    ...valuation.warnings,
    ...duty.warnings,
    ...tax.warnings,
    ...rateAnalysis.warnings,
  ]);
  if (ambiguous) {
    warnings.add(
      'HS_CODE_AMBIGUOUS: multiple tariff records share this code; no record was selected automatically.',
    );
  }

  return {
    state,
    inputs: input,
    tariff: ambiguous ? null : tariff,
    candidates: (ambiguous ? lookup.matches : []).map((match) => ({
      id: match.id,
      hsCode: match.hsCode,
      rate: match.rate,
      extractionPhase: match.extractionPhase,
    })),
    valuation,
    duty,
    tax,
    items: [],
    totals: null,
    assumptions: [
      ...(input.assumptions ?? []),
      'No customs valuation, duty, levy or tax rule is applied in this release.',
      'The original rate text is reported unchanged; it is not converted into an amount.',
    ],
    ruleIds: listVerifiedRules().map((rule) => rule.id),
    warnings: [...warnings],
    disclaimer: CALCULATION_DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}
