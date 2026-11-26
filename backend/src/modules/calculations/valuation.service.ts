import { Decimal } from './utils/decimal.utils.js';
import { getExchangeRate, type ExchangeRateRepository } from './services/exchange-rate.service.js';

export interface ValuationInput {
  invoiceValue: string | number | Decimal;
  currency: string;
  freight?: string | number | Decimal;
  insurance?: string | number | Decimal;
  otherCosts?: string | number | Decimal;
  simulationDate?: string;
  originCountry?: string;
  exchangeRateRepository?: ExchangeRateRepository;
}

export interface ValuationComponent {
  code: string;
  description: string;
  amount: string | null;
  currency: string;
  included: boolean;
  reason: string;
}

export interface ValuationResult {
  state: 'calculated' | 'needs_review' | 'unsupported';
  customsValue: string | null;
  currency: string;
  components: ValuationComponent[];
  exchangeRate: string | null;
  exchangeRateSource: string | null;
  exchangeRateEffectiveDate: string | null;
  ruleId: string | null;
  reason: string | null;
  warnings: string[];
}

function parseDecimalInput(value: string | number | Decimal | undefined): Decimal | null {
  if (value === undefined || value === null || value === '') return null;
  try {
    return Decimal.parse(String(value));
  } catch {
    return null;
  }
}

function isNonNegative(value: Decimal | null): boolean {
  return value === null || !value.isNegative();
}

export async function valuate(input: ValuationInput): Promise<ValuationResult> {
  const currency = input.currency?.toUpperCase?.() ?? '';
  if (!/^[A-Z]{3}$/.test(currency)) {
    return {
      state: 'needs_review',
      customsValue: null,
      currency: input.currency,
      components: [],
      exchangeRate: null,
      exchangeRateSource: null,
      exchangeRateEffectiveDate: null,
      ruleId: null,
      reason: 'INVALID_CURRENCY',
      warnings: ['INVALID_CURRENCY: currency must be a three-letter ISO code.'],
    };
  }

  const invoice = parseDecimalInput(input.invoiceValue);
  const freight = parseDecimalInput(input.freight);
  const insurance = parseDecimalInput(input.insurance);
  const otherCosts = parseDecimalInput(input.otherCosts);

  if (invoice === null || !isNonNegative(invoice) || !isNonNegative(freight) || !isNonNegative(insurance) || !isNonNegative(otherCosts)) {
    return {
      state: 'needs_review',
      customsValue: null,
      currency,
      components: [],
      exchangeRate: null,
      exchangeRateSource: null,
      exchangeRateEffectiveDate: null,
      ruleId: null,
      reason: 'INVALID_MONETARY_INPUT',
      warnings: ['INVALID_MONETARY_INPUT: monetary values must be non-negative decimals.'],
    };
  }

  const simulationDate = input.simulationDate ?? new Date().toISOString().slice(0, 10);
  const exchange = await getExchangeRate(
    { currencyCode: currency, baseCurrency: 'TZS', simulationDate },
    input.exchangeRateRepository,
  );

  const rate = exchange.rate;
  const convert = (value: Decimal | null): string | null => {
    if (value === null) return null;
    if (rate === null) return null;
    return value.mul(rate).toString();
  };

  const components: ValuationComponent[] = [
    {
      code: 'INVOICE_VALUE',
      description: 'Invoice (FOB) value',
      amount: convert(invoice),
      currency: 'TZS',
      included: false,
      reason: 'VALUATION_RULE_UNVERIFIED: legal valuation method and inclusions are not verified.',
    },
    {
      code: 'FREIGHT',
      description: 'International freight',
      amount: convert(freight),
      currency: 'TZS',
      included: false,
      reason: 'VALUATION_RULE_UNVERIFIED: freight inclusion is not verified.',
    },
    {
      code: 'INSURANCE',
      description: 'Insurance',
      amount: convert(insurance),
      currency: 'TZS',
      included: false,
      reason: 'VALUATION_RULE_UNVERIFIED: insurance inclusion is not verified.',
    },
    {
      code: 'OTHER_COSTS',
      description: 'Other costs',
      amount: convert(otherCosts),
      currency: 'TZS',
      included: false,
      reason: 'VALUATION_RULE_UNVERIFIED: other-cost treatment is not verified; excluded by default.',
    },
  ];

  const warnings = [...exchange.warnings];
  if (exchange.status !== 'calculated') {
    warnings.push('EXCHANGE_RATE_UNAVAILABLE');
  } else {
    warnings.push('VALUATION_RULE_UNVERIFIED: customs valuation method and inclusions are not verified.');
  }

  return {
    state: 'needs_review',
    customsValue: null,
    currency,
    components,
    exchangeRate: exchange.rate ? exchange.rate.toString() : null,
    exchangeRateSource: exchange.source,
    exchangeRateEffectiveDate: exchange.effectiveDate,
    ruleId: null,
    reason:
      exchange.status !== 'calculated'
        ? 'EXCHANGE_RATE_UNAVAILABLE'
        : 'CUSTOMS_VALUATION_RULE_UNVERIFIED',
    warnings,
  };
}
