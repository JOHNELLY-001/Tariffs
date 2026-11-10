import { hasColumn, type SchemaCapabilities } from '../../config/schema-capabilities.js';

/**
 * Explicit column projection for tariff queries.
 *
 * `SELECT *` is forbidden, and optional columns are projected as typed NULLs
 * when the live schema does not contain them. Column names come from this
 * fixed whitelist only — never from user input.
 */
export function tariffProjection(capabilities: SchemaCapabilities, alias = 't'): string {
  const optional = (column: string, fallback: string) =>
    hasColumn(capabilities, 'cet_tariffs', column) ? `${alias}.${column}` : fallback;

  return [
    `${alias}.id AS id`,
    `${alias}.hs_code AS hs_code`,
    `${alias}.description AS description`,
    `${alias}.quantity AS quantity`,
    `${alias}.rate AS rate`,
    `${optional('heading', 'NULL::text')} AS heading`,
    `${optional('source_page', 'NULL::integer')} AS source_page`,
    `${optional('extraction_phase', 'NULL::text')} AS extraction_phase`,
    `${optional('created_at', 'NULL::timestamptz')} AS created_at`,
    `${optional('chapter_code', 'NULL::text')} AS chapter_code`,
  ].join(', ');
}
