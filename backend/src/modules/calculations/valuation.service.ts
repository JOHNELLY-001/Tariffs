/**
 * Customs valuation boundary.
 *
 * Defines the input contract only. Customs value, freight, insurance and
 * adjustments are NOT computed: the applicable valuation method has not been
 * legally verified for this release.
 */

export interface ValuationInput {
  customsValue: number;
  currency: string;
  quantity?: number;
  unit?: string;
  originCountry?: string;
}

export interface ValuationResult {
  state: 'calculated' | 'unsupported';
  /** Amount treated as the customs value. Present only when verified. */
  customsValue: number | null;
  currency: string;
  adjustments: Array<{ code: string; description: string; amount: number; source: string }>;
  ruleId: string | null;
  reason: string | null;
  warnings: string[];
}

export function valuate(input: ValuationInput): ValuationResult {
  return {
    state: 'unsupported',
    customsValue: null,
    currency: input.currency,
    adjustments: [],
    ruleId: null,
    reason:
      'Customs valuation rules are not verified for this release. The supplied amount is recorded as declared value only.',
    warnings: ['DECLARED_VALUE_NOT_VALIDATED'],
  };
}
