import { describe, expect, it } from 'vitest';
import {
  chapterFromStoredCode,
  normalizeHsCode,
} from '../../src/shared/utils/hs-code.js';

describe('normalizeHsCode', () => {
  it('normalizes dotted CET codes to digits only', () => {
    const result = normalizeHsCode('0101.21.00.00');
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe('0101210000');
    expect(result.chapter).toBe('01');
    expect(result.raw).toBe('0101.21.00.00');
  });

  it('removes spaces, hyphens and slashes', () => {
    expect(normalizeHsCode(' 0101 21 / 00 ').normalized).toBe('01012100');
    expect(normalizeHsCode('09-01-21').normalized).toBe('090121');
  });

  it('preserves the caller input in raw without modifying it', () => {
    const result = normalizeHsCode(' 8517.13 ');
    expect(result.raw).toBe('8517.13');
    expect(result.normalized).toBe('851713');
  });

  it('derives the chapter from the first two digits', () => {
    expect(normalizeHsCode('8517.13.00').chapter).toBe('85');
    expect(normalizeHsCode('2').chapter).toBeNull();
  });

  it('rejects empty input', () => {
    const result = normalizeHsCode('   ');
    expect(result.isValid).toBe(false);
    expect(result.issue).toBe('EMPTY');
  });

  it('rejects letters and other characters', () => {
    const result = normalizeHsCode('ABC123');
    expect(result.isValid).toBe(false);
    expect(result.issue).toBe('INVALID_CHARACTERS');
  });

  it('rejects codes that are too short', () => {
    const result = normalizeHsCode('7');
    expect(result.isValid).toBe(false);
    expect(result.issue).toBe('TOO_SHORT');
  });

  it('rejects codes that are too long', () => {
    const result = normalizeHsCode('1234567890123');
    expect(result.isValid).toBe(false);
    expect(result.issue).toBe('TOO_LONG');
  });
});

describe('chapterFromStoredCode', () => {
  it('returns the two-digit chapter of a stored code', () => {
    expect(chapterFromStoredCode('8517.62.00.00')).toBe('85');
  });

  it('returns null for null, empty or single-digit values', () => {
    expect(chapterFromStoredCode(null)).toBeNull();
    expect(chapterFromStoredCode('')).toBeNull();
    expect(chapterFromStoredCode('7')).toBeNull();
  });
});
