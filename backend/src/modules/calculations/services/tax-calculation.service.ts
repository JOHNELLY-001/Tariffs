import { Decimal } from '../utils/decimal.utils.js';
import { roundDecimal, toScaledInteger, currencyScale } from '../utils/rounding.utils.js';
import { validateDependencies, type TaxRule } from '../tax-rule.service.js';

export interface TaxQuantity {
  value: string | number | Decimal;
  unit: string;
}

export interface TaxCalculationInput {
  jurisdiction: string;
  simulationDate: string;
  destination?: string;
  customsValue: Decimal | string | number | null;
  quantity?: TaxQuantity | null;
  currency: string;
  rules: TaxRule[];
  roundingScale?: number;
  originCountry?: string | null;
  preferentialTreatment?: boolean;
}

export interface TaxCharge {
  code: string;
  name: string;
  taxType: string;
  rateType: string;
  rate: string;
  taxableBase: string;
  formula: string;
  amount: string;
  currency: string;
  source: string;
  ruleId: string;
  ruleVersion: string;
  calculationOrder: number;
}

export interface TaxCalculationResult {
  status: 'calculated' | 'needs_review' | 'unsupported';
  charges: TaxCharge[];
  totalCharges: string | null;
  reason: string | null;
  warnings: string[];
  appliedRuleIds: string[];
}

function parseDecimal(value: Decimal | string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    return Decimal.parse(String(value));
  } catch {
    return null;
  }
}

function scaled(value: Decimal, scale: number): string {
  const rounded = roundDecimal(value, scale);
  return rounded.toString();
}

function exemptionApplies(rule: TaxRule, input: TaxCalculationInput): boolean {
  const conditions = rule.exemptionConditions;
  if (!conditions) return false;
  if (Array.isArray(conditions.originCountries) && input.originCountry) {
    if (conditions.originCountries.includes(input.originCountry)) return true;
  }
  if (conditions.preferentialTreatment === true && input.preferentialTreatment === true) {
    return true;
  }
  return false;
}

const SUPPORTED_APPLICABILITY_KEYS = new Set([
  'requiresCustomsValue',
  'requiresQuantity',
  'requiredQuantityUnit',
  'allowedOriginCountries',
  'preferentialTreatmentRequired',
  'requiresQuantityNonNegative',
]);

function evaluateApplicability(rule: TaxRule, input: TaxCalculationInput): { ok: boolean; reason: string } {
  const conditions = rule.applicabilityConditions;
  if (!conditions) return { ok: true, reason: '' };
  for (const key of Object.keys(conditions)) {
    if (!SUPPORTED_APPLICABILITY_KEYS.has(key)) {
      return { ok: false, reason: `UNSUPPORTED_APPLICABILITY_CONDITION: ${key}` };
    }
  }
  const customsValue = parseDecimal(input.customsValue);
  if (conditions.requiresCustomsValue === true && customsValue === null) {
    return { ok: false, reason: 'MISSING_APPLICABILITY_INPUT: customsValue' };
  }
  if (conditions.requiresQuantity === true && !input.quantity) {
    return { ok: false, reason: 'MISSING_APPLICABILITY_INPUT: quantity' };
  }
  if (typeof conditions.requiredQuantityUnit === 'string') {
    if (!input.quantity || !input.quantity.unit) {
      return { ok: false, reason: 'MISSING_APPLICABILITY_INPUT: quantity unit' };
    }
    if (input.quantity.unit.toUpperCase() !== conditions.requiredQuantityUnit.toUpperCase()) {
      return { ok: false, reason: 'APPLICABILITY_UNIT_MISMATCH' };
    }
  }
  if (Array.isArray(conditions.allowedOriginCountries)) {
    if (!input.originCountry || !conditions.allowedOriginCountries.includes(input.originCountry)) {
      return { ok: false, reason: 'APPLICABILITY_ORIGIN_NOT_ALLOWED' };
    }
  }
  if (conditions.preferentialTreatmentRequired === true && input.preferentialTreatment !== true) {
    return { ok: false, reason: 'APPLICABILITY_PREFERENTIAL_REQUIRED' };
  }
  if (conditions.requiresQuantityNonNegative === true && input.quantity) {
    const q = parseDecimal(input.quantity.value);
    if (q === null || q.isNegative()) {
      return { ok: false, reason: 'INVALID_QUANTITY' };
    }
  }
  return { ok: true, reason: '' };
}

function resolveBase(
  rule: TaxRule,
  input: TaxCalculationInput,
  calculatedAmounts: Map<string, Decimal>,
): Decimal | null {
  const customsValue = parseDecimal(input.customsValue);
  switch (rule.calculationBase) {
    case 'customs_value':
    case 'cif':
    case 'dutiable_value':
      return customsValue;
    case 'vat_base': {
      if (customsValue === null) return null;
      let base = customsValue;
      for (const dependency of rule.dependencies) {
        const depAmount = calculatedAmounts.get(dependency);
        if (depAmount === undefined) return null;
        base = base.add(depAmount);
      }
      return base;
    }
    case 'quantity': {
      if (!input.quantity) return null;
      return parseDecimal(input.quantity.value);
    }
    default:
      return null;
  }
}

function computeAmount(
  rule: TaxRule,
  base: Decimal,
  quantity: Decimal | null,
  input: TaxCalculationInput,
): { amount: Decimal; formula: string } | null {
  const rateValue = rule.rateValue !== null ? parseDecimal(rule.rateValue) : null;
  const scale = input.roundingScale ?? 2;

  switch (rule.rateType) {
    case 'free':
      return { amount: Decimal.zero(), formula: '0' };
    case 'ad_valorem': {
      if (rateValue === null) return null;
      const amount = base.mul(rateValue).div(Decimal.parse('100'));
      return { amount, formula: `${base.toString()} * ${rule.rateValue} / 100` };
    }
    case 'specific': {
      if (rateValue === null || quantity === null) return null;
      if (quantity.isNegative()) return null;
      if (!input.quantity?.unit) return null;
      const expectedUnit = rule.applicabilityConditions?.requiredQuantityUnit;
      if (typeof expectedUnit === 'string' && expectedUnit.toUpperCase() !== input.quantity.unit.toUpperCase()) {
        return null;
      }
      const amount = quantity.mul(rateValue);
      return { amount, formula: `${quantity.toString()} * ${rule.rateValue}` };
    }
    case 'compound': {
      // Only supported when the expression explicitly combines a percentage
      // and a specific component with '+'.
      if (!rule.rateExpression || !rule.rateExpression.includes('+')) return null;
      const parts = rule.rateExpression.split('+').map((part) => part.trim());
      if (parts.length !== 2) return null;
      const percentageMatch = /^(\d+(?:\.\d+)?)\s*%$/.exec(parts[0]!);
      const specificMatch = /^(\d+(?:\.\d+)?)\s*(?:per\s+.+)?$/.exec(parts[1]!);
      if (!percentageMatch || !specificMatch) return null;
      if (quantity === null) return null;
      if (quantity.isNegative()) return null;
      if (!input.quantity?.unit) return null;
      const pct = Decimal.parse(percentageMatch[1]!);
      const spec = Decimal.parse(specificMatch[1]!);
      const amount = base.mul(pct).div(Decimal.parse('100')).add(quantity.mul(spec));
      return {
        amount,
        formula: `${base.toString()} * ${percentageMatch[1]!}% / 100 + ${quantity.toString()} * ${specificMatch[1]!}`,
      };
    }
    case 'sensitive_item':
      return null;
    default:
      return null;
  }
}

export function calculateTaxCharges(input: TaxCalculationInput): TaxCalculationResult {
  const warnings: string[] = [];
  const charges: TaxCharge[] = [];
  const appliedRuleIds: string[] = [];
  const calculatedAmounts = new Map<string, Decimal>();

  if (!input.rules || input.rules.length === 0) {
    return {
      status: 'unsupported',
      charges: [],
      totalCharges: null,
      reason: 'NO_TAX_RULES: no verified tax rules are registered for this request.',
      warnings: ['NO_TAX_RULES'],
      appliedRuleIds: [],
    };
  }

  // Validate dependencies.
  try {
    validateDependencies(input.rules);
  } catch (error) {
    return {
      status: 'needs_review',
      charges: [],
      totalCharges: null,
      reason: `DEPENDENCY_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
      warnings: ['DEPENDENCY_VALIDATION_FAILED'],
      appliedRuleIds: [],
    };
  }

  const customsValue = parseDecimal(input.customsValue);
  if (customsValue !== null && customsValue.isNegative()) {
    return {
      status: 'needs_review',
      charges: [],
      totalCharges: null,
      reason: 'INVALID_MONETARY_INPUT: customs value must not be negative.',
      warnings: ['INVALID_MONETARY_INPUT: customs value must not be negative.'],
      appliedRuleIds: [],
    };
  }

  const sorted = [...input.rules].sort((a, b) => a.calculationOrder - b.calculationOrder);
  const scale = input.roundingScale ?? currencyScale(input.currency);
  let allCalculated = true;
  let applicableVerifiedCount = 0;

  for (const rule of sorted) {
    // Verification gate.
    if (rule.verificationStatus !== 'VERIFIED') {
      allCalculated = false;
      warnings.push(`TAX_RULE_NOT_VERIFIED: ${rule.id} is ${rule.verificationStatus} and was not executed.`);
      continue;
    }

    // Jurisdiction gate.
    if (rule.jurisdiction !== input.jurisdiction) {
      allCalculated = false;
      warnings.push(`JURISDICTION_MISMATCH: ${rule.id} does not apply to ${input.jurisdiction}.`);
      continue;
    }

    // Effective-date gate.
    const simTime = Date.parse(input.simulationDate);
    const fromTime = Date.parse(rule.effectiveFrom);
    const toTime = rule.effectiveTo ? Date.parse(rule.effectiveTo) : Number.POSITIVE_INFINITY;
    if (Number.isNaN(simTime) || Number.isNaN(fromTime) || fromTime > simTime || simTime > toTime) {
      allCalculated = false;
      warnings.push(`NO_EFFECTIVE_TAX_RULE: ${rule.id} is not effective on ${input.simulationDate}.`);
      continue;
    }

    // Applicability gate.
    const applicability = evaluateApplicability(rule, input);
    if (!applicability.ok) {
      allCalculated = false;
      warnings.push(`${applicability.reason}: ${rule.id}.`);
      continue;
    }

    // Exemption gate.
    if (exemptionApplies(rule, input)) {
      warnings.push(`EXEMPTION_APPLIED: ${rule.id} exempted.`);
      continue;
    }

    const quantityDecimal = input.quantity ? parseDecimal(input.quantity.value) : null;
    const base = resolveBase(rule, input, calculatedAmounts);
    if (base === null) {
      allCalculated = false;
      warnings.push(`MISSING_CALCULATION_INPUT: ${rule.id} could not resolve its base ${rule.calculationBase}.`);
      continue;
    }

    // Amount computation.
    const computed = computeAmount(rule, base, quantityDecimal, input);
    if (computed === null) {
      allCalculated = false;
      warnings.push(`UNSUPPORTED_RATE_TYPE: ${rule.id} uses an unsupported or unresolved rate expression.`);
      continue;
    }

    const roundedAmount = roundDecimal(computed.amount, scale);
    const amountString = scaled(computed.amount, scale);

    const charge: TaxCharge = {
      code: rule.ruleCode,
      name: rule.taxName,
      taxType: rule.taxType,
      rateType: rule.rateType,
      rate: rule.rateValue ?? rule.rateExpression ?? '',
      taxableBase: base.toString(),
      formula: computed.formula,
      amount: amountString,
      currency: input.currency,
      source: `${rule.sourceTitle} — ${rule.sourceProvision}`,
      ruleId: rule.id,
      ruleVersion: rule.effectiveFrom,
      calculationOrder: rule.calculationOrder,
    };

    charges.push(charge);
    appliedRuleIds.push(rule.id);
    applicableVerifiedCount += 1;
    calculatedAmounts.set(rule.id, roundedAmount);
  }

  if (charges.length === 0) {
    return {
      status: allCalculated ? 'unsupported' : 'needs_review',
      charges: [],
      totalCharges: null,
      reason: allCalculated
        ? 'NO_APPLICABLE_CHARGES: no charge could be calculated.'
        : 'CALCULATION_REQUIRES_REVIEW: one or more charges could not be calculated.',
      warnings,
      appliedRuleIds,
    };
  }

  // Total only when all applicable verified rules produced a charge.
  let total: Decimal | null = null;
  if (allCalculated && charges.length === applicableVerifiedCount) {
    total = charges.reduce((acc, charge) => acc.add(Decimal.parse(charge.amount)), Decimal.zero());
  }

  return {
    status: allCalculated && total !== null ? 'calculated' : 'needs_review',
    charges,
    totalCharges: total ? total.toString() : null,
    reason: total ? null : 'CALCULATION_REQUIRES_REVIEW: incomplete charge set.',
    warnings,
    appliedRuleIds,
  };
}
