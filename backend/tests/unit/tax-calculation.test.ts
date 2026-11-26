import { describe, expect, it } from 'vitest';
import { calculateTaxCharges } from '../../src/modules/calculations/services/tax-calculation.service.js';
import { type TaxRule } from '../../src/modules/calculations/tax-rule.service.js';

function rule(overrides: Partial<TaxRule>): TaxRule {
  return {
    id: 'r1',
    ruleCode: 'CUSTOMS_DUTY',
    ruleScope: 'customs_duty',
    jurisdiction: 'TZ_MAINLAND',
    taxName: 'Customs Duty',
    taxType: 'duty',
    rateType: 'ad_valorem',
    rateValue: '10',
    rateExpression: '10%',
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

describe('tax calculation engine', () => {
  it('calculates ad valorem duty', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [rule({})],
    });
    expect(result.status).toBe('calculated');
    expect(result.charges[0]?.amount).toBe('100');
    expect(result.totalCharges).toBe('100');
  });

  it('calculates specific duty', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '50', unit: 'KG' },
      currency: 'TZS',
      rules: [rule({ rateType: 'specific', rateValue: '2', calculationBase: 'quantity', ruleCode: 'EXCISE', taxName: 'Excise', taxType: 'excise' })],
    });
    expect(result.status).toBe('calculated');
    expect(result.charges[0]?.amount).toBe('100');
  });

  it('calculates compound duty', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '10', unit: 'KG' },
      currency: 'TZS',
      rules: [rule({ rateType: 'compound', rateValue: null, rateExpression: '10% + 2', calculationBase: 'customs_value' })],
    });
    expect(result.status).toBe('calculated');
    // 1000*10/100 + 10*2 = 100 + 20 = 120
    expect(result.charges[0]?.amount).toBe('120');
  });

  it('calculates free duty as zero', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [rule({ rateType: 'free', rateValue: null, rateExpression: null })],
    });
    expect(result.status).toBe('calculated');
    expect(result.charges[0]?.amount).toBe('0');
  });

  it('returns needs_review for missing quantity on specific duty', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [rule({ rateType: 'specific', rateValue: '2', calculationBase: 'quantity' })],
    });
    expect(result.status).toBe('needs_review');
    expect(result.totalCharges).toBeNull();
  });

  it('returns needs_review for unsupported rate expression', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [rule({ rateType: 'compound', rateValue: null, rateExpression: '10% or 2' })],
    });
    expect(result.status).toBe('needs_review');
  });

  it('returns needs_review when a rule is unverified', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [rule({ verificationStatus: 'UNVERIFIED' })],
    });
    expect(result.status).toBe('needs_review');
    expect(result.charges).toHaveLength(0);
  });

  it('handles multiple dependent charges (VAT on cumulative base)', () => {
    const duty = rule({ id: 'duty', ruleCode: 'CUSTOMS_DUTY', calculationOrder: 1 });
    const vat = rule({
      id: 'vat',
      ruleCode: 'VAT',
      taxName: 'VAT',
      taxType: 'vat',
      rateType: 'ad_valorem',
      rateValue: '18',
      rateExpression: '18%',
      calculationBase: 'vat_base',
      calculationOrder: 2,
      dependencies: ['duty'],
    });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [duty, vat],
    });
    expect(result.status).toBe('calculated');
    // duty 100, vat base 1100, vat 198
    expect(result.charges[1]?.amount).toBe('198');
    expect(result.totalCharges).toBe('298');
  });

  it('returns unsupported when no rules provided', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [],
    });
    expect(result.status).toBe('unsupported');
  });

  it('handles boundary effective dates', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-01-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [rule({ effectiveFrom: '2026-01-01', effectiveTo: '2026-01-01' })],
    });
    expect(result.status).toBe('calculated');
  });

  it('VAT base includes only declared dependencies', () => {
    const duty = rule({ id: 'duty', ruleCode: 'CUSTOMS_DUTY', calculationOrder: 1 });
    const unrelated = rule({ id: 'excise', ruleCode: 'EXCISE', taxName: 'Excise', taxType: 'excise', rateValue: '5', calculationOrder: 2 });
    const vat = rule({ id: 'vat', ruleCode: 'VAT', taxName: 'VAT', taxType: 'vat', rateValue: '10', calculationBase: 'vat_base', calculationOrder: 3, dependencies: ['duty'] });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [duty, unrelated, vat],
    });
    // duty 100, unrelated 50, vat base should be 1000+100=1100 (not 1150)
    const vatCharge = result.charges.find((c) => c.code === 'VAT');
    expect(vatCharge?.taxableBase).toBe('1100');
  });

  it('VAT base excludes unrelated charges', () => {
    const duty = rule({ id: 'duty', ruleCode: 'CUSTOMS_DUTY', calculationOrder: 1 });
    const vat = rule({ id: 'vat', ruleCode: 'VAT', taxName: 'VAT', taxType: 'vat', rateValue: '10', calculationBase: 'vat_base', calculationOrder: 2, dependencies: ['duty'] });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [duty, vat],
    });
    const vatCharge = result.charges.find((c) => c.code === 'VAT');
    expect(vatCharge?.taxableBase).toBe('1100');
  });

  it('failed required dependency blocks dependent VAT', () => {
    const duty = rule({ id: 'duty', ruleCode: 'CUSTOMS_DUTY', verificationStatus: 'UNVERIFIED', calculationOrder: 1 });
    const vat = rule({ id: 'vat', ruleCode: 'VAT', taxName: 'VAT', taxType: 'vat', rateValue: '10', calculationBase: 'vat_base', calculationOrder: 2, dependencies: ['duty'] });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [duty, vat],
    });
    expect(result.charges.find((c) => c.code === 'VAT')).toBeUndefined();
    expect(result.status).toBe('needs_review');
  });

  it('unrelated failed charge does not block independent charges', () => {
    const bad = rule({ id: 'bad', ruleCode: 'BAD', rateType: 'compound', rateValue: null, rateExpression: '10% or 2', calculationOrder: 1 });
    const good = rule({ id: 'good', ruleCode: 'GOOD', calculationOrder: 2 });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [bad, good],
    });
    expect(result.charges.find((c) => c.code === 'GOOD')).toBeDefined();
  });

  it('multiple independent charges calculate correctly', () => {
    const a = rule({ id: 'a', ruleCode: 'A', calculationOrder: 1 });
    const b = rule({ id: 'b', ruleCode: 'B', calculationOrder: 2 });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [a, b],
    });
    expect(result.status).toBe('calculated');
    expect(result.totalCharges).toBe('200');
  });

  it('missing upstream amounts never become zero implicitly', () => {
    const vat = rule({ id: 'vat', ruleCode: 'VAT', taxName: 'VAT', taxType: 'vat', rateValue: '10', calculationBase: 'vat_base', calculationOrder: 1, dependencies: ['missing'] });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [vat],
    });
    expect(result.charges).toHaveLength(0);
  });

  it('missing applicability input returns needs_review', () => {
    const r = rule({ applicabilityConditions: { requiresQuantity: true } });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [r],
    });
    expect(result.status).toBe('needs_review');
    expect(result.warnings.join(' ')).toMatch(/MISSING_APPLICABILITY_INPUT/);
  });

  it('supported applicability conditions evaluate correctly', () => {
    const r = rule({ applicabilityConditions: { requiresQuantity: true }, calculationBase: 'quantity', rateType: 'specific', rateValue: '2' });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '5', unit: 'KG' },
      currency: 'TZS',
      rules: [r],
    });
    expect(result.status).toBe('calculated');
  });

  it('unsupported applicability conditions return needs_review', () => {
    const r = rule({ applicabilityConditions: { foo: true } });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      rules: [r],
    });
    expect(result.status).toBe('needs_review');
    expect(result.warnings.join(' ')).toMatch(/UNSUPPORTED_APPLICABILITY_CONDITION/);
  });

  it('missing exemption inputs do not silently exempt', () => {
    const r = rule({ exemptionConditions: { originCountries: ['KE'] } });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      currency: 'TZS',
      originCountry: null,
      rules: [r],
    });
    expect(result.charges).toHaveLength(1);
  });

  it('specific matching units calculate correctly', () => {
    const r = rule({ rateType: 'specific', rateValue: '2', calculationBase: 'quantity', applicabilityConditions: { requiredQuantityUnit: 'KG' } });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '5', unit: 'KG' },
      currency: 'TZS',
      rules: [r],
    });
    expect(result.status).toBe('calculated');
  });

  it('specific mismatched units return needs_review', () => {
    const r = rule({ rateType: 'specific', rateValue: '2', calculationBase: 'quantity', applicabilityConditions: { requiredQuantityUnit: 'KG' } });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '5', unit: 'LB' },
      currency: 'TZS',
      rules: [r],
    });
    expect(result.status).toBe('needs_review');
  });

  it('specific missing units return needs_review', () => {
    const r = rule({ rateType: 'specific', rateValue: '2', calculationBase: 'quantity' });
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '5', unit: '' },
      currency: 'TZS',
      rules: [r],
    });
    expect(result.status).toBe('needs_review');
  });

  it('negative customs value is rejected', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '-10',
      currency: 'TZS',
      rules: [rule({})],
    });
    expect(result.status).toBe('needs_review');
    expect(result.reason).toMatch(/INVALID_MONETARY_INPUT/);
  });

  it('zero values remain valid', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '0',
      currency: 'TZS',
      rules: [rule({})],
    });
    expect(result.status).toBe('calculated');
    expect(result.charges[0]?.amount).toBe('0');
  });

  it('malformed compound expressions are rejected', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '10', unit: 'KG' },
      currency: 'TZS',
      rules: [rule({ rateType: 'compound', rateValue: null, rateExpression: '10% or 2' })],
    });
    expect(result.status).toBe('needs_review');
  });

  it('compound missing units are rejected', () => {
    const result = calculateTaxCharges({
      jurisdiction: 'TZ_MAINLAND',
      simulationDate: '2026-06-01',
      customsValue: '1000',
      quantity: { value: '10', unit: '' },
      currency: 'TZS',
      rules: [rule({ rateType: 'compound', rateValue: null, rateExpression: '10% + 2' })],
    });
    expect(result.status).toBe('needs_review');
  });
});