import { describe, expect, it } from 'vitest';
import { listVerifiedRules, registerVerifiedRule } from '../../src/modules/calculations/rules-registry.js';
import { evaluateDuty } from '../../src/modules/calculations/duty.service.js';
import { evaluateTaxes } from '../../src/modules/calculations/tax.service.js';
import { valuate } from '../../src/modules/calculations/valuation.service.js';
import { analyzeRate } from '../../src/modules/calculations/rate-parser.service.js';

describe('verified rules registry', () => {
  it('is empty in this release', () => {
    expect(listVerifiedRules()).toEqual([]);
  });

  it('rejects a rule without a legal source or effective date', () => {
    expect(() =>
      registerVerifiedRule({
        id: 'x',
        kind: 'duty',
        description: 'test',
        legalSource: '',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        appliesToRateKinds: ['percentage'],
      }),
    ).toThrow(/legal source/i);
  });
});

describe('calculation stages never invent amounts', () => {
  it('returns needs_review valuation without a verified rule', async () => {
    const result = await valuate({ invoiceValue: 1000, currency: 'KES' });
    expect(result.state).toBe('needs_review');
    expect(result.customsValue).toBeNull();
    expect(result.components.length).toBeGreaterThan(0);
  });

  it('returns unsupported duty for a percentage rate', () => {
    const result = evaluateDuty({
      rateAnalysis: analyzeRate('25%'),
      customsValue: null,
      currency: 'KES',
    });
    expect(result.state).toBe('unsupported');
    expect(result.lines).toEqual([]);
  });

  it('explains Sensitive Items treatment instead of computing it', () => {
    const result = evaluateDuty({
      rateAnalysis: analyzeRate('SI'),
      customsValue: null,
      currency: 'KES',
    });
    expect(result.state).toBe('unsupported');
    expect(result.reason).toMatch(/Sensitive Items/i);
  });

  it('returns unsupported taxes even when VAT is requested', () => {
    const result = evaluateTaxes({ customsValue: null, dutyAmount: null, currency: 'KES', includeVat: true });
    expect(result.state).toBe('unsupported');
    expect(result.lines).toEqual([]);
    expect(result.warnings).toContain('VAT_REQUESTED_BUT_UNSUPPORTED');
  });
});
