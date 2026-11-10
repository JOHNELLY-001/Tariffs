import { notFound, unsupportedOperation } from '../../shared/errors/app-error.js';
import { getSchemaCapabilities } from '../../config/schema-capabilities.js';
import type { PageRequest } from '../../shared/http/pagination.js';
import { normalizeChapterCode } from '../../shared/utils/codes.js';
import * as sectionRepository from '../sections/section.repository.js';
import type { SectionRecord } from '../sections/section.types.js';
import * as tariffRepository from '../tariffs/tariff.repository.js';
import * as chapterRepository from './chapter.repository.js';
import type { ChapterRecord } from './chapter.types.js';

export interface ChapterDetail {
  chapter: ChapterRecord;
  section: SectionRecord | null;
  tariffCount: number;
  contextComplete: boolean;
  warnings: string[];
}

export async function listChapters(
  page: PageRequest,
  sectionCode?: string,
): Promise<{ items: ChapterRecord[]; total: number }> {
  if (sectionCode) {
    const capabilities = await getSchemaCapabilities();
    if (!capabilities.chapterSectionCodeColumn) {
      throw unsupportedOperation(
        'Filtering chapters by section requires the verified chapter-to-section mapping, which has not been applied to the database yet.',
        [
          {
            path: 'section_code',
            message: 'cet_chapter_notes.section_code does not exist (pending approved migration M2).',
          },
        ],
      );
    }
  }

  return chapterRepository.list(page.pageSize, page.offset, sectionCode ?? null);
}

export async function getChapter(rawCode: string): Promise<ChapterDetail> {
  const capabilities = await getSchemaCapabilities();
  const chapterCode = normalizeChapterCode(rawCode);
  const chapter = await chapterRepository.findByCode(chapterCode);

  if (!chapter) {
    throw notFound(`No chapter record matches chapter code ${chapterCode}`);
  }

  const [section, tariffCount] = await Promise.all([
    chapter.sectionCode ? sectionRepository.findByCode(chapter.sectionCode) : Promise.resolve(null),
    tariffRepository.countByChapter(chapterCode),
  ]);

  const warnings: string[] = [];
  if (!capabilities.chapterSectionCodeColumn) {
    warnings.push(
      'SECTION_MAPPING_NOT_VERIFIED: chapter-to-section mapping has not been applied to the database, so section context is unavailable.',
    );
  } else if (!chapter.sectionCode) {
    warnings.push('SECTION_ASSOCIATION_MISSING: the chapter has no verified section association.');
  }
  if (chapter.chapterNotes === null) {
    warnings.push('CHAPTER_NOTES_MISSING: the source contains no chapter notes for this chapter.');
  }
  if (!capabilities.tariffChapterCodeColumn) {
    warnings.push(
      'TARIFF_COUNT_DERIVED: tariff count was derived from the normalized HS code because no verified chapter_code column exists yet.',
    );
  }

  return {
    chapter,
    section,
    tariffCount,
    contextComplete: Boolean(section),
    warnings,
  };
}
