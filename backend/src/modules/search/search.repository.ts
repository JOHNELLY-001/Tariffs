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
 *
 * The query is built by `buildSearchQuery()` — a pure function — so placeholder
 * numbering can be unit-tested without a database. (An earlier version bound a
 * chapter value that was never referenced when no chapter filter was supplied,
 * which PostgreSQL rejects with SQLSTATE 08P01: "bind message supplies N
 * parameters, but prepared statement requires N-1".)
 *
 * No extension is required: `to_tsvector` and `websearch_to_tsquery` are core
 * PostgreSQL. GIN/trigram indexes are proposed separately in M2.
 */

export interface SearchRow extends TariffRow {
  match_type: 'exact_code' | 'code_prefix' | 'description';
  relevance: number | string | null;
}

export interface SearchParams {
  text: string;
  normalizedCode: string;
  chapterCode: string | null;
  /** Optional schedule discriminator, e.g. MAIN_TARIFF / SENSITIVE_ITEMS. */
  scheduleType: string | null;
  limit: number;
  offset: number;
}

export interface SearchStatement {
  text: string;
  values: unknown[];
}

export interface SearchQueryPlan {
  list: SearchStatement;
  count: SearchStatement;
}

export function buildSearchQuery(
  params: SearchParams,
  options: { chapterColumn: boolean; projection: string },
): SearchQueryPlan {
  // $1 search text, $2 normalized HS code. Optional filters take the next
  // available placeholder index — and are only bound when referenced.
  const values: unknown[] = [params.text, params.normalizedCode];
  const predicates: string[] = [];

  if (params.chapterCode !== null) {
    const placeholder = `$${values.push(normalizeChapterCode(params.chapterCode))}`;
    predicates.push(
      options.chapterColumn
        ? `AND t.chapter_code = ${placeholder}`
        : `AND ${SQL_DERIVED_CHAPTER} = ${placeholder}`,
    );
  }

  if (params.scheduleType !== null) {
    const placeholder = `$${values.push(params.scheduleType)}`;
    predicates.push(`AND UPPER(t.schedule_type) = UPPER(${placeholder})`);
  }

  const where = `
    WHERE (
      ($2 <> '' AND ${SQL_NORMALIZED_HS_CODE} LIKE $2 || '%')
      OR to_tsvector('simple', COALESCE(t.description, '')) @@ websearch_to_tsquery('simple', $1)
      OR t.description ILIKE ('%' || $1 || '%')
    )
    ${predicates.join('\n    ')}
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

  // The count query reuses the filter values only; paging placeholders belong
  // to the list statement alone.
  const filterValues = [...values];
  const limitPlaceholder = values.push(params.limit);
  const offsetPlaceholder = values.push(params.offset);

  return {
    list: {
      text: `SELECT ${options.projection},
        ${matchType} AS match_type,
        ${relevance} AS relevance
        FROM cet_tariffs t
        ${where}
        ORDER BY relevance DESC, t.id ASC
        LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}`,
      values,
    },
    count: {
      text: `SELECT COUNT(*)::text AS total FROM cet_tariffs t ${where}`,
      values: filterValues,
    },
  };
}

export async function search(
  params: SearchParams,
): Promise<{ items: SearchRow[]; total: number }> {
  const capabilities = await getSchemaCapabilities();
  const plan = buildSearchQuery(params, {
    chapterColumn: hasColumn(capabilities, 'cet_tariffs', 'chapter_code'),
    projection: tariffProjection(capabilities),
  });

  const [page, count] = await Promise.all([
    query<SearchRow>(plan.list.text, plan.list.values),
    query<{ total: string }>(plan.count.text, plan.count.values),
  ]);

  return { items: page.rows, total: Number(count.rows[0]?.total ?? 0) };
}
