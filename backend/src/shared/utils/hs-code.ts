import { HS_CODE } from '../../config/constants.js';

/**
 * HS-code normalization.
 *
 * Source codes are stored with inconsistent punctuation (dots, spaces,
 * slashes). Lookup normalizes only the *input* and the *comparison form*:
 * the stored `hs_code` value is never modified, and is always returned to the
 * client exactly as stored.
 */

export type HsCodeIssue =
  | 'EMPTY'
  | 'INVALID_CHARACTERS'
  | 'TOO_SHORT'
  | 'TOO_LONG';

export interface NormalizedHsCode {
  /** Trimmed input, or empty string. */
  readonly raw: string;
  /** Digits only, used for comparison. Empty when invalid. */
  readonly normalized: string;
  /** Two-digit chapter prefix when the code is valid, otherwise null. */
  readonly chapter: string | null;
  readonly isValid: boolean;
  readonly issue: HsCodeIssue | null;
}

/** Characters permitted in a user-supplied tariff code. */
const PERMITTED_CHARACTERS = /^[0-9.\s\-/]+$/;

export function normalizeHsCode(input: string): NormalizedHsCode {
  const raw = typeof input === 'string' ? input.trim() : '';

  if (raw === '') {
    return { raw, normalized: '', chapter: null, isValid: false, issue: 'EMPTY' };
  }

  if (!PERMITTED_CHARACTERS.test(raw)) {
    return { raw, normalized: '', chapter: null, isValid: false, issue: 'INVALID_CHARACTERS' };
  }

  const normalized = raw.replace(/\D/g, '');

  if (normalized.length < HS_CODE.minDigits) {
    return { raw, normalized: '', chapter: null, isValid: false, issue: 'TOO_SHORT' };
  }

  if (normalized.length > HS_CODE.maxDigits) {
    return { raw, normalized: '', chapter: null, isValid: false, issue: 'TOO_LONG' };
  }

  return {
    raw,
    normalized,
    chapter: normalized.slice(0, HS_CODE.chapterDigits),
    isValid: true,
    issue: null,
  };
}

/**
 * The SQL expression used to derive the chapter from a stored HS code.
 *
 * Kept in one place so repositories, the migration proposal and the audit
 * script all use an identical normalization rule.
 */
export const SQL_NORMALIZED_HS_CODE = "regexp_replace(hs_code, '[^0-9]', '', 'g')";
export const SQL_DERIVED_CHAPTER = `left(${SQL_NORMALIZED_HS_CODE}, 2)`;

/** Always safe: a chapter prefix is only meaningful when two digits exist. */
export function chapterFromStoredCode(hsCode: string | null): string | null {
  if (!hsCode) return null;
  const digits = hsCode.replace(/\D/g, '');
  return digits.length >= HS_CODE.chapterDigits ? digits.slice(0, HS_CODE.chapterDigits) : null;
}

/** Suggest a display form for documentation and logs; never used to persist. */
export function describeHsCodeIssue(issue: HsCodeIssue): string {
  switch (issue) {
    case 'EMPTY':
      return 'An HS code is required';
    case 'INVALID_CHARACTERS':
      return 'An HS code may contain only digits, dots, spaces, hyphens and slashes';
    case 'TOO_SHORT':
      return `An HS code must contain at least ${HS_CODE.minDigits} digits`;
    case 'TOO_LONG':
      return `An HS code must contain at most ${HS_CODE.maxDigits} digits`;
  }
}
