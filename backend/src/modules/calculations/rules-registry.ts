import type { RateKind } from '../../config/constants.js';

/**
 * Verified calculation rules.
 *
 * The registry is intentionally EMPTY. A rule may only be added once its tax
 * base, rate type, sequence, effective dates and legal source have been
 * verified. Nothing in this release may compute a duty, levy or tax.
 */

export type RuleKind = 'valuation' | 'duty' | 'tax' | 'levy';

export interface VerifiedRule {
  id: string;
  kind: RuleKind;
  description: string;
  /** Legal instrument or schedule reference that authorises the rule. */
  legalSource: string;
  /** ISO date the rule takes effect. */
  effectiveFrom: string;
  /** ISO date the rule ceases to apply, or null when open-ended. */
  effectiveTo: string | null;
  /** Rate kinds the rule can evaluate. */
  appliesToRateKinds: RateKind[];
}

const rules = new Map<string, VerifiedRule>();

export function getRule(id: string): VerifiedRule | null {
  return rules.get(id) ?? null;
}

export function listVerifiedRules(): VerifiedRule[] {
  return [...rules.values()];
}

/**
 * Register a verified rule. Kept as the extension point for a later phase;
 * no rule is registered in this release, so every calculation is unsupported.
 */
export function registerVerifiedRule(rule: VerifiedRule): void {
  if (!rule.legalSource || !rule.effectiveFrom) {
    throw new Error('A verified rule must reference a legal source and an effective date');
  }
  if (rules.has(rule.id)) {
    throw new Error(`Rule ${rule.id} is already registered`);
  }
  rules.set(rule.id, rule);
}
