/** Domain types for tariff-line records. */

export interface TariffRecord {
  /** Database primary key of the tariff line. */
  id: number;
  /** HS code exactly as stored in the source data. Never rewritten. */
  hsCode: string;
  description: string | null;
  quantity: string | null;
  /** Original source rate text (percentage, specific, compound, SI, …). */
  rate: string | null;
  heading: string | null;
  sourcePage: number | null;
  extractionPhase: string | null;
  createdAt: string | null;
  /** Chapter code when a verified column exists in the live schema. */
  chapterCode: string | null;
}

export interface TariffRow {
  id: string | number;
  hs_code: string | null;
  description: string | null;
  quantity: string | null;
  rate: string | null;
  heading: string | null;
  source_page: number | string | null;
  extraction_phase: string | null;
  created_at: Date | string | null;
  chapter_code: string | null;
}

export function toTariffRecord(row: TariffRow): TariffRecord {
  return {
    id: Number(row.id),
    hsCode: row.hs_code ?? '',
    description: row.description,
    quantity: row.quantity,
    rate: row.rate,
    heading: row.heading,
    sourcePage: row.source_page === null || row.source_page === undefined ? null : Number(row.source_page),
    extractionPhase: row.extraction_phase,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    chapterCode: row.chapter_code,
  };
}
