import { query } from '../../../config/database.js';
import { Decimal } from '../utils/decimal.utils.js';

export interface ExchangeRateRecord {
  currencyCode: string;
  baseCurrency: string;
  exchangeRate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  source: string;
  verificationStatus: string;
}

export interface ExchangeRateRepository {
  findRate(currencyCode: string, baseCurrency: string, simulationDate: string): Promise<ExchangeRateRecord | null>;
}

export interface ExchangeRateInput {
  currencyCode: string;
  baseCurrency?: string;
  simulationDate: string;
}

export interface ExchangeRateResult {
  status: 'calculated' | 'unavailable';
  rate: Decimal | null;
  source: string | null;
  effectiveDate: string | null;
  currencyCode: string;
  baseCurrency: string;
  warnings: string[];
}

const defaultRepository: ExchangeRateRepository = {
  async findRate(currencyCode, baseCurrency, simulationDate) {
    try {
      const result = await query<{
        currency_code: string;
        base_currency: string;
        exchange_rate: string | number;
        effective_from: string | Date;
        effective_to: string | Date | null;
        source: string;
        verification_status: string;
      }>(
        `SELECT currency_code, base_currency, exchange_rate, effective_from, effective_to, source, verification_status
           FROM customs_exchange_rates
          WHERE UPPER(currency_code) = UPPER($1)
            AND UPPER(base_currency) = UPPER($2)
            AND effective_from <= $3::date
            AND (effective_to IS NULL OR effective_to >= $3::date)
          ORDER BY effective_from DESC
          LIMIT 1`,
        [currencyCode, baseCurrency, simulationDate],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        currencyCode: row.currency_code,
        baseCurrency: row.base_currency,
        exchangeRate: String(row.exchange_rate),
        effectiveFrom: row.effective_from instanceof Date ? row.effective_from.toISOString().slice(0, 10) : String(row.effective_from).slice(0, 10),
        effectiveTo: row.effective_to ? (row.effective_to instanceof Date ? row.effective_to.toISOString().slice(0, 10) : String(row.effective_to).slice(0, 10)) : null,
        source: row.source,
        verificationStatus: row.verification_status,
      };
    } catch {
      return null;
    }
  },
};

export async function getExchangeRate(
  input: ExchangeRateInput,
  repository: ExchangeRateRepository = defaultRepository,
): Promise<ExchangeRateResult> {
  const currencyCode = input.currencyCode.toUpperCase();
  const baseCurrency = (input.baseCurrency ?? 'TZS').toUpperCase();

  if (currencyCode === baseCurrency) {
    return {
      status: 'calculated',
      rate: Decimal.one(),
      source: 'IDENTITY_RATE',
      effectiveDate: input.simulationDate,
      currencyCode,
      baseCurrency,
      warnings: [],
    };
  }

  const record = await repository.findRate(currencyCode, baseCurrency, input.simulationDate);
  if (!record || record.verificationStatus !== 'VERIFIED') {
    return {
      status: 'unavailable',
      rate: null,
      source: record?.source ?? null,
      effectiveDate: record?.effectiveFrom ?? null,
      currencyCode,
      baseCurrency,
      warnings: ['EXCHANGE_RATE_UNAVAILABLE: no verified exchange rate is available for this currency and date.'],
    };
  }

  let rate: Decimal;
  try {
    rate = Decimal.parse(record.exchangeRate);
  } catch {
    return {
      status: 'unavailable',
      rate: null,
      source: record.source,
      effectiveDate: record.effectiveFrom,
      currencyCode,
      baseCurrency,
      warnings: ['EXCHANGE_RATE_UNAVAILABLE: the stored exchange rate is invalid.'],
    };
  }

  if (!rate.isPositive()) {
    return {
      status: 'unavailable',
      rate: null,
      source: record.source,
      effectiveDate: record.effectiveFrom,
      currencyCode,
      baseCurrency,
      warnings: ['EXCHANGE_RATE_UNAVAILABLE: the stored exchange rate is not positive.'],
    };
  }

  return {
    status: 'calculated',
    rate,
    source: record.source,
    effectiveDate: record.effectiveFrom,
    currencyCode,
    baseCurrency,
    warnings: [],
  };
}
