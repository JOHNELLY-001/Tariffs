import { randomUUID } from 'node:crypto';
import type { CalculationState } from '../../config/constants.js';
import type { ImportCostRequest } from './calculation.schemas.js';
import { evaluateDuty, type DutyResult } from './duty.service.js';
import { analyzeRate, type RateAnalysis } from './rate-parser.service.js';
import { resolveTariff, type TariffResolutionResult } from './services/tariff-resolution.service.js';
import { valuate, type ValuationResult } from './valuation.service.js';
import { calculateTaxCharges, type TaxCharge } from './services/tax-calculation.service.js';
import { listEffectiveTaxRules } from './tax-rule.service.js';
import { evaluateTaxes, type TaxResult } from './tax.service.js';
import { listVerifiedRules } from './rules-registry.js';
import { persistCalculation } from './services/calculation-audit.service.js';

export const CALCULATION_DISCLAIMER =
  'This response is not a customs assessment. No duty, levy, VAT or landed cost has been calculated unless a verified rule set is active.';

export interface CalculationTariff {
  id: number;
  hsCode: string;
  description: string | null;
  rate: string | null;
  rateAnalysis: RateAnalysis;
  sourcePage: number | null;
  extractionPhase: number | null;
  scheduleType: string | null;
  originalRate: string | null;
  resolvedRate: string | null;
  sensitiveTariffId: number | null;
}

export interface ImportCostTotals {
  customsDuty: string;
  exciseDuty: string;
  vat: string;
  levies: string;
  otherCharges: string;
  totalImportCharges: string;
  customsValue: string;
  estimatedLandedCost: string;
}

export interface ImportCostResult {
  calculationId: string;
  status: CalculationState;
  state: CalculationState;
  destination: string;
  simulationDate: string;
  reference?: string;
  inputs: ImportCostRequest;
  tariff: CalculationTariff | null;
  candidates: Array<{
    id: number;
    hsCode: string;
    rate: string | null;
    extractionPhase: number | null;
    scheduleType: string | null;
  }>;
  valuation: ValuationResult;
  exchangeRate: {
    rate: string | null;
    source: string | null;
    effectiveDate: string | null;
  };
  charges: TaxCharge[];
  duty: DutyResult;
  tax: TaxResult;
  items: Array<Record<string, never>>;
  totals: ImportCostTotals | null;
  assumptions: string[];
  ruleIds: string[];
  warnings: string[];
  disclaimer: string;
  ruleVersion: string;
  generatedAt: string;
}

function normalizeQuantity(input: ImportCostRequest): { value: string; unit: string } | null {
  if (typeof input.quantity === 'number') {
    return input.quantity > 0 ? { value: String(input.quantity), unit: input.unit ?? '' } : null;
  }
  if (input.quantity && typeof input.quantity === 'object') {
    return { value: String(input.quantity.value), unit: input.quantity.unit };
  }
  return null;
}

export async function calculateImportCost(input: ImportCostRequest): Promise<ImportCostResult> {
  const destination = input.destination ?? 'TZ_MAINLAND';
  const simulationDate = input.simulationDate ?? new Date().toISOString().slice(0, 10);
  const invoiceValue = input.invoiceValue ?? input.customsValue ?? '0';

  const resolution: TariffResolutionResult = await resolveTariff({
    hsCode: input.hsCode,
    tariffId: input.tariffId,
  });

  const selected = resolution.selected;
  const ambiguous = resolution.status === 'ambiguous';

  const tariff: CalculationTariff | null = selected
    ? {
        id: selected.id,
        hsCode: selected.hsCode,
        description: selected.description,
        rate: selected.rate,
        rateAnalysis: selected.rateAnalysis,
        sourcePage: selected.sourcePage,
        extractionPhase: selected.extractionPhase,
        scheduleType: selected.scheduleType,
        originalRate: selected.rate,
        resolvedRate: resolution.sensitiveTariff ? resolution.sensitiveTariff.rate : selected.rate,
        sensitiveTariffId: resolution.sensitiveTariff ? resolution.sensitiveTariff.id : null,
      }
    : null;

  const rateAnalysis: RateAnalysis = selected?.rateAnalysis ?? analyzeRate(null);

  const valuation = await valuate({
    invoiceValue,
    currency: input.currency,
    freight: input.freight ?? '0',
    insurance: input.insurance ?? '0',
    otherCosts: input.otherCosts ?? '0',
    simulationDate,
    originCountry: input.originCountry,
  });

  const quantity = normalizeQuantity(input);

  const taxRules = listEffectiveTaxRules('TZ_MAINLAND', simulationDate);
  const taxCalc = calculateTaxCharges({
    jurisdiction: 'TZ_MAINLAND',
    simulationDate,
    destination,
    customsValue: valuation.customsValue,
    quantity,
    currency: input.currency,
    rules: taxRules,
    originCountry: input.originCountry ?? null,
    preferentialTreatment: input.preferentialTreatment ?? false,
  });

  const duty = evaluateDuty({
    rateAnalysis,
    customsValue: null,
    quantity: quantity ? Number(quantity.value) : undefined,
    currency: input.currency,
  });
  const tax = evaluateTaxes({
    jurisdiction: 'TZ_MAINLAND',
    simulationDate,
    destination,
    customsValue: valuation.customsValue,
    quantity,
    currency: input.currency,
    rules: taxRules,
    originCountry: input.originCountry ?? null,
    preferentialTreatment: input.preferentialTreatment ?? false,
  });

  const valuationNeedsReview = valuation.state !== 'calculated';
  const taxNeedsReview = taxCalc.status !== 'calculated';
  const state: CalculationState = ambiguous
    ? 'needs_review'
    : valuationNeedsReview || taxNeedsReview
      ? 'needs_review'
      : taxCalc.status === 'unsupported'
        ? 'unsupported'
        : 'completed';

  const warnings = new Set<string>([
    ...valuation.warnings,
    ...duty.warnings,
    ...tax.warnings,
    ...rateAnalysis.warnings,
    ...resolution.warnings,
    ...taxCalc.warnings,
  ]);
  if (ambiguous) {
    warnings.add('HS_CODE_AMBIGUOUS: multiple tariff records share this code; no record was selected automatically.');
  }

  // Totals only when completed.
  let totals: ImportCostTotals | null = null;
  if (state === 'completed' && valuation.customsValue !== null) {
    const customsValue = valuation.customsValue;
    const customsDuty = taxCalc.charges
      .filter((c) => c.taxType === 'duty')
      .reduce((a, c) => a + Number(c.amount), 0);
    const exciseDuty = taxCalc.charges
      .filter((c) => c.taxType === 'excise')
      .reduce((a, c) => a + Number(c.amount), 0);
    const vat = taxCalc.charges
      .filter((c) => c.taxType === 'vat')
      .reduce((a, c) => a + Number(c.amount), 0);
    const levies = taxCalc.charges
      .filter((c) => c.taxType === 'levy')
      .reduce((a, c) => a + Number(c.amount), 0);
    const otherCharges = taxCalc.charges
      .filter((c) => c.taxType === 'other')
      .reduce((a, c) => a + Number(c.amount), 0);
    const totalImportCharges = customsDuty + exciseDuty + vat + levies + otherCharges;
    totals = {
      customsDuty: String(customsDuty),
      exciseDuty: String(exciseDuty),
      vat: String(vat),
      levies: String(levies),
      otherCharges: String(otherCharges),
      totalImportCharges: String(totalImportCharges),
      customsValue,
      estimatedLandedCost: String(Number(customsValue) + totalImportCharges),
    };
  }

  const result: ImportCostResult = {
    calculationId: randomUUID(),
    status: state,
    state,
    destination,
    simulationDate,
    reference: input.reference,
    inputs: input,
    tariff: ambiguous ? null : tariff,
    candidates: (ambiguous ? resolution.candidates : []).map((match) => ({
      id: match.id,
      hsCode: match.hsCode,
      rate: match.rate,
      extractionPhase: match.extractionPhase,
      scheduleType: match.scheduleType,
    })),
    valuation,
    exchangeRate: {
      rate: valuation.exchangeRate,
      source: valuation.exchangeRateSource,
      effectiveDate: valuation.exchangeRateEffectiveDate,
    },
    charges: taxCalc.charges,
    duty,
    tax,
    items: [],
    totals,
    assumptions: [
      ...(input.assumptions ?? []),
      'No customs valuation, duty, levy or tax rule is applied unless verified rules are registered.',
      'The original rate text is reported unchanged; it is not converted into an amount without a verified rule.',
    ],
    ruleIds: taxRules.map((r) => r.id),
    warnings: [...warnings],
    disclaimer: CALCULATION_DISCLAIMER,
    ruleVersion: 'TZ-MAINLAND-IMPORTS-DRAFT-UNVERIFIED',
    generatedAt: new Date().toISOString(),
  };

  const persisted = await persistCalculation(result);
  if (!persisted) {
    result.warnings.push('CALCULATION_NOT_PERSISTED: calculation history could not be saved.');
  }

  return result;
}
