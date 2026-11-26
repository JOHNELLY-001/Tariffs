import { describe, expect, it, beforeEach } from 'vitest';
import {
  registerTaxRule,
  resetTaxRuleRegistry,
  selectVerifiedTaxRule,
  selectTaxRule,
  validateDependencies,
  type TaxRule,
} from '../../src/modules/calculations/tax-rule.service.js';

function makeRule(overrides: Partial<TaxRule> = {}): TaxRule {
  return {
    id: 'r1',
    ruleCode: 'TZ_TEST',
    ruleScope: 'test_scope',
    jurisdiction: 'TZ_MAINLAND',
    taxName: 'Test Tax',
    taxType: 'levy',
    rateType: 'ad_valorem',
    rateValue: '2',
    rateExpression: '2%',
    calculationBase: 'customs_value',
    calculationOrder: 1,
    applicabilityConditions: null,
    exemptionConditions: null,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    sourceTitle: 'Test Source',
    sourceUrl: null,
    sourceProvision: 'Section 1',
    verificationStatus: 'VERIFIED',
    dependencies: [],
    supersedesRuleId: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('tax-rule service', () => {
  beforeEach(() => resetTaxRuleRegistry());

  it('selects verified rule for a date', () => {
    registerTaxRule(makeRule());
    const rule = selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-06-01');
    expect(rule?.id).toBe('r1');
  });

  it('does not select future rules', () => {
    registerTaxRule(makeRule({ effectiveFrom: '2027-01-01' }));
    const rule = selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-06-01');
    expect(rule).toBeNull();
  });

  it('does not select expired rules', () => {
    registerTaxRule(makeRule({ effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31' }));
    const rule = selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-06-01');
    expect(rule).toBeNull();
  });

  it('does not select unverified rules for production', () => {
    registerTaxRule(makeRule({ verificationStatus: 'UNVERIFIED' }));
    const rule = selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-06-01');
    expect(rule).toBeNull();
    // admin review can include them
    const review = selectTaxRule({ ruleScope: 'test_scope', jurisdiction: 'TZ_MAINLAND', simulationDate: '2026-06-01', allowUnverified: true });
    expect(review?.id).toBe('r1');
  });

  it('rejects overlapping periods', () => {
    registerTaxRule(makeRule());
    expect(() => registerTaxRule(makeRule({ id: 'r2', effectiveFrom: '2026-03-01' }))).toThrow(/Overlapping/);
  });

  it('rejects invalid effective range', () => {
    expect(() => registerTaxRule(makeRule({ effectiveTo: '2025-01-01' }))).toThrow(/effectiveTo/);
  });

  it('rejects missing dependency', () => {
    registerTaxRule(makeRule({ dependencies: ['missing'] }));
    expect(() => validateDependencies()).toThrow(/Missing dependency/);
  });

  it('rejects circular dependency', () => {
    registerTaxRule(makeRule({ id: 'a', dependencies: ['b'], calculationOrder: 2 }));
    registerTaxRule(makeRule({ id: 'b', ruleScope: 'other_scope', dependencies: ['a'], calculationOrder: 1, effectiveFrom: '2026-02-01' }));
    expect(() => validateDependencies()).toThrow(/Circular/);
  });

  it('rejects invalid calculation order', () => {
    registerTaxRule(makeRule({ id: 'a', dependencies: ['b'], calculationOrder: 1 }));
    registerTaxRule(makeRule({ id: 'b', ruleScope: 'other_scope', calculationOrder: 2, effectiveFrom: '2026-02-01' }));
    expect(() => validateDependencies()).toThrow(/Invalid calculation order/);
  });

  it('rejects unsupported calculation base', () => {
    expect(() => registerTaxRule(makeRule({ calculationBase: 'foo' as never }))).toThrow(/Unsupported calculation base/);
  });

  it('filters by jurisdiction', () => {
    registerTaxRule(makeRule());
    const rule = selectVerifiedTaxRule('test_scope', 'OTHER', '2026-06-01');
    expect(rule).toBeNull();
  });

  it('rejects invalid verification status at runtime', () => {
    expect(() => registerTaxRule(makeRule({ verificationStatus: 'BAD' as never }))).toThrow(/Invalid verification status/);
  });

  it('rejects invalid simulation dates', () => {
    registerTaxRule(makeRule());
    expect(() => selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-13-40')).toThrow(/Invalid date/);
    expect(() => selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-06-01T00:00:00Z')).toThrow(/Invalid date/);
  });

  it('accepts valid date boundaries inclusively', () => {
    registerTaxRule(makeRule({ effectiveFrom: '2026-06-01', effectiveTo: '2026-06-01' }));
    expect(selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2026-06-01')?.id).toBe('r1');
  });

  it('accepts consecutive non-overlapping periods', () => {
    registerTaxRule(makeRule({ id: 'r1', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30' }));
    expect(() => registerTaxRule(makeRule({ id: 'r2', effectiveFrom: '2026-07-01', effectiveTo: null }))).not.toThrow();
  });

  it('accepts open-ended periods', () => {
    registerTaxRule(makeRule({ effectiveTo: null }));
    expect(selectVerifiedTaxRule('test_scope', 'TZ_MAINLAND', '2099-01-01')?.id).toBe('r1');
  });
});