import { TARIFF_LOOKUP } from '../../config/constants.js';
import { notFound, validationError } from '../../shared/errors/app-error.js';
import { describeHsCodeIssue, normalizeHsCode, type NormalizedHsCode } from '../../shared/utils/hs-code.js';
import { normalizeChapterCode } from '../../shared/utils/codes.js';
import { analyzeRate, type RateAnalysis } from '../calculations/rate-parser.service.js';
import * as tariffRepository from './tariff.repository.js';
import type { TariffRecord } from './tariff.types.js';

/**
 * Tariff business rules.
 *
 * Source facts (code, description, quantity, rate) and derived information
 * (rate classification) are kept in separate fields so a client can always
 * tell them apart.
 */

export interface TariffView extends TariffRecord {
  rateAnalysis: RateAnalysis;
}

export interface HsCodeLookupResult {
  matches: TariffView[];
  ambiguous: boolean;
  normalization: {
    input: string;
    normalized: string;
    chapter: string | null;
  };
}

export function toTariffView(record: TariffRecord): TariffView {
  return { ...record, rateAnalysis: analyzeRate(record.rate) };
}

export async function getTariffById(id: number): Promise<TariffView> {
  const record = await tariffRepository.findById(id);
  if (!record) {
    throw notFound(`No tariff record exists with id ${id}`);
  }
  return toTariffView(record);
}

export async function getTariffsByHsCode(rawCode: string): Promise<HsCodeLookupResult> {
  const normalized: NormalizedHsCode = normalizeHsCode(rawCode);

  if (!normalized.isValid) {
    throw validationError('The HS code is not a valid tariff code', [
      { path: 'code', message: describeHsCodeIssue(normalized.issue ?? 'INVALID_CHARACTERS') },
    ]);
  }

  const matches = await tariffRepository.findByNormalizedHsCode(
    normalized.normalized,
    TARIFF_LOOKUP.maxMatchesPerCode,
  );

  if (matches.length === 0) {
    throw notFound(`No tariff record matches HS code ${normalized.normalized}`);
  }

  return {
    matches: matches.map(toTariffView),
    ambiguous: matches.length > 1,
    normalization: {
      input: normalized.raw,
      normalized: normalized.normalized,
      chapter: normalized.chapter,
    },
  };
}

export async function getChapterTariffs(
  chapterCode: string,
  page: { page: number; pageSize: number; offset: number },
): Promise<{ items: TariffView[]; total: number }> {
  const normalized = normalizeChapterCode(chapterCode);
  const { items, total } = await tariffRepository.findByChapter(normalized, page.pageSize, page.offset);
  return { items: items.map(toTariffView), total };
}
