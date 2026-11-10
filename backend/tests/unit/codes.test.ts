import { describe, expect, it } from 'vitest';
import { isChapterCode, normalizeChapterCode, normalizeSectionCode } from '../../src/shared/utils/codes.js';

describe('chapter code normalization', () => {
  it('pads single digits', () => {
    expect(normalizeChapterCode('1')).toBe('01');
    expect(normalizeChapterCode('01')).toBe('01');
    expect(normalizeChapterCode(' 85 ')).toBe('85');
  });

  it('leaves non-numeric values untouched for validation to reject', () => {
    expect(normalizeChapterCode('AB')).toBe('AB');
    expect(isChapterCode('AB')).toBe(false);
    expect(isChapterCode('7')).toBe(true);
  });
});

describe('section code normalization', () => {
  it('uppercases and trims', () => {
    expect(normalizeSectionCode(' i ')).toBe('I');
    expect(normalizeSectionCode('xvi')).toBe('XVI');
  });
});
