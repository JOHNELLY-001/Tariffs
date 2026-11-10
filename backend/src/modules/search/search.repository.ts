import { getSchemaCapabilities, hasColumn } from '../../config/schema-capabilities.js';
import { query } from '../../config/database.js';
import { tariffProjection } from '../../shared/sql/tariff-projection.js';
import { SQL_DERIVED_CHAPTER, SQL_NORMALIZED_HS_CODE } from '../../shared/utils/hs-code.js';
import { normalizeChapterCode } from '../../shared/utils/codes.js';
import type { TariffRow } from '../tariffs/tariff.types.js';

/**
 * Description / keyword search.
 *
 * Strategy: PostgreSQL full-text search (`simple` configuration — no stemming,
 * which suits product descriptions) with an ILIKE partial fallback, plus
 * normalized HS-code prefix matching. Exact code matches always rank first.
 * All predicates are parameterized and result sets are bounded.
 *
 * The GIN index this query should use is proposed in the M2 migration; until
 * that is approved the query remains correct, just not index-backed.
 */

export interface SearchRow extends TariffRow {
  match_type: 'exact_code' | 'code_prefix' | 'description';
  relevance: number | string | null;
}

export interface SearchParams {
  text: string;
  normalizedCode: string;
  chapterCode: string | null;
  limit: number;
  offset: number;
}

export async function search(
  params: SearchParams,
): Promise<{ items: SearchRow[]; total: number }> {
  const capabilities = await getSchemaCapabilities();
  const chapterColumn = hasColumn(capabilities, 'cet_tariffs', 'chapter_code');
  const hasChapterFilter = params.chapterCode !== null;

  // $1 text, $2 normalized code, $3 chapter, $4 limit, $5 offset
  const chapterPredicate = hasChapterFilter
    ? chapterColumn
      ? 'AND t.chapter_code = $3'
      : `AND ${SQL_DERIVED_CHAPTER} = $3`
    : '';

  const where = `
    WHERE (
      ($2 <> '' AND ${SQL_NORMALIZED_HS_CODE} LIKE $2 || '%')
      OR to_tsvector('simple', COALESCE(t.description, '')) @@ websearch_to_tsquery('simple', $1)
      OR t.description ILIKE ('%' || $1 || '%')
    )
    ${chapterPredicate}
  `;

  const matchType = `
    CASE
      WHEN $2 <> '' AND ${SQL_NORMALIZED_HS_CODE} = $2 THEN 'exact_code'
      WHEN $2 <> '' AND ${SQL_NORMALIZED_HS_CODE} LIKE $2 || '%' THEN 'code_prefix'
      ELSE 'description'
    END
  `;

  const relevance = `
    CASE
      WHEN $2 <> '' AND ${SQL_NORMALIZED_HS_CODE} = $2 THEN 1.0
      WHEN $2 <> '' AND ${SQL_NORMALIZED_HS_CODE} LIKE $2 || '%' THEN 0.9
      WHEN t.description ILIKE ('%' || $1 || '%')
        THEN GREATEST(
          ts_rank_cd(to_tsvector('simple', COALESCE(t.description, '')), websearch_to_tsquery('simple', $1)),
          0.1
        )
      ELSE ts_rank_cd(to_tsvector('simple', COALESCE(t.description, '')), websearch_to_tsquery('simple', $1))
    END
  `;

  const filterParams: unknown[] = [
    params.text,
    params.normalizedCode,
    hasChapterFilter ? normalizeChapterCode(params.chapterCode as string) : null,
  ];

  const [page, count] = await Promise.all([
    query<SearchRow>(
      `SELECT ${tariffProjection(capabilities)},
              ${matchType} AS match_type,
              ${relevance} AS relevance
         FROM cet_tariffs t
         ${where}
        ORDER BY relevance DESC, t.id ASC
        LIMIT $4 OFFSET $5`,
      [...filterParams, params.limit, params.offset],
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM cet_tariffs t ${where}`,
      filterParams,
    ),
  ]);

  return { items: page.rows, total: Number(count.rows[0]?.total ?? 0) };
}
