import { describe, expect, it } from 'vitest';
import { getExchangeRate, type ExchangeRateRepository } from '../../src/modules/calculations/services/exchange-rate.service.js';

describe('exchange-rate service', () => {
  it('returns identity rate for same currency', async () => {
    const result = await getExchangeRate({ currencyCode: 'TZS', baseCurrency: 'TZS', simulationDate: '2026-11-18' });
    expect(result.status).toBe('calculated');
    expect(result.rate?.toString()).toBe('1');
  });

  it('returns unavailable when no record exists', async () => {
    const repo: ExchangeRateRepository = {
      async findRate() { return null; },
    };
    const result = await getExchangeRate({ currencyCode: 'USD', baseCurrency: 'TZS', simulationDate: '2026-11-18' }, repo);
    expect(result.status).toBe('unavailable');
    expect(result.rate).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/EXCHANGE_RATE_UNAVAILABLE/);
  });

  it('selects effective rate by date', async () => {
    const repo: ExchangeRateRepository = {
      async findRate(_c, _b, date) {
        if (date >= '2026-01-01') {
          return {
            currencyCode: 'USD',
            baseCurrency: 'TZS',
            exchangeRate: '2650.50',
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            source: 'TEST',
            verificationStatus: 'VERIFIED',
          };
        }
        return null;
      },
    };
    const result = await getExchangeRate({ currencyCode: 'USD', baseCurrency: 'TZS', simulationDate: '2026-06-01' }, repo);
    expect(result.status).toBe('calculated');
    expect(result.rate?.toString()).toContain('2650.5');
    expect(result.source).toBe('TEST');
  });

  it('rejects non-verified rates', async () => {
    const repo: ExchangeRateRepository = {
      async findRate() {
        return {
          currencyCode: 'USD',
          baseCurrency: 'TZS',
          exchangeRate: '2650.50',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          source: 'TEST',
          verificationStatus: 'SECONDARY',
        };
      },
    };
    const result = await getExchangeRate({ currencyCode: 'USD', baseCurrency: 'TZS', simulationDate: '2026-06-01' }, repo);
    expect(result.status).toBe('unavailable');
  });

  it('rejects non-positive rates', async () => {
    const repo: ExchangeRateRepository = {
      async findRate() {
        return {
          currencyCode: 'USD',
          baseCurrency: 'TZS',
          exchangeRate: '0',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          source: 'TEST',
          verificationStatus: 'VERIFIED',
        };
      },
    };
    const result = await getExchangeRate({ currencyCode: 'USD', baseCurrency: 'TZS', simulationDate: '2026-06-01' }, repo);
    expect(result.status).toBe('unavailable');
  });
});