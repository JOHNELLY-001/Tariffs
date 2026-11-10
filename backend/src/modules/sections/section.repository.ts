import { getSchemaCapabilities, hasColumn } from '../../config/schema-capabilities.js';
import { query } from '../../config/database.js';
import { toSectionRecord, type SectionRecord, type SectionRow } from './section.types.js';

/**
 * Section data access. Notes are returned verbatim; the repository never
 * rewrites, truncates or summarizes legal text.
 */

async function projection(alias = 's'): Promise<string> {
  const capabilities = await getSchemaCapabilities();
  const optional = (column: string, fallback: string) =>
    hasColumn(capabilities, 'cet_section_notes', column) ? `${alias}.${column}` : fallback;

  return [
    `${alias}.id AS id`,
    `${alias}.section_code AS section_code`,
    `${alias}.section_title AS section_title`,
    `${alias}.section_notes AS section_notes`,
    `${optional('source_page_start', 'NULL::integer')} AS source_page_start`,
    `${optional('source_page_end', 'NULL::integer')} AS source_page_end`,
    `${optional('created_at', 'NULL::timestamptz')} AS created_at`,
  ].join(', ');
}

export async function list(limit: number, offset: number): Promise<{ items: SectionRecord[]; total: number }> {
  const columns = await projection();
  const [page, count] = await Promise.all([
    query<SectionRow>(
      `SELECT ${columns}
         FROM cet_section_notes s
        ORDER BY s.section_code ASC, s.id ASC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM cet_section_notes`),
  ]);

  return { items: page.rows.map(toSectionRecord), total: Number(count.rows[0]?.total ?? 0) };
}

export async function findByCode(sectionCode: string): Promise<SectionRecord | null> {
  const columns = await projection();
  const result = await query<SectionRow>(
    `SELECT ${columns}
       FROM cet_section_notes s
      WHERE UPPER(s.section_code) = UPPER($1)
      LIMIT 1`,
    [sectionCode],
  );
  const row = result.rows[0];
  return row ? toSectionRecord(row) : null;
}

/** Section codes available for cross-referencing, bounded for safety. */
export async function listCodes(limit: number): Promise<string[]> {
  const result = await query<{ section_code: string }>(
    `SELECT s.section_code
       FROM cet_section_notes s
      ORDER BY s.section_code ASC
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => row.section_code);
}
