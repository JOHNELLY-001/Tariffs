import { describe, expect, it } from 'vitest';
import { valuate } from '../../src/modules/calculations/valuation.service.js';
import { type ExchangeRateRepository } from '../../src/modules/calculations/services/exchange-rate.service.js';

const verifiedRepo: ExchangeRateRepository = {
  async findRate() {
    return {
      currencyCode: 'USD',
      baseCurrency: 'TZS',
      exchangeRate: '2500',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      source: 'TEST',
      verificationStatus: 'VERIFIED',
    };
  },
};

describe('customs valuation', () => {
  it('tracks components and returns needs_review when valuation rule unverified', async () => {
    const result = await valuate({
      invoiceValue: '100',
      currency: 'USD',
      freight: '10',
      insurance: '2',
      otherCosts: '3',
      simulationDate: '2026-06-01',
      exchangeRateRepository: verifiedRepo,
    });
    expect(result.state).toBe('needs_review');
    expect(result.customsValue).toBeNull();
    expect(result.components.map((c) => c.code)).toEqual([
      'INVOICE_VALUE',
      'FREIGHT',
      'INSURANCE',
      'OTHER_COSTS',
    ]);
    expect(result.exchangeRate).toBe('2500');
  });

  it('returns needs_review when exchange rate unavailable', async () => {
    const result = await valuate({
      invoiceValue: '100',
      currency: 'USD',
      simulationDate: '2026-06-01',
    });
    expect(result.state).toBe('needs_review');
    expect(result.customsValue).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/EXCHANGE_RATE_UNAVAILABLE/);
  });

  it('rejects invalid monetary input', async () => {
    const result = await valuate({
      invoiceValue: '-5',
      currency: 'USD',
      simulationDate: '2026-06-01',
      exchangeRateRepository: verifiedRepo,
    });
    expect(result.state).toBe('needs_review');
    expect(result.reason).toBe('INVALID_MONETARY_INPUT');
  });

  it('rejects invalid currency', async () => {
    const result = await valuate({
      invoiceValue: '100',
      currency: 'SHILLINGS',
      simulationDate: '2026-06-01',
      exchangeRateRepository: verifiedRepo,
    });
    expect(result.reason).toBe('INVALID_CURRENCY');
  });
});