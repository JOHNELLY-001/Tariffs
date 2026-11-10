import { listVerifiedRules } from './rules-registry.js';

/**
 * Tax and levy boundary.
 *
 * VAT, excise, levies and other charges are NOT computed. Their bases,
 * sequences and effective dates require legal verification that this release
 * does not perform.
 */

export interface TaxInput {
  customsValue: number | null;
  dutyAmount: number | null;
  currency: string;
  includeVat?: boolean;
}

export interface TaxLine {
  ruleId: string;
  description: string;
  amount: number;
  currency: string;
  legalSource: string;
  effectiveFrom: string;
}

export interface TaxResult {
  state: 'calculated' | 'unsupported';
  lines: TaxLine[];
  appliedRuleIds: string[];
  reason: string | null;
  warnings: string[];
}

export function evaluateTaxes(input: TaxInput): TaxResult {
  const candidates = listVerifiedRules().filter((rule) => rule.kind === 'tax' || rule.kind === 'levy');

  return {
    state: 'unsupported',
    lines: [],
    appliedRuleIds: candidates.map((rule) => rule.id),
    reason:
      'Tax and levy rules (VAT, excise, levies) are not verified for this release, so no amount is calculated.',
    warnings: input.includeVat ? ['VAT_REQUESTED_BUT_UNSUPPORTED'] : [],
  };
}
