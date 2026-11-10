/** Chapter and section code normalization (comparison only, never persisted). */

/** Two-digit chapter prefix. `1` and `01` address the same chapter. */
export function normalizeChapterCode(input: string): string {
  const trimmed = input.trim();
  if (/^\d{1,2}$/.test(trimmed)) return trimmed.padStart(2, '0');
  return trimmed;
}

/** Section codes are stored as short labels (for example roman numerals). */
export function normalizeSectionCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isChapterCode(input: string): boolean {
  return /^\d{2}$/.test(normalizeChapterCode(input));
}
