import { getSchemaCapabilities, hasColumn } from '../../config/schema-capabilities.js';
import { query } from '../../config/database.js';
import { toChapterRecord, type ChapterRecord, type ChapterRow } from './chapter.types.js';

/**
 * Chapter data access.
 *
 * `section_code` is projected only when the verified migration column exists;
 * otherwise it is `NULL` and callers must report the relationship as
 * unverified rather than inventing a section.
 */

async function projection(alias = 'c'): Promise<string> {
  const capabilities = await getSchemaCapabilities();
  const optional = (column: string, fallback: string) =>
    hasColumn(capabilities, 'cet_chapter_notes', column) ? `${alias}.${column}` : fallback;

  return [
    `${alias}.id AS id`,
    `${alias}.chapter_code AS chapter_code`,
    `${alias}.chapter_title AS chapter_title`,
    `${alias}.chapter_notes AS chapter_notes`,
    `${optional('source_page_start', 'NULL::integer')} AS source_page_start`,
    `${optional('source_page_end', 'NULL::integer')} AS source_page_end`,
    `${optional('created_at', 'NULL::timestamptz')} AS created_at`,
    `${optional('section_code', 'NULL::text')} AS section_code`,
  ].join(', ');
}

export async function list(
  limit: number,
  offset: number,
  sectionCode?: string | null,
): Promise<{ items: ChapterRecord[]; total: number }> {
  const capabilities = await getSchemaCapabilities();
  const columns = await projection();

  // Filtering by section is only possible once the verified column exists.
  const hasSectionFilter = Boolean(sectionCode) && hasColumn(capabilities, 'cet_chapter_notes', 'section_code');
  const where = hasSectionFilter ? `WHERE UPPER(c.section_code) = UPPER($1)` : '';
  const pageParams: unknown[] = hasSectionFilter ? [sectionCode, limit, offset] : [limit, offset];
  const countParams: unknown[] = hasSectionFilter ? [sectionCode] : [];
  const pageLimit = hasSectionFilter ? 'LIMIT $2 OFFSET $3' : 'LIMIT $1 OFFSET $2';

  const [page, count] = await Promise.all([
    query<ChapterRow>(
      `SELECT ${columns}
         FROM cet_chapter_notes c
         ${where}
        ORDER BY lpad(c.chapter_code, 2, '0') ASC, c.id ASC
        ${pageLimit}`,
      pageParams,
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM cet_chapter_notes c ${where}`,
      countParams,
    ),
  ]);

  return { items: page.rows.map(toChapterRecord), total: Number(count.rows[0]?.total ?? 0) };
}

export async function findByCode(chapterCode: string): Promise<ChapterRecord | null> {
  const columns = await projection();
  const result = await query<ChapterRow>(
    `SELECT ${columns}
       FROM cet_chapter_notes c
      WHERE lpad(c.chapter_code, 2, '0') = $1
      LIMIT 1`,
    [chapterCode],
  );
  const row = result.rows[0];
  return row ? toChapterRecord(row) : null;
}

/**
 * Chapters belonging to a section. Requires the verified `section_code`
 * column; returns null when the relationship is not yet available.
 */
export async function listBySection(sectionCode: string): Promise<ChapterRecord[] | null> {
  const capabilities = await getSchemaCapabilities();
  if (!hasColumn(capabilities, 'cet_chapter_notes', 'section_code')) return null;

  const columns = await projection();
  const result = await query<ChapterRow>(
    `SELECT ${columns}
       FROM cet_chapter_notes c
      WHERE UPPER(c.section_code) = UPPER($1)
      ORDER BY lpad(c.chapter_code, 2, '0') ASC, c.id ASC`,
    [sectionCode],
  );
  return result.rows.map(toChapterRecord);
}
