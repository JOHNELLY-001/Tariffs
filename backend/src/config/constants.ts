/**
 * Fixed application constants.
 *
 * Values that are part of the API contract live here so that routes,
 * validation schemas and documentation cannot drift apart.
 */

export const API_VERSION = 'v1';

export const DEFAULT_API_BASE_PATH = '/api/v1';

export const PAGINATION = {
  /** Default number of records returned by list/search endpoints. */
  defaultPageSize: 20,
  /** Hard upper bound. Never allow unbounded result sets. */
  maxPageSize: 100,
  defaultPage: 1,
} as const;

export const HS_CODE = {
  /** A tariff code must contain at least a chapter prefix (2 digits). */
  minDigits: 2,
  /** Longest plausible HS/CET tariff line (10 digit national lines). */
  maxDigits: 12,
  chapterDigits: 2,
} as const;

export const SEARCH = {
  minQueryLength: 2,
  maxQueryLength: 120,
  /**
   * Maximum rows considered for a single search page. The hard page-size cap
   * already bounds this; kept explicit so the repository takes a named limit.
   */
  maxMatchesPerRequest: 100,
} as const;

export const TARIFF_LOOKUP = {
  /** Bound on records returned when one HS code matches several schedules. */
  maxMatchesPerCode: 20,
} as const;

export const REQUEST = {
  /** Header accepted for caller-supplied correlation, when well-formed. */
  idHeader: 'x-request-id',
  maxRequestIdLength: 128,
} as const;

export const CALCULATION_STATES = [
  'calculated',
  'completed',
  'partially_calculated',
  'unsupported',
  'needs_review',
] as const;

export const RATE_KINDS = [
  'percentage',
  'specific',
  'compound',
  'sensitive_item',
  'free',
  'unknown',
] as const;

export const MATCH_TYPES = ['exact_code', 'code_prefix', 'description'] as const;

export type CalculationState = (typeof CALCULATION_STATES)[number];
export type RateKind = (typeof RATE_KINDS)[number];
export type MatchType = (typeof MATCH_TYPES)[number];
