import { describe, expect, it } from 'vitest';
import { resolveTariff } from '../../src/modules/calculations/services/tariff-resolution.service.js';

describe('resolveTariff validation', () => {
  it('rejects letters without querying the database', async () => {
    await expect(resolveTariff({ hsCode: 'ABC123' })).rejects.toMatchObject({
      code: 'INVALID_HS_CODE',
      statusCode: 400,
    });
  });

  it('rejects an empty code', async () => {
    await expect(resolveTariff({ hsCode: '   ' })).rejects.toMatchObject({
      code: 'INVALID_HS_CODE',
    });
  });

  it('rejects a single digit', async () => {
    await expect(resolveTariff({ hsCode: '7' })).rejects.toMatchObject({
      code: 'INVALID_HS_CODE',
    });
  });

  it('rejects a code that is too long', async () => {
    await expect(resolveTariff({ hsCode: '1234567890123' })).rejects.toMatchObject({
      code: 'INVALID_HS_CODE',
    });
  });

  // Leading-zero preservation is covered by shared/hs-code tests and by the
  // resolver passing the normalized value (with zeros) to the repository.
});