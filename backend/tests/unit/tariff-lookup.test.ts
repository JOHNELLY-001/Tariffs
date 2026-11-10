import { describe, expect, it } from 'vitest';
import { getTariffsByHsCode } from '../../src/modules/tariffs/tariff.service.js';

/**
 * Validation happens before any database access, so these run without a
 * configured connection.
 */
describe('HS-code lookup validation', () => {
  it('rejects letters without querying the database', async () => {
    await expect(getTariffsByHsCode('ABC123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('rejects an empty code', async () => {
    await expect(getTariffsByHsCode('   ')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects a single digit', async () => {
    await expect(getTariffsByHsCode('7')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [expect.objectContaining({ path: 'code' })],
    });
  });
});
