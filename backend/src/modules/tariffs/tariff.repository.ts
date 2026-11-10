import { getSchemaCapabilities, hasColumn, type SchemaCapabilities } from '../../config/schema-capabilities.js';
import { query } from '../../config/database.js';
import { SQL_DERIVED_CHAPTER, SQL_NORMALIZED_HS_CODE } from '../../shared/utils/hs-code.js';
import { tariffProjection } from '../../shared/sql/tariff-projection.js';
import { toTariffRecord, type TariffRecord, type TariffRow } from './tariff.types.js';

/**
 * Tariff data access. Every statement is parameterized and every projection is
 * explicit. Nothing here mutates the source data.
 */

const FROM = 'FROM cet_tariffs t';

export async function findById(id: number): Promise<TariffRecord | null> {
  const capabilities = await getSchemaCapabilities();
  const result = await query<TariffRow>(
    `SELECT ${tariffProjection(capabilities)}
       ${FROM}
      WHERE t.id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? toTariffRecord(row) : null;
}

/**
 * Exact lookup on the normalized comparison form of the stored code.
 *
 * HS codes are not assumed unique: duplicates across schedules are returned as
 * separate matches, ordered deterministically.
 */
export async function findByNormalizedHsCode(
  normalizedCode: string,
  limit: number,
): Promise<TariffRecord[]> {
  const capabilities = await getSchemaCapabilities();
  const result = await query<TariffRow>(
    `SELECT ${tariffProjection(capabilities)}
       ${FROM}
      WHERE ${SQL_NORMALIZED_HS_CODE} = $1
      ORDER BY t.id
      LIMIT $2`,
    [normalizedCode, limit],
  );
  return result.rows.map(toTariffRecord);
}

/** Whether a verified chapter_code column exists (migration-dependent). */
export async function chapterLinkStrategy(): Promise<{
  capabilities: SchemaCapabilities;
  usesVerifiedColumn: boolean;
}> {
  const capabilities = await getSchemaCapabilities();
  return {
    capabilities,
    usesVerifiedColumn: hasColumn(capabilities, 'cet_tariffs', 'chapter_code'),
  };
}

/** Count of tariff lines in a chapter (used by chapter detail). */
export async function countByChapter(chapterCode: string): Promise<number> {
  const { usesVerifiedColumn } = await chapterLinkStrategy();
  const chapterPredicate = usesVerifiedColumn
    ? 't.chapter_code = $1'
    : `${SQL_DERIVED_CHAPTER} = $1`;

  const result = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total ${FROM} WHERE ${chapterPredicate}`,
    [chapterCode],
  );
  return Number(result.rows[0]?.total ?? 0);
}

/** Tariff lines for a chapter, using the verified column when available. */
export async function findByChapter(
  chapterCode: string,
  limit: number,
  offset: number,
): Promise<{ items: TariffRecord[]; total: number }> {
  const { capabilities, usesVerifiedColumn } = await chapterLinkStrategy();
  const chapterPredicate = usesVerifiedColumn
    ? 't.chapter_code = $1'
    : `${SQL_DERIVED_CHAPTER} = $1`;

  const [page, count] = await Promise.all([
    query<TariffRow>(
      `SELECT ${tariffProjection(capabilities)}
         ${FROM}
        WHERE ${chapterPredicate}
        ORDER BY t.id
        LIMIT $2 OFFSET $3`,
      [chapterCode, limit, offset],
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total ${FROM} WHERE ${chapterPredicate}`,
      [chapterCode],
    ),
  ]);

  return {
    items: page.rows.map(toTariffRecord),
    total: Number(count.rows[0]?.total ?? 0),
  };
}
