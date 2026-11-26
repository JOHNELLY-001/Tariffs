import { Decimal } from './utils/decimal.utils.js';
import { calculateTaxCharges, type TaxCalculationInput } from './services/tax-calculation.service.js';
import { listTaxRules } from './tax-rule.service.js';
import type { TaxRule } from './tax-rule.service.js';

export interface TaxInput {
  jurisdiction?: string;
  simulationDate?: string;
  destination?: string;
  customsValue?: Decimal | string | number | null;
  dutyAmount?: Decimal | string | number | null;
  currency: string;
  quantity?: { value: string | number | Decimal; unit: string } | null;
  includeVat?: boolean;
  rules?: TaxRule[];
  roundingScale?: number;
  originCountry?: string | null;
  preferentialTreatment?: boolean;
}

export interface TaxLine {
  ruleId: string;
  description: string;
  amount: string;
  currency: string;
  legalSource: string;
  effectiveFrom: string;
}

export interface TaxResult {
  state: 'calculated' | 'needs_review' | 'unsupported';
  lines: TaxLine[];
  appliedRuleIds: string[];
  reason: string | null;
  warnings: string[];
  totalCharges: string | null;
}

export function evaluateTaxes(input: TaxInput): TaxResult {
  const rules = input.rules ?? listTaxRules({
    jurisdiction: input.jurisdiction ?? 'TZ_MAINLAND',
    verificationStatus: 'VERIFIED',
  });

  // Filter by destination/jurisdiction already handled by rules list; if no rules,
  // return unsupported.
  if (rules.length === 0) {
    return {
      state: 'unsupported',
      lines: [],
      appliedRuleIds: [],
      reason: 'Tax and levy rules are not verified for this release, so no amount is calculated.',
      warnings: input.includeVat ? ['VAT_REQUESTED_BUT_UNSUPPORTED'] : [],
      totalCharges: null,
    };
  }

  const calcInput: TaxCalculationInput = {
    jurisdiction: input.jurisdiction ?? 'TZ_MAINLAND',
    simulationDate: input.simulationDate ?? new Date().toISOString().slice(0, 10),
    destination: input.destination,
    customsValue: input.customsValue ?? null,
    quantity: input.quantity ?? null,
    currency: input.currency,
    rules,
    roundingScale: input.roundingScale,
    originCountry: input.originCountry ?? null,
    preferentialTreatment: input.preferentialTreatment ?? false,
  };

  const result = calculateTaxCharges(calcInput);

  const lines: TaxLine[] = result.charges.map((charge) => ({
    ruleId: charge.ruleId,
    description: charge.name,
    amount: charge.amount,
    currency: charge.currency,
    legalSource: charge.source,
    effectiveFrom: charge.ruleVersion,
  }));

  return {
    state: result.status,
    lines,
    appliedRuleIds: result.appliedRuleIds,
    reason: result.reason,
    warnings: result.warnings,
    totalCharges: result.totalCharges,
  };
}
