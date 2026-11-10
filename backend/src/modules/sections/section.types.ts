/** Section-level legal notes (cet_section_notes). */

export interface SectionRecord {
  id: number;
  sectionCode: string;
  sectionTitle: string | null;
  sectionNotes: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  createdAt: string | null;
}

export interface SectionRow {
  id: string | number;
  section_code: string | null;
  section_title: string | null;
  section_notes: string | null;
  source_page_start: number | string | null;
  source_page_end: number | string | null;
  created_at: Date | string | null;
}

const toNumberOrNull = (value: number | string | null): number | null =>
  value === null || value === undefined ? null : Number(value);

export function toSectionRecord(row: SectionRow): SectionRecord {
  return {
    id: Number(row.id),
    sectionCode: row.section_code ?? '',
    sectionTitle: row.section_title,
    sectionNotes: row.section_notes,
    sourcePageStart: toNumberOrNull(row.source_page_start),
    sourcePageEnd: toNumberOrNull(row.source_page_end),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}
