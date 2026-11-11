import { notFound } from '../../shared/errors/app-error.js';
import { chapterFromStoredCode, normalizeHsCode } from '../../shared/utils/hs-code.js';
import { normalizeChapterCode, normalizeSectionCode } from '../../shared/utils/codes.js';
import { getSchemaCapabilities } from '../../config/schema-capabilities.js';
import * as chapterRepository from '../chapters/chapter.repository.js';
import type { ChapterRecord } from '../chapters/chapter.types.js';
import * as sectionRepository from '../sections/section.repository.js';
import type { SectionRecord } from '../sections/section.types.js';
import { toTariffView, type TariffView } from '../tariffs/tariff.service.js';
import * as tariffRepository from '../tariffs/tariff.repository.js';
import * as noteRepository from './note.repository.js';
import type { SubheadingNoteRecord } from './note.types.js';
import type { PaginationQuery } from '../../shared/http/pagination.js';

/**
 * Classification context.
 *
 * A tariff line is linked to its chapter (derived from the validated HS code,
 * which the specification permits) and its section (only through a verified
 * chapter→section mapping). Notes are fetched in a single bounded query.
 * Anything unverified is reported, never fabricated.
 */

export const CONTEXT_DISCLAIMER =
  'Classification context is provided for reference. It is not a customs classification ruling.';

export interface ClassificationContext {
  tariff: TariffView;
  chapter: ChapterRecord | null;
  section: SectionRecord | null;
  subheadingNotes: SubheadingNoteRecord[];
  /**
   * When the main-schedule rate is `SI`, the Sensitive Items schedule rows that
   * share this HS code. A factual cross-reference — not a substitution.
   */
  sensitiveItemsReference: {
    reason: string;
    matches: TariffView[];
  } | null;
  contextComplete: boolean;
  chapterSource: 'verified_column' | 'derived_from_hs_code' | 'none';
  warnings: string[];
  disclaimer: string;
}

const MAX_CONTEXT_NOTES = 100;
const MAX_SENSITIVE_ITEM_MATCHES = 5;
const SENSITIVE_ITEMS_SCHEDULE = 'SENSITIVE_ITEMS';

export async function getTariffContext(tariffId: number): Promise<ClassificationContext> {
  const capabilities = await getSchemaCapabilities();

  const tariffRecord = await tariffRepository.findById(tariffId);
  if (!tariffRecord) {
    throw notFound(`No tariff record exists with id ${tariffId}`);
  }

  const verifiedChapter = tariffRecord.chapterCode ?? null;
  const derivedChapter = chapterFromStoredCode(tariffRecord.hsCode);
  const chapterCode = verifiedChapter ?? derivedChapter;
  const chapterSource: ClassificationContext['chapterSource'] = verifiedChapter
    ? 'verified_column'
    : derivedChapter
      ? 'derived_from_hs_code'
      : 'none';

  const tariff = toTariffView(tariffRecord);
  const normalizedCode = normalizeHsCode(tariffRecord.hsCode);

  // A main-schedule `SI` rate points at Sensitive Items treatment. The matching
  // SI-schedule rows are looked up as a factual cross-reference; the original
  // rate text is never reinterpreted and no row is substituted.
  const isSensitiveItemRate = tariff.rateAnalysis.isSensitiveItem;
  const isSensitiveItemsScheduleRow = tariff.scheduleType === SENSITIVE_ITEMS_SCHEDULE;
  const needsSensitiveItemsLookup =
    isSensitiveItemRate && !isSensitiveItemsScheduleRow && normalizedCode.isValid;

  // Bounded, parallel context retrieval — five queries at most, never one per note.
  const chapter = chapterCode
    ? await chapterRepository.findByCode(normalizeChapterCode(chapterCode))
    : null;

  const sectionCode = chapter?.sectionCode ?? null;
  const [section, subheadingNotes, sensitiveItemsMatches] = await Promise.all([
    sectionCode ? sectionRepository.findByCode(normalizeSectionCode(sectionCode)) : Promise.resolve(null),
    noteRepository.findForClassification(chapterCode, sectionCode, MAX_CONTEXT_NOTES),
    needsSensitiveItemsLookup
      ? tariffRepository.findByNormalizedHsCodeAndSchedule(
          normalizedCode.normalized,
          SENSITIVE_ITEMS_SCHEDULE,
          MAX_SENSITIVE_ITEM_MATCHES,
        )
      : Promise.resolve([]),
  ]);

  const sensitiveItemsReference =
    isSensitiveItemRate && !isSensitiveItemsScheduleRow
      ? {
          reason:
            'The stored rate text is an SI (Sensitive Items) reference. The SENSITIVE_ITEMS schedule entries sharing this HS code are listed for reference only; no rate is inferred.',
          matches: sensitiveItemsMatches.map(toTariffView),
        }
      : null;

  const warnings: string[] = [];
  if (!capabilities.tariffChapterCodeColumn) {
    warnings.push(
      'TARIFF_CHAPTER_LINK_DERIVED: the chapter was derived from the validated HS code because no verified chapter_code column exists yet.',
    );
  }
  if (!chapter) {
    warnings.push('CHAPTER_NOT_FOUND: no chapter record matches this tariff line.');
  }
  if (!capabilities.chapterSectionCodeColumn) {
    warnings.push(
      'SECTION_MAPPING_NOT_VERIFIED: chapter-to-section mapping has not been applied to the database, so section context is unavailable.',
    );
  } else if (chapter && !section) {
    warnings.push('SECTION_ASSOCIATION_MISSING: the chapter has no verified section association.');
  }
  if (chapter && chapter.chapterNotes === null) {
    warnings.push('CHAPTER_NOTES_MISSING: the source contains no chapter notes for this chapter.');
  }
  if (!capabilities.subheadingOwnerConstraint) {
    warnings.push(
      'SUBHEADING_OWNERSHIP_CONSTRAINT_MISSING: subheading-note ownership is derived from populated columns only.',
    );
  }
  if (subheadingNotes.length === 0) {
    warnings.push('NO_SUBHEADING_NOTES: no subheading guidance is recorded for this chapter or section.');
  }
  if (isSensitiveItemRate && isSensitiveItemsScheduleRow) {
    warnings.push(
      'SENSITIVE_ITEMS_SCHEDULE_ROW: this record is itself from the SENSITIVE_ITEMS schedule, so the SI rate belongs to this entry.',
    );
  }
  if (needsSensitiveItemsLookup && sensitiveItemsMatches.length === 0) {
    warnings.push(
      'SENSITIVE_ITEMS_ENTRY_NOT_FOUND: the rate references Sensitive Items treatment, but no SENSITIVE_ITEMS schedule record shares this HS code.',
    );
  }

  return {
    tariff,
    chapter,
    section,
    subheadingNotes,
    sensitiveItemsReference,
    contextComplete: Boolean(chapter && section),
    chapterSource,
    warnings,
    disclaimer: CONTEXT_DISCLAIMER,
  };
}

export async function listSubheadingNotes(
  filters: { chapterCode?: string; sectionCode?: string; reference?: string },
  pagination: PaginationQuery,
): Promise<{ items: SubheadingNoteRecord[]; total: number }> {
  const limit = pagination.pageSize;
  const offset = (pagination.page - 1) * limit;

  return noteRepository.list(
    {
      chapterCode: filters.chapterCode ? normalizeChapterCode(filters.chapterCode) : null,
      sectionCode: filters.sectionCode ? normalizeSectionCode(filters.sectionCode) : null,
      reference: filters.reference ?? null,
    },
    limit,
    offset,
  );
}
