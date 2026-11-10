/** Subheading guidance (cet_subheading_notes). */

export interface SubheadingNoteRecord {
  id: number;
  chapterCode: string | null;
  sectionCode: string | null;
  noteNumber: string | null;
  subheadingReference: string | null;
  noteText: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  /** Derived: which parent owns this note. */
  ownership: 'chapter' | 'section' | 'unassigned';
}

export interface SubheadingNoteRow {
  id: string | number;
  chapter_code: string | null;
  section_code: string | null;
  note_number: string | number | null;
  subheading_reference: string | null;
  note_text: string | null;
  source_page_start: number | string | null;
  source_page_end: number | string | null;
}

const toNumberOrNull = (value: number | string | null): number | null =>
  value === null || value === undefined ? null : Number(value);

export function ownershipOf(chapterCode: string | null, sectionCode: string | null): SubheadingNoteRecord['ownership'] {
  if (chapterCode && !sectionCode) return 'chapter';
  if (!chapterCode && sectionCode) return 'section';
  return 'unassigned';
}

export function toSubheadingNoteRecord(row: SubheadingNoteRow): SubheadingNoteRecord {
  const chapterCode = row.chapter_code;
  const sectionCode = row.section_code;
  return {
    id: Number(row.id),
    chapterCode,
    sectionCode,
    noteNumber: row.note_number === null || row.note_number === undefined ? null : String(row.note_number),
    subheadingReference: row.subheading_reference,
    noteText: row.note_text,
    sourcePageStart: toNumberOrNull(row.source_page_start),
    sourcePageEnd: toNumberOrNull(row.source_page_end),
    ownership: ownershipOf(chapterCode, sectionCode),
  };
}
