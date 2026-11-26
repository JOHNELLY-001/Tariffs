import { Decimal } from './decimal.utils.js';

export type RoundingMode = 'half_up' | 'half_even' | 'floor' | 'ceil' | 'trunc';

/**
 * Round a Decimal to the given number of decimal places.
 * Returns a new Decimal whose value is the rounded amount.
 */
export function roundDecimal(
  value: Decimal,
  scale: number,
  mode: RoundingMode = 'half_up',
): Decimal {
  if (scale < 0) throw new Error('Scale must be non-negative');
  const factor = 10n ** BigInt(scale);
  const scaled = value.scaledNumerator(scale); // value * 10^scale as rational numerator over value.den
  // scaled is a rational: scaled / value.den ... wait scaledNumerator returns num*10^scale, denominator is value.den
  const den = value.scaledDenominator();
  const negative = scaled < 0n;
  const absNum = negative ? -scaled : scaled;
  const q = absNum / den;
  const rem = absNum % den;

  let roundUp = false;
  switch (mode) {
    case 'floor':
      roundUp = false; // toward -infinity handled below
      break;
    case 'ceil':
      roundUp = rem !== 0n;
      break;
    case 'trunc':
      roundUp = false;
      break;
    case 'half_up':
      roundUp = rem * 2n >= den;
      break;
    case 'half_even':
      if (rem * 2n > den) roundUp = true;
      else if (rem * 2n === den) roundUp = q % 2n === 1n;
      break;
  }

  // floor for negatives: toward -infinity means if remainder, increment magnitude
  if (negative && mode === 'floor' && rem !== 0n) {
    roundUp = true;
  }
  // ceil for negatives: toward +infinity means no increment
  if (negative && mode === 'ceil') {
    roundUp = false;
  }
  // trunc for negatives: toward zero means no increment
  if (negative && mode === 'trunc') {
    roundUp = false;
  }

  let roundedAbs = q + (roundUp ? 1n : 0n);
  if (negative) roundedAbs = -roundedAbs;
  return Decimal.fromScaled(roundedAbs, scale);
}

export function toScaledInteger(
  value: Decimal,
  scale: number,
  mode: RoundingMode = 'half_up',
): bigint {
  const rounded = roundDecimal(value, scale, mode);
  return rounded.scaledNumerator(scale) / rounded.scaledDenominator();
}

/**
 * Resolve the number of decimal places for a currency.
 * Defaults to 2 only when no verified scale is supplied; callers should pass an
 * explicit scale whenever a legal rule defines one.
 */
export function currencyScale(currency: string, override?: number): number {
  if (override !== undefined) return override;
  const known: Record<string, number> = {
    USD: 2,
    EUR: 2,
    GBP: 2,
    TZS: 2,
    KES: 2,
  };
  return known[currency.toUpperCase()] ?? 2;
}
