/**
 * Exact decimal arithmetic for financial calculations.
 *
 * Values are stored as rationals (numerator/denominator) so that addition,
 * subtraction, multiplication and division do not use JavaScript floating point
 * and do not lose precision. Rounding is performed separately by the rounding
 * utilities.
 */

export class Decimal {
  private constructor(
    private readonly num: bigint,
    private readonly den: bigint,
  ) {}

  static parse(value: string | bigint | Decimal): Decimal {
    if (value instanceof Decimal) {
      return new Decimal(value.num, value.den);
    }
    if (typeof value === 'bigint') {
      return new Decimal(value, 1n);
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new Error('Decimal value must not be empty');
    }
    const match = /^[+-]?(\d*)\.?(\d*)$/.exec(trimmed);
    if (!match || ((match[1] ?? '') === '' && (match[2] ?? '') === '')) {
      throw new Error(`Invalid decimal value: ${value}`);
    }
    const negative = trimmed.startsWith('-');
    const intPart = match[1] ?? '0';
    const fracPart = match[2] ?? '';
    const digits = (intPart + fracPart).replace(/^0+/, '') || '0';
    const denominator = 10n ** BigInt(fracPart.length);
    let numerator = BigInt(digits);
    if (negative) numerator = -numerator;
    return new Decimal(numerator, denominator).normalize();
  }

  static zero(): Decimal {
    return new Decimal(0n, 1n);
  }

  static one(): Decimal {
    return new Decimal(1n, 1n);
  }

  static fromScaled(integer: bigint, scale: number): Decimal {
    const den = 10n ** BigInt(scale);
    return new Decimal(integer, den).normalize();
  }

  private normalize(): Decimal {
    if (this.num === 0n) return new Decimal(0n, 1n);
    let n = this.num;
    let d = this.den;
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(abs(n), d);
    return new Decimal(n / g, d / g);
  }

  add(other: Decimal): Decimal {
    const o = other instanceof Decimal ? other : Decimal.parse(other);
    const n = this.num * o.den + o.num * this.den;
    const d = this.den * o.den;
    return new Decimal(n, d).normalize();
  }

  sub(other: Decimal): Decimal {
    const o = other instanceof Decimal ? other : Decimal.parse(other);
    return this.add(new Decimal(-o.num, o.den));
  }

  mul(other: Decimal): Decimal {
    const o = other instanceof Decimal ? other : Decimal.parse(other);
    return new Decimal(this.num * o.num, this.den * o.den).normalize();
  }

  div(other: Decimal): Decimal {
    const o = other instanceof Decimal ? other : Decimal.parse(other);
    if (o.num === 0n) throw new Error('Division by zero');
    return new Decimal(this.num * o.den, this.den * o.num).normalize();
  }

  cmp(other: Decimal): -1 | 0 | 1 {
    const o = other instanceof Decimal ? other : Decimal.parse(other);
    const left = this.num * o.den;
    const right = o.num * this.den;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  equals(other: Decimal): boolean {
    return this.cmp(other) === 0;
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  isNegative(): boolean {
    return this.num < 0n;
  }

  isPositive(): boolean {
    return this.num > 0n;
  }

  abs(): Decimal {
    return new Decimal(this.num < 0n ? -this.num : this.num, this.den);
  }

  neg(): Decimal {
    return new Decimal(-this.num, this.den);
  }

  /**
   * Returns the value scaled to the given number of decimal places as a
   * rational is not possible; instead returns the integer floor of
   * value * 10^scale (truncation toward zero is handled by the caller via
   * rounding utilities). This helper is intentionally exact for the
   * multiplication step.
   */
  scaledNumerator(scale: number): bigint {
    return this.num * 10n ** BigInt(scale);
  }

  scaledDenominator(): bigint {
    return this.den;
  }

  toString(): string {
    // Best-effort finite decimal rendering at 18 places, trimmed.
    const scale = 18;
    const num = this.num * 10n ** BigInt(scale);
    const q = num / this.den;
    const r = num % this.den;
    let whole = q;
    let negative = false;
    if (whole < 0n) {
      negative = true;
      whole = -whole;
    }
    const intPart = whole / 10n ** BigInt(scale);
    const fracPart = (whole % 10n ** BigInt(scale)).toString().padStart(scale, '0');
    const trimmed = fracPart.replace(/0+$/, '');
    const sign = negative ? '-' : '';
    return trimmed.length > 0 ? `${sign}${intPart}.${trimmed}` : `${sign}${intPart}`;
  }
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a === 0n ? 1n : a;
}
