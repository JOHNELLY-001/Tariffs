import { query } from './database.js';

/**
 * Schema capability probe.
 *
 * The live database is authoritative. The documented baseline is used as a
 * starting point only: columns added later (`heading`), planned relationship
 * columns (`cet_tariffs.chapter_code`, `cet_chapter_notes.section_code`) and
 * optional extensions are all discovered at runtime. Repositories ask
 * `hasColumn()` instead of assuming.
 */

export interface SchemaCapabilities {
  /** Column names present per table, lower-cased. */
  columns: Record<string, string[]>;
  /** cet_tariffs.chapter_code — verified tariff→chapter relationship. */
  tariffChapterCodeColumn: boolean;
  /** cet_chapter_notes.section_code — verified chapter→section relationship. */
  chapterSectionCodeColumn: boolean;
  /** cet_subheading_notes ownership CHECK constraint. */
  subheadingOwnerConstraint: boolean;
  /** pg_trgm available for partial matching. */
  trigramExtension: boolean;
  /** unaccent available for accent-insensitive matching. */
  unaccentExtension: boolean;
  probedAt: string;
}

const CACHE_TTL_MS = 60_000;
const INSPECTED_TABLES = [
  'cet_tariffs',
  'cet_section_notes',
  'cet_chapter_notes',
  'cet_subheading_notes',
] as const;

let cached: { value: SchemaCapabilities; expiresAt: number } | undefined;
let inFlight: Promise<SchemaCapabilities> | undefined;

interface ColumnRow {
  table_name: string;
  column_name: string;
}

interface ExtensionRow {
  extname: string;
}

interface ConstraintRow {
  constraint_name: string;
}

async function probe(): Promise<SchemaCapabilities> {
  const [columns, extensions, constraints] = await Promise.all([
    query<ColumnRow>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position`,
      [INSPECTED_TABLES],
    ),
    query<ExtensionRow>(`SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')`),
    query<ConstraintRow>(
      `SELECT constraint_name
         FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'cet_subheading_notes'
          AND constraint_type = 'CHECK'`,
    ),
  ]);

  const columnMap: Record<string, string[]> = {};
  for (const row of columns.rows) {
    const list = (columnMap[row.table_name] ??= []);
    list.push(row.column_name.toLowerCase());
  }

  const has = (table: string, column: string) => columnMap[table]?.includes(column) ?? false;
  const extensionNames = new Set(extensions.rows.map((row) => row.extname));

  return {
    columns: columnMap,
    tariffChapterCodeColumn: has('cet_tariffs', 'chapter_code'),
    chapterSectionCodeColumn: has('cet_chapter_notes', 'section_code'),
    subheadingOwnerConstraint: constraints.rows.some((row) =>
      row.constraint_name.toLowerCase().includes('subheading_note_owner'),
    ),
    trigramExtension: extensionNames.has('pg_trgm'),
    unaccentExtension: extensionNames.has('unaccent'),
    probedAt: new Date().toISOString(),
  };
}

export async function getSchemaCapabilities(): Promise<SchemaCapabilities> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  if (!inFlight) {
    inFlight = probe()
      .then((value) => {
        cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = undefined;
      });
  }

  return inFlight;
}

export function hasColumn(capabilities: SchemaCapabilities, table: string, column: string): boolean {
  return capabilities.columns[table]?.includes(column) ?? false;
}

/** Test hook: drop cached capabilities. */
export function resetSchemaCapabilitiesCache(): void {
  cached = undefined;
}
