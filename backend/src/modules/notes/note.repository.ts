import { query } from '../../config/database.js';
import {
  toSubheadingNoteRecord,
  type SubheadingNoteRecord,
  type SubheadingNoteRow,
} from './note.types.js';

/**
 * Subheading-note data access.
 *
 * Ownership rule: a note belongs to exactly one of a chapter or a section.
 * Filters are parameterized; the text itself is returned exactly as stored.
 */

const COLUMNS = [
  'n.id AS id',
  'n.chapter_code AS chapter_code',
  'n.section_code AS section_code',
  'n.note_number AS note_number',
  'n.subheading_reference AS subheading_reference',
  'n.note_text AS note_text',
  'n.source_page_start AS source_page_start',
  'n.source_page_end AS source_page_end',
].join(', ');

export interface SubheadingNoteFilters {
  chapterCode?: string | null;
  sectionCode?: string | null;
  reference?: string | null;
  includeUnassigned?: boolean;
}

const FILTER_SQL = `
  WHERE ($1::text IS NULL OR lpad(n.chapter_code, 2, '0') = $1)
    AND ($2::text IS NULL OR UPPER(n.section_code) = UPPER($2))
    AND ($3::text IS NULL OR n.subheading_reference ILIKE ('%' || $3 || '%'))
`;

export async function list(
  filters: SubheadingNoteFilters,
  limit: number,
  offset: number,
): Promise<{ items: SubheadingNoteRecord[]; total: number }> {
  const params = [
    filters.chapterCode ?? null,
    filters.sectionCode ?? null,
    filters.reference ?? null,
  ];

  const [page, count] = await Promise.all([
    query<SubheadingNoteRow>(
      `SELECT ${COLUMNS}
         FROM cet_subheading_notes n
         ${FILTER_SQL}
        ORDER BY n.id ASC
        LIMIT $4 OFFSET $5`,
      [...params, limit, offset],
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM cet_subheading_notes n ${FILTER_SQL}`,
      params,
    ),
  ]);

  return { items: page.rows.map(toSubheadingNoteRecord), total: Number(count.rows[0]?.total ?? 0) };
}

/**
 * Notes that govern a tariff line: chapter-owned notes for its chapter plus
 * section-owned notes for its section. One bounded query, no N+1.
 */
export async function findForClassification(
  chapterCode: string | null,
  sectionCode: string | null,
  limit: number,
): Promise<SubheadingNoteRecord[]> {
  if (!chapterCode && !sectionCode) return [];

  const result = await query<SubheadingNoteRow>(
    `SELECT ${COLUMNS}
       FROM cet_subheading_notes n
      WHERE (lpad(n.chapter_code, 2, '0') = $1)
         OR ($2::text IS NOT NULL AND UPPER(n.section_code) = UPPER($2))
      ORDER BY n.id ASC
      LIMIT $3`,
    [chapterCode, sectionCode, limit],
  );

  return result.rows.map(toSubheadingNoteRecord);
}
