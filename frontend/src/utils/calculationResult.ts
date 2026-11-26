import type {
  AssessmentState,
  CalculationState,
  ImportCostResult,
  TaxCharge,
  ValuationComponent,
} from '@/types/api';

/**
 * Presentation helpers for the calculation result dashboard.
 *
 * Everything here is derived from the backend response. No duty, tax, total or
 * customs value is ever computed in the browser: missing values stay missing,
 * and unresolved assessments are reported with the backend's own reason text.
 */

export type StatusTone = 'accent' | 'warning' | 'danger' | 'neutral';

export interface StateDescriptor {
  label: string;
  title: string;
  description: string;
  tone: StatusTone;
  /** True only when the backend returned finished totals. */
  final: boolean;
}

const FINAL_STATES: CalculationState[] = ['completed', 'calculated'];

export function isFinalState(state: CalculationState): boolean {
  return FINAL_STATES.includes(state);
}

export function describeState(state: CalculationState): StateDescriptor {
  switch (state) {
    case 'completed':
    case 'calculated':
      return {
        label: 'Completed',
        title: 'Calculation completed',
        description:
          'The backend completed this calculation and returned the charge values and totals shown below.',
        tone: 'accent',
        final: true,
      };
    case 'partially_calculated':
      return {
        label: 'Partially calculated',
        title: 'Only part of the calculation could be completed',
        description:
          'Some backend charges were calculated, but at least one part requires review before any figure can be treated as final.',
        tone: 'warning',
        final: false,
      };
    case 'unsupported':
      return {
        label: 'Unsupported',
        title: 'This calculation is not supported yet',
        description:
          'The backend does not have verified rules that can calculate this request, so no duty, levy, VAT or landed-cost total was produced.',
        tone: 'neutral',
        final: false,
      };
    case 'failed':
      return {
        label: 'Failed',
        title: 'The calculation failed',
        description:
          'The backend reported a failed calculation state and did not return usable charge values.',
        tone: 'danger',
        final: false,
      };
    case 'needs_review':
    default:
      return {
        label: 'Needs review',
        title: 'Review required before relying on this result',
        description:
          'The backend returned an explicit review state. No duty, levy, VAT or landed-cost total can be relied on until the unresolved items are addressed.',
        tone: 'warning',
        final: false,
      };
  }
}

export interface SplitReason {
  code: string | null;
  message: string;
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** Split `CODE: message` without rewriting prose reasons. */
export function splitReason(value: string | null | undefined): SplitReason {
  if (!value) return { code: null, message: '' };
  const trimmed = value.trim();
  const separator = trimmed.indexOf(':');
  if (separator <= 0) {
    // A bare backend code without a message is still a code.
    if (CODE_PATTERN.test(trimmed)) return { code: trimmed, message: '' };
    return { code: null, message: trimmed };
  }

  const candidate = trimmed.slice(0, separator).trim();
  if (!CODE_PATTERN.test(candidate)) return { code: null, message: trimmed };

  return {
    code: candidate,
    message: trimmed.slice(separator + 1).trim(),
  };
}

const REASON_TEXT: Record<string, string> = {
  EXCHANGE_RATE_UNAVAILABLE:
    'No verified exchange rate is available for the submitted currency and simulation date, so the shipment could not be converted to Tanzanian shillings.',
  CUSTOMS_VALUATION_RULE_UNVERIFIED:
    'The customs valuation method and the costs that may be included are not verified, so the backend did not finalise a customs value.',
  INVALID_MONETARY_INPUT:
    'One or more monetary values were not accepted, so the shipment could not be valued.',
  INVALID_CURRENCY:
    'The submitted currency is not a valid three-letter ISO code, so the shipment could not be valued.',
  NO_TAX_RULES:
    'No verified Tanzanian tax or levy rules are registered for this request, so no charge was calculated.',
  NO_APPLICABLE_CHARGES:
    'No registered rule applied to this shipment, so no charge was calculated.',
  CALCULATION_REQUIRES_REVIEW:
    'At least one charge could not be calculated, so the result cannot be treated as final.',
  DEPENDENCY_VALIDATION_FAILED:
    'The applicable tax rules have an unresolved dependency, so the charge sequence could not be completed.',
  MISSING_APPLICABILITY_INPUT:
    'A rule needed an input that was not supplied, so that charge was not calculated.',
  APPLICABILITY_UNIT_MISMATCH:
    'A rule required a quantity in a different unit, so that charge was not calculated.',
  APPLICABILITY_ORIGIN_NOT_ALLOWED:
    'The country of origin does not meet a rule condition, so that charge was not calculated.',
  APPLICABILITY_PREFERENTIAL_REQUIRED:
    'A rule requires preferential treatment to be requested, so that charge was not calculated.',
  INVALID_QUANTITY:
    'The supplied quantity was not valid for an applicable rule, so that charge was not calculated.',
  UNSUPPORTED_RATE_TYPE:
    'A registered rule uses a rate expression that cannot be evaluated yet, so that charge was not calculated.',
  TAX_RULE_NOT_VERIFIED:
    'One or more registered tax rules are not verified, so they were not executed.',
  NO_EFFECTIVE_TAX_RULE:
    'A registered rule is not effective on the simulation date, so it was not executed.',
  MISSING_CALCULATION_INPUT:
    'A rule could not resolve its calculation base, so that charge was not calculated.',
  HS_CODE_AMBIGUOUS:
    'Several tariff records share this HS code. The backend never chooses between them, so no single record was used.',
};

/** Human-readable sentence for a backend reason, preserving prose reasons. */
export function reasonText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';

  // A bare backend code without a message.
  if (CODE_PATTERN.test(trimmed) && REASON_TEXT[trimmed]) {
    return REASON_TEXT[trimmed];
  }

  const { code, message } = splitReason(trimmed);
  if (code) {
    const known = REASON_TEXT[code];
    if (known) return message ? `${known} (${message})` : known;
    return message || code.replace(/_/g, ' ').toLowerCase();
  }
  return message;
}

const WARNING_EXPLANATIONS: Record<string, string> = {
  EXCHANGE_RATE_UNAVAILABLE:
    'The shipment could not be converted to Tanzanian shillings for this simulation date.',
  VALUATION_RULE_UNVERIFIED:
    'The backend has not verified which costs are legally includable in the customs value.',
  CUSTOMS_VALUATION_RULE_UNVERIFIED:
    'The backend has not verified the customs valuation method for this shipment.',
  NO_TAX_RULES: 'No verified Tanzanian tax or levy rules are registered for this request.',
  TAX_RULE_NOT_VERIFIED: 'A registered tax rule is not marked verified, so it was not executed.',
  NO_EFFECTIVE_TAX_RULE: 'A registered tax rule is not effective on the simulation date.',
  MISSING_APPLICABILITY_INPUT: 'A rule required an input, such as quantity or origin, that was not supplied.',
  MISSING_CALCULATION_INPUT: 'A rule could not resolve the base it needs to calculate a charge.',
  UNSUPPORTED_RATE_TYPE: 'A registered rule uses a rate expression the backend cannot evaluate yet.',
  INVALID_MONETARY_INPUT: 'One or more monetary values were rejected, so valuation could not proceed.',
  INVALID_CURRENCY: 'The submitted currency is not a valid three-letter ISO code.',
  EXEMPTION_APPLIED: 'A rule exemption applied to this shipment.',
  HS_CODE_AMBIGUOUS: 'Several tariff records share this HS code and none was chosen automatically.',
  NO_APPLICABLE_CHARGES: 'No registered rule applied, so no charge was calculated.',
  DEPENDENCY_VALIDATION_FAILED: 'The applicable rules have an unresolved dependency.',
  APPLICABILITY_UNIT_MISMATCH: 'A rule required a quantity in a different unit.',
  APPLICABILITY_ORIGIN_NOT_ALLOWED: 'The country of origin did not meet a rule condition.',
  APPLICABILITY_PREFERENTIAL_REQUIRED: 'A rule required preferential treatment to be requested.',
  INVALID_QUANTITY: 'The supplied quantity was not valid for an applicable rule.',
};

/** Plain-language explanation for a warning code, or null when unknown. */
export function warningExplanation(code: string | null): string | null {
  if (!code) return null;
  return WARNING_EXPLANATIONS[code] ?? null;
}

export function resultCurrency(result: ImportCostResult): string {
  return (result.valuation.currency || result.inputs.currency || '').toUpperCase();
}

/**
 * Format a backend money string for display.
 *
 * Values are never recomputed. Precision already present in the API value is
 * preserved up to six decimals; values beyond that are shown verbatim so the
 * dashboard cannot imply more precision than the backend returned.
 */
export function formatMoney(
  value: string | number | null | undefined,
  currency: string | null | undefined,
): string {
  const code = currency ? ` ${currency}` : '';
  if (value === null || value === undefined || value === '') return '—';

  const raw = String(value).trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return `${raw}${code}`;

  const decimals = raw.includes('.') ? raw.split('.')[1]?.replace(/0+$/, '').length ?? 0 : 0;
  if (decimals > 6) return `${raw}${code}`;

  const fractionDigits = Math.max(2, decimals);
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(parsed)}${code}`;
}

/** Format an ISO timestamp returned by the backend. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Format a `YYYY-MM-DD` date without timezone shifting it. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function destinationLabel(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  if (value.toUpperCase() === 'TZ_MAINLAND') return 'Tanzania mainland';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

const RATE_KIND_LABELS: Record<string, string> = {
  percentage: 'Percentage',
  specific: 'Specific',
  compound: 'Compound',
  sensitive_item: 'Sensitive item',
  free: 'Free',
  unknown: 'Unclassified',
};

export function rateKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'Not recorded';
  return RATE_KIND_LABELS[kind] ?? kind;
}

const RATE_TYPE_LABELS: Record<string, string> = {
  ad_valorem: 'Ad valorem',
  specific: 'Specific',
  compound: 'Compound',
  free: 'Free',
  sensitive_item: 'Sensitive item',
};

export function rateTypeLabel(rateType: string | null | undefined): string {
  if (!rateType) return 'Rate form not recorded';
  return RATE_TYPE_LABELS[rateType] ?? rateType.replace(/_/g, ' ');
}

const ASSESSMENT_LABELS: Record<AssessmentState | 'failed', string> = {
  calculated: 'Calculated',
  needs_review: 'Needs review',
  unsupported: 'Unsupported',
  failed: 'Failed',
};

const ASSESSMENT_TONES: Record<AssessmentState | 'failed', StatusTone> = {
  calculated: 'accent',
  needs_review: 'warning',
  unsupported: 'neutral',
  failed: 'danger',
};

export function assessmentLabel(state: AssessmentState | 'failed'): string {
  return ASSESSMENT_LABELS[state];
}

export function assessmentTone(state: AssessmentState | 'failed'): StatusTone {
  return ASSESSMENT_TONES[state];
}

export interface ChargeRow {
  key: string;
  name: string;
  code: string;
  taxType: string;
  base: string;
  rate: string;
  rateType: string;
  formula: string;
  amount: string;
  currency: string;
  source: string;
  statusLabel: string;
  statusTone: StatusTone;
  detail?: string;
}

/** Calculated charge lines, exactly as returned, in backend order. */
export function calculatedChargeRows(result: ImportCostResult): ChargeRow[] {
  return [...result.charges]
    .sort((a, b) => a.calculationOrder - b.calculationOrder)
    .map((charge: TaxCharge) => ({
      key: `charge-${charge.ruleId}-${charge.code}-${charge.calculationOrder}`,
      name: charge.name,
      code: charge.code,
      taxType: charge.taxType,
      base: formatMoney(charge.taxableBase, charge.currency),
      rate: charge.rate || '—',
      rateType: rateTypeLabel(charge.rateType),
      formula: charge.formula,
      amount: formatMoney(charge.amount, charge.currency),
      currency: charge.currency,
      source: charge.source,
      statusLabel: 'Calculated',
      statusTone: 'accent',
    }));
}

export interface UnresolvedAssessment {
  key: string;
  name: string;
  status: AssessmentState | 'failed';
  statusLabel: string;
  tone: StatusTone;
  reason: string;
  rateLabel: string | null;
  baseLabel: string | null;
}

/**
 * Assessments the backend reports but did not calculate.
 *
 * The API returns calculated charge lines in `charges`; the duty and tax
 * assessment objects state why anything else was left unresolved. These rows
 * never carry an amount.
 */
export function unresolvedAssessments(result: ImportCostResult): UnresolvedAssessment[] {
  const rows: UnresolvedAssessment[] = [];
  const tariffRate = result.tariff?.resolvedRate ?? result.tariff?.originalRate ?? null;

  if (result.duty.state !== 'calculated') {
    rows.push({
      key: 'assessment-duty',
      name: 'Customs duty',
      status: result.duty.state,
      statusLabel: assessmentLabel(result.duty.state),
      tone: assessmentTone(result.duty.state),
      reason: reasonText(result.duty.reason) || 'The backend did not calculate a customs duty.',
      rateLabel: tariffRate ? `Tariff rate ${tariffRate} (source text)` : null,
      baseLabel: null,
    });
  }

  if (result.tax.state !== 'calculated') {
    rows.push({
      key: 'assessment-tax',
      name: 'Taxes and levies',
      status: result.tax.state,
      statusLabel: assessmentLabel(result.tax.state),
      tone: assessmentTone(result.tax.state),
      reason: reasonText(result.tax.reason) || 'The backend did not calculate tax or levy charges.',
      rateLabel: null,
      baseLabel: null,
    });
  }

  if (rows.length === 0 && result.state === 'failed') {
    rows.push({
      key: 'assessment-failed',
      name: 'Calculation',
      status: 'failed',
      statusLabel: assessmentLabel('failed'),
      tone: assessmentTone('failed'),
      reason: 'The backend reported a failed state and returned no usable charge values.',
      rateLabel: null,
      baseLabel: null,
    });
  }

  return rows;
}

export function hasFinalTotals(result: ImportCostResult): boolean {
  return isFinalState(result.state) && result.totals !== null;
}

/** Reasons why the backend did not return final totals, in plain language. */
export function totalsUnavailableReasons(result: ImportCostResult): string[] {
  if (hasFinalTotals(result)) return [];

  const reasons: string[] = [];

  if (result.state === 'failed') {
    reasons.push(
      'The backend reported a failed calculation state, so no duty, levy, VAT or landed-cost total can be relied on.',
    );
  }

  if (result.state === 'unsupported') {
    reasons.push(
      'No verified Tanzanian tax or levy rules are registered for this request, so the backend did not calculate charges.',
    );
  }

  if (result.valuation.reason) {
    reasons.push(`Customs valuation: ${reasonText(result.valuation.reason)}`);
  }

  if (result.duty.state !== 'calculated' && result.duty.reason) {
    reasons.push(`Customs duty: ${reasonText(result.duty.reason)}`);
  }

  if (result.tax.state !== 'calculated' && result.tax.reason) {
    reasons.push(`Taxes and levies: ${reasonText(result.tax.reason)}`);
  }

  if (result.state === 'needs_review' && reasons.length === 0) {
    reasons.push(
      'The backend returned a review state without finalising every charge, so no total is available.',
    );
  }

  if (isFinalState(result.state) && result.totals === null) {
    reasons.push('The backend did not include a totals object in this response.');
  }

  return [...new Set(reasons)];
}

export function allWarnings(result: ImportCostResult): string[] {
  return [
    ...new Set([
      ...result.warnings,
      ...result.valuation.warnings,
      ...result.duty.warnings,
      ...result.tax.warnings,
    ]),
  ];
}

const MISSING_INFORMATION: Record<string, string> = {
  EXCHANGE_RATE_UNAVAILABLE:
    'A verified exchange rate for the submitted currency on the simulation date.',
  VALUATION_RULE_UNVERIFIED:
    'A verified customs-valuation rule stating the legal basis and which costs are includable.',
  CUSTOMS_VALUATION_RULE_UNVERIFIED:
    'A verified customs-valuation rule stating the legal basis and which costs are includable.',
  NO_TAX_RULES: 'Verified Tanzanian tax and levy rules for this destination and date.',
  TAX_RULE_NOT_VERIFIED: 'Verification of one or more registered tax rules that are not yet marked verified.',
  NO_EFFECTIVE_TAX_RULE: 'A rule version that is effective on the simulation date.',
  MISSING_APPLICABILITY_INPUT:
    'An input a rule depends on, such as the quantity or the country of origin.',
  MISSING_CALCULATION_INPUT: 'A calculation base for at least one applicable rule.',
  UNSUPPORTED_RATE_TYPE: 'A verified interpretation of a rate expression the backend cannot evaluate yet.',
  UNSUPPORTED_APPLICABILITY_CONDITION: 'A verified interpretation of a rule applicability condition.',
  INVALID_MONETARY_INPUT: 'Valid, non-negative monetary values.',
  INVALID_CURRENCY: 'A three-letter ISO currency code.',
  APPLICABILITY_UNIT_MISMATCH: 'A quantity expressed in the unit a rule requires.',
  APPLICABILITY_ORIGIN_NOT_ALLOWED: 'A country of origin that meets the rule conditions.',
  APPLICABILITY_PREFERENTIAL_REQUIRED: 'A preferential-treatment request that meets the rule conditions.',
  INVALID_QUANTITY: 'A valid quantity for the applicable rule.',
  HS_CODE_AMBIGUOUS: 'An explicit choice between the tariff records that share this HS code.',
  NO_APPLICABLE_CHARGES: 'At least one applicable, verified charge.',
  DEPENDENCY_VALIDATION_FAILED: 'A consistent set of rule dependencies.',
};

/** Information the backend still needs, derived from its own warning codes. */
export function missingInformationItems(result: ImportCostResult): string[] {
  if (hasFinalTotals(result)) return [];

  const codes = allWarnings(result)
    .map((warning) => splitReason(warning).code)
    .filter((code): code is string => Boolean(code));

  const items = codes
    .map((code) => MISSING_INFORMATION[code])
    .filter((item): item is string => Boolean(item));

  if (items.length === 0) {
    items.push('Verified legal and financial rules for this request.');
  }

  return [...new Set(items)];
}

const SUBMITTED_FIELD: Record<string, 'invoiceValue' | 'freight' | 'insurance' | 'otherCosts'> = {
  INVOICE_VALUE: 'invoiceValue',
  FREIGHT: 'freight',
  INSURANCE: 'insurance',
  OTHER_COSTS: 'otherCosts',
};

/** The value the user submitted for a valuation component, in the request currency. */
export function submittedComponentValue(
  result: ImportCostResult,
  component: ValuationComponent,
): { value: string | number | null; currency: string } {
  const field = SUBMITTED_FIELD[component.code];
  const currency = (result.inputs.currency || '').toUpperCase();

  if (!field) return { value: null, currency };

  if (field === 'invoiceValue') {
    return { value: result.inputs.customsValue ?? result.inputs.invoiceValue ?? null, currency };
  }

  return { value: result.inputs[field] ?? null, currency };
}

export function componentIncludedLabel(component: ValuationComponent): string {
  return component.included ? 'Included' : 'Not included';
}

export function tariffRateLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : 'Not recorded';
}
