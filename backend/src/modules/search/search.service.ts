import type { MatchType } from '../../config/constants.js';
import { normalizeHsCode } from '../../shared/utils/hs-code.js';
import { toTariffRecord } from '../tariffs/tariff.types.js';
import { toTariffView, type TariffView } from '../tariffs/tariff.service.js';
import * as searchRepository from './search.repository.js';

/**
 * Search orchestration.
 *
 * Match type and relevance are returned as search metadata. They describe how
 * a row matched the query — they are not a statement of classification
 * certainty or legal validity.
 */

export interface SearchItem extends TariffView {
  matchType: MatchType;
  relevance: number;
}

export interface SearchResult {
  items: SearchItem[];
  total: number;
  query: {
    text: string;
    normalizedCode: string;
    chapterCode: string | null;
    scheduleType: string | null;
  };
  warnings: string[];
}

export async function searchTariffs(
  input: { q: string; chapterCode?: string; scheduleType?: string },
  page: { pageSize: number; offset: number },
): Promise<SearchResult> {
  const normalized = normalizeHsCode(input.q);
  const normalizedCode = normalized.isValid ? normalized.normalized : '';

  const { items, total } = await searchRepository.search({
    text: input.q,
    normalizedCode,
    chapterCode: input.chapterCode ?? null,
    scheduleType: input.scheduleType ?? null,
    limit: page.pageSize,
    offset: page.offset,
  });

  const mapped: SearchItem[] = items.map((row) => {
    const view = toTariffView(toTariffRecord(row));
    const rawRelevance = Number(row.relevance ?? 0);
    return {
      ...view,
      matchType: row.match_type,
      relevance: Number.isFinite(rawRelevance) ? Math.round(rawRelevance * 10_000) / 10_000 : 0,
    };
  });

  const warnings = [
    'SEARCH_METADATA_NOT_CLASSIFICATION: relevance and match type describe text matching only.',
  ];
  if (!normalized.isValid) {
    warnings.push('QUERY_NOT_A_TARIFF_CODE: the query was treated as description text only.');
  }

  return {
    items: mapped,
    total,
    query: {
      text: input.q,
      normalizedCode,
      chapterCode: input.chapterCode ?? null,
      scheduleType: input.scheduleType ?? null,
    },
    warnings,
  };
}
