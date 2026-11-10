import { describe, expect, it } from 'vitest';
import { analyzeRate } from '../../src/modules/calculations/rate-parser.service.js';

describe('analyzeRate', () => {
  it('treats SI as a Sensitive Items reference, never a number', () => {
    const result = analyzeRate('SI');
    expect(result.kind).toBe('sensitive_item');
    expect(result.isSensitiveItem).toBe(true);
    expect(result.components).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/SENSITIVE_ITEM/);
    expect(result.raw).toBe('SI');
  });

  it('recognizes SI with punctuation variants', () => {
    expect(analyzeRate('S.I.').kind).toBe('sensitive_item');
    expect(analyzeRate('s i').kind).toBe('sensitive_item');
  });

  it('classifies a plain percentage', () => {
    const result = analyzeRate('25%');
    expect(result.kind).toBe('percentage');
    expect(result.components[0]).toMatchObject({ kind: 'percentage', amount: 25, unit: '%' });
    expect(result.warnings).toHaveLength(0);
  });

  it('classifies ad valorem percentages', () => {
    expect(analyzeRate('10% ad valorem').kind).toBe('percentage');
    expect(analyzeRate('ad valorem 10%').kind).toBe('percentage');
  });

  it('classifies specific rates with currency and unit', () => {
    const result = analyzeRate('USD 0.35/kg');
    expect(result.kind).toBe('specific');
    expect(result.components[0]).toMatchObject({ amount: 0.35, currency: 'USD', unit: 'kg' });
  });

  it('accepts "per" notation and captures an unstated currency', () => {
    const result = analyzeRate('0.35 per kg');
    expect(result.kind).toBe('specific');
    expect(result.components[0]?.currency).toBeNull();
    expect(result.warnings).toContain('SPECIFIC_RATE_CURRENCY_NOT_STATED');
  });

  it('never states a unit it was not given', () => {
    const result = analyzeRate('USD 200');
    expect(result.kind).toBe('specific');
    expect(result.components[0]?.unit).toBeNull();
    expect(result.warnings).toContain('SPECIFIC_RATE_UNIT_NOT_STATED');
  });

  it('classifies a compound expression without asserting or/and semantics', () => {
    const result = analyzeRate('35% or USD 0.5/kg');
    expect(result.kind).toBe('compound');
    expect(result.components).toHaveLength(2);
    expect(result.warnings.join(' ')).toMatch(/COMPOUND_RATE_RELATIONSHIP_UNVERIFIED/);
    expect(result.raw).toBe('35% or USD 0.5/kg');
  });

  it('classifies FREE and zero-percent variants as free', () => {
    expect(analyzeRate('FREE').kind).toBe('free');
    expect(analyzeRate('free').kind).toBe('free');
    expect(analyzeRate('0%').kind).toBe('free');
  });

  it('returns unknown for missing rates instead of assuming zero', () => {
    const result = analyzeRate(null);
    expect(result.kind).toBe('unknown');
    expect(result.warnings).toContain('RATE_MISSING');
    expect(result.raw).toBeNull();
  });

  it('returns unknown for unrecognised source text without inventing a value', () => {
    const result = analyzeRate('As per customs directive');
    expect(result.kind).toBe('unknown');
    expect(result.classifiedFromSource).toBe(false);
    expect(result.components).toHaveLength(0);
  });

  it('does not mutate or reformat the original string', () => {
    const raw = '  35%  or  USD 0.5 / kg ';
    const result = analyzeRate(raw);
    expect(result.raw).toBe(raw);
    expect(result.kind).toBe('compound');
  });
});
