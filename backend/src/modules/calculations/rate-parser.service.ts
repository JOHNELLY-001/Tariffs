import type { RateKind } from '../../config/constants.js';

/**
 * Rate-string classifier.
 *
 * The CET schedule stores duty rates as source text: percentages, specific
 * amounts, compound expressions, `SI` (Sensitive Items) references, `FREE`,
 * and nulls. This service classifies that text conservatively and NEVER
 * converts it into a computed duty. The original string is always preserved in
 * `raw`.
 *
 * Anything not positively recognized is `unknown` — never guessed.
 */

export interface RateComponent {
  kind: 'percentage' | 'specific';
  /** Numeric magnitude as written. Not a computed duty. */
  amount: number | null;
  currency: string | null;
  unit: string | null;
  /** The exact fragment this component was read from. */
  text: string;
}

export interface RateAnalysis {
  raw: string | null;
  kind: RateKind;
  isSensitiveItem: boolean;
  components: RateComponent[];
  warnings: string[];
  /** True when the classification is based on an explicit source form. */
  classifiedFromSource: boolean;
}

const EMPTY_ANALYSIS: Omit<RateAnalysis, 'raw'> = {
  kind: 'unknown',
  isSensitiveItem: false,
  components: [],
  warnings: ['RATE_MISSING'],
  classifiedFromSource: false,
};

const SENSITIVE_ITEM_PATTERN = /^(s\.?\s?i\.?|sensitive\s+items?)$/i;
const FREE_PATTERN = /^(free|f\.?o\.?c\.?|nil|exempt|0(?:\.0+)?\s*%)$/i;
const PERCENTAGE_PATTERN = /^(\d+(?:\.\d+)?)\s*%\s*(?:ad\s+valorem)?$/i;
const AD_VALOREM_PATTERN = /^ad\s+valorem\s*(\d+(?:\.\d+)?)\s*%$/i;

const CURRENCY = '(?:[A-Z]{3})';
const UNIT = '[a-z][a-z0-9./ ]{0,20}';
const SPECIFIC_PATTERN = new RegExp(
  `^(?:(${CURRENCY})\\s*)?(\\d+(?:\\.\\d+)?)\\s*(?:(${CURRENCY})\\s*)?(?:\\/|per\\s+)\\s*(${UNIT})$`,
  'i',
);
const SPECIFIC_NO_UNIT_PATTERN = new RegExp(`^(?:(${CURRENCY})\\s*)?(\\d+(?:\\.\\d+)?)$`, 'i');

function normalizeText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([%/])\s*/g, '$1')
    .trim();
}

function parseSingle(text: string): { kind: RateKind; component?: RateComponent; warnings: string[] } {
  const normalized = normalizeText(text);

  if (SENSITIVE_ITEM_PATTERN.test(normalized)) {
    return {
      kind: 'sensitive_item',
      warnings: ['SENSITIVE_ITEM_REFERENCE: rate depends on the Sensitive Items schedule; no numeric rate is implied'],
    };
  }

  if (FREE_PATTERN.test(normalized)) {
    return { kind: 'free', warnings: [] };
  }

  const percentageMatch = PERCENTAGE_PATTERN.exec(normalized) ?? AD_VALOREM_PATTERN.exec(normalized);
  if (percentageMatch) {
    const amountText = percentageMatch[percentageMatch.length - 1] ?? '';
    return {
      kind: 'percentage',
      component: {
        kind: 'percentage',
        amount: Number(amountText),
        currency: null,
        unit: '%',
        text: text.trim(),
      },
      warnings: [],
    };
  }

  const specific = SPECIFIC_PATTERN.exec(normalized);
  if (specific) {
    const currency = (specific[1] ?? specific[3] ?? '').toUpperCase() || null;
    return {
      kind: 'specific',
      component: {
        kind: 'specific',
        amount: Number(specific[2]),
        currency,
        unit: specific[4]?.trim() ?? null,
        text: text.trim(),
      },
      warnings: currency ? [] : ['SPECIFIC_RATE_CURRENCY_NOT_STATED'],
    };
  }

  const bareNumber = SPECIFIC_NO_UNIT_PATTERN.exec(normalized);
  if (bareNumber) {
    return {
      kind: 'specific',
      component: {
        kind: 'specific',
        amount: Number(bareNumber[2]),
        currency: (bareNumber[1] ?? '').toUpperCase() || null,
        unit: null,
        text: text.trim(),
      },
      warnings: ['SPECIFIC_RATE_UNIT_NOT_STATED'],
    };
  }

  return { kind: 'unknown', warnings: ['RATE_TEXT_NOT_RECOGNISED'] };
}

export function analyzeRate(raw: string | null | undefined): RateAnalysis {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return { raw: raw ?? null, ...EMPTY_ANALYSIS };
  }

  const trimmed = raw.trim();
  const normalized = normalizeText(trimmed);

  // A compound/alternative expression is split only for classification; the
  // source string is never rewritten.
  const fragments = normalized.split(/\s*(?:\+|,|;|\bor\b|\band\b)\s*/i).filter(Boolean);
  if (fragments.length > 1) {
    const parts = fragments.map(parseSingle);
    const components = parts.flatMap((part) => (part.component ? [part.component] : []));
    const warnings = new Set(parts.flatMap((part) => part.warnings));
    const hasPercentage = components.some((component) => component.kind === 'percentage');
    const hasSpecific = components.some((component) => component.kind === 'specific');

    // Every fragment must be independently recognized before a compound
    // classification is asserted.
    if (components.length === fragments.length && hasPercentage && hasSpecific) {
      warnings.add('COMPOUND_RATE_RELATIONSHIP_UNVERIFIED: alternative ("or") vs additive ("and") is not asserted');
      return {
        raw,
        kind: 'compound',
        isSensitiveItem: false,
        components,
        warnings: [...warnings],
        classifiedFromSource: true,
      };
    }

    if (parts.some((part) => part.kind === 'sensitive_item')) {
      return {
        raw,
        kind: 'sensitive_item',
        isSensitiveItem: true,
        components,
        warnings: [...warnings],
        classifiedFromSource: true,
      };
    }
  }

  const single = parseSingle(trimmed);
  return {
    raw,
    kind: single.kind,
    isSensitiveItem: single.kind === 'sensitive_item',
    components: single.component ? [single.component] : [],
    warnings: single.warnings,
    classifiedFromSource: single.kind !== 'unknown',
  };
}
