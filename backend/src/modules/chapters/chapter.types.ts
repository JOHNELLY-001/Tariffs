/** Chapter records (cet_chapter_notes). */

export interface ChapterRecord {
  id: number;
  chapterCode: string;
  chapterTitle: string | null;
  chapterNotes: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  createdAt: string | null;
  /** Present only when the verified chapter→section column exists. */
  sectionCode: string | null;
}

export interface ChapterRow {
  id: string | number;
  chapter_code: string | null;
  chapter_title: string | null;
  chapter_notes: string | null;
  source_page_start: number | string | null;
  source_page_end: number | string | null;
  created_at: Date | string | null;
  section_code: string | null;
}

const toNumberOrNull = (value: number | string | null): number | null =>
  value === null || value === undefined ? null : Number(value);

export function toChapterRecord(row: ChapterRow): ChapterRecord {
  return {
    id: Number(row.id),
    chapterCode: row.chapter_code ?? '',
    chapterTitle: row.chapter_title,
    chapterNotes: row.chapter_notes,
    sourcePageStart: toNumberOrNull(row.source_page_start),
    sourcePageEnd: toNumberOrNull(row.source_page_end),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    sectionCode: row.section_code,
  };
}
