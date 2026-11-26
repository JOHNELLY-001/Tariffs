import { describe, expect, it } from 'vitest';
import { Decimal } from '../../src/modules/calculations/utils/decimal.utils.js';

describe('Decimal arithmetic', () => {
  it('parses and compares decimals', () => {
    const a = Decimal.parse('10.50');
    const b = Decimal.parse('10.5');
    expect(a.equals(b)).toBe(true);
    expect(a.cmp(Decimal.parse('10.49'))).toBe(1);
  });

  it('adds exactly', () => {
    const result = Decimal.parse('0.1').add(Decimal.parse('0.2'));
    expect(result.equals(Decimal.parse('0.3'))).toBe(true);
  });

  it('subtracts exactly', () => {
    const result = Decimal.parse('1.00').sub(Decimal.parse('0.33'));
    expect(result.equals(Decimal.parse('0.67'))).toBe(true);
  });

  it('multiplies exactly', () => {
    const result = Decimal.parse('12.34').mul(Decimal.parse('2'));
    expect(result.equals(Decimal.parse('24.68'))).toBe(true);
  });

  it('divides with high precision', () => {
    const result = Decimal.parse('1').div(Decimal.parse('3'));
    // 1/3 * 3 should round-trip to 1
    const back = result.mul(Decimal.parse('3'));
    expect(back.equals(Decimal.parse('1'))).toBe(true);
  });

  it('rejects invalid input', () => {
    expect(() => Decimal.parse('abc')).toThrow();
    expect(() => Decimal.parse('')).toThrow();
  });

  it('rejects division by zero', () => {
    expect(() => Decimal.parse('1').div(Decimal.parse('0'))).toThrow();
  });

  it('preserves leading zeros in string inputs via numeric value', () => {
    const result = Decimal.parse('0.0042');
    expect(result.equals(Decimal.parse('.0042'))).toBe(true);
  });
});