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
  /**
   * Historical extraction phase number as stored (integer in the live schema).
   * Kept as a source fact; never interpreted.
   */
  extractionPhase: number | null;
  /**
   * Schedule the row belongs to (`MAIN_TARIFF`, `SENSITIVE_ITEMS`, …).
   * Essential for keeping Sensitive Items entries distinguishable from the
   * main schedule. Nullable because older rows may not carry it.
   */
  scheduleType: string | null;
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
  extraction_phase: number | string | null;
  schedule_type: string | null;
  created_at: Date | string | null;
  chapter_code: string | null;
}

const toNumberOrNull = (value: number | string | null): number | null =>
  value === null || value === undefined || value === '' ? null : Number(value);

export function toTariffRecord(row: TariffRow): TariffRecord {
  return {
    id: Number(row.id),
    hsCode: row.hs_code ?? '',
    description: row.description,
    quantity: row.quantity,
    rate: row.rate,
    heading: row.heading,
    sourcePage: toNumberOrNull(row.source_page),
    extractionPhase: toNumberOrNull(row.extraction_phase),
    scheduleType: row.schedule_type,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    chapterCode: row.chapter_code,
  };
}
