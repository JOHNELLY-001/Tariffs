import type { RateAnalysis } from './rate-parser.service.js';
import { listVerifiedRules, type VerifiedRule } from './rules-registry.js';

/**
 * Duty computation boundary.
 *
 * No duty is computed in this release. The service reports the verified rules
 * that could apply — currently none — and otherwise returns `unsupported`.
 */

export interface DutyInput {
  rateAnalysis: RateAnalysis;
  customsValue: number | null;
  quantity?: number;
  currency: string;
}

export interface DutyLine {
  ruleId: string;
  description: string;
  amount: number;
  currency: string;
  legalSource: string;
  effectiveFrom: string;
}

export interface DutyResult {
  state: 'calculated' | 'unsupported' | 'needs_review';
  lines: DutyLine[];
  appliedRuleIds: string[];
  reason: string | null;
  warnings: string[];
}

function candidateRules(rateKind: RateAnalysis['kind']): VerifiedRule[] {
  return listVerifiedRules().filter((rule) => rule.kind === 'duty' && rule.appliesToRateKinds.includes(rateKind));
}

export function evaluateDuty(input: DutyInput): DutyResult {
  const candidates = candidateRules(input.rateAnalysis.kind);

  if (candidates.length === 0) {
    return {
      state: 'unsupported',
      lines: [],
      appliedRuleIds: [],
      reason:
        input.rateAnalysis.kind === 'sensitive_item'
          ? 'The source rate refers to Sensitive Items treatment; the applicable schedule entry has not been verified.'
          : 'No verified duty rule is registered for this rate form.',
      warnings: input.rateAnalysis.warnings,
    };
  }

  // Rules exist but the computation itself is deliberately unimplemented: a
  // future phase must supply verified bases, sequences and effective dates.
  return {
    state: 'needs_review',
    lines: [],
    appliedRuleIds: candidates.map((rule) => rule.id),
    reason: 'Candidate rules exist but evaluation is not enabled in this release.',
    warnings: input.rateAnalysis.warnings,
  };
}
