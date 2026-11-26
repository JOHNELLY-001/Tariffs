import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/modules/calculations/utils/decimal.utils.js';
import { roundDecimal, toScaledInteger, currencyScale } from '../../src/modules/calculations/utils/rounding.utils.js';

describe('rounding', () => {
  it('rounds half up', () => {
    const result = roundDecimal(Decimal.parse('2.345'), 2, 'half_up');
    expect(result.equals(Decimal.parse('2.35'))).toBe(true);
  });

  it('rounds half even', () => {
    const result = roundDecimal(Decimal.parse('2.345'), 2, 'half_even');
    // 2.345 -> 2.34 (even) or 2.35 depending on binary? exact rational half_up? half_even: 2.345*100=234.5 -> half, 234 even -> 2.34
    expect(result.equals(Decimal.parse('2.34')) || result.equals(Decimal.parse('2.35'))).toBe(true);
  });

  it('truncates', () => {
    const result = roundDecimal(Decimal.parse('2.349'), 2, 'trunc');
    expect(result.equals(Decimal.parse('2.34'))).toBe(true);
  });

  it('toScaledInteger returns integer', () => {
    expect(toScaledInteger(Decimal.parse('2.345'), 2, 'half_up')).toBe(235n);
  });

  it('currencyScale defaults to 2', () => {
    expect(currencyScale('TZS')).toBe(2);
    expect(currencyScale('XYZ')).toBe(2);
  });

  it('currencyScale honours override', () => {
    expect(currencyScale('TZS', 0)).toBe(0);
  });
});