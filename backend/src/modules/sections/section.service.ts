import { notFound } from '../../shared/errors/app-error.js';
import { getSchemaCapabilities } from '../../config/schema-capabilities.js';
import type { PageRequest } from '../../shared/http/pagination.js';
import * as chapterRepository from '../chapters/chapter.repository.js';
import type { ChapterRecord } from '../chapters/chapter.types.js';
import * as sectionRepository from './section.repository.js';
import type { SectionRecord } from './section.types.js';

export interface SectionDetail {
  section: SectionRecord;
  chapters: ChapterRecord[] | null;
  chapterCount: number | null;
  contextComplete: boolean;
  warnings: string[];
}

export async function listSections(page: PageRequest): Promise<{ items: SectionRecord[]; total: number }> {
  return sectionRepository.list(page.pageSize, page.offset);
}

export async function getSection(sectionCode: string): Promise<SectionDetail> {
  const capabilities = await getSchemaCapabilities();
  const section = await sectionRepository.findByCode(sectionCode);
  if (!section) {
    throw notFound(`No section record matches section code ${sectionCode}`);
  }

  const chapters = await chapterRepository.listBySection(section.sectionCode);
  const warnings: string[] = [];

  if (chapters === null) {
    warnings.push(
      'CHAPTER_MAPPING_NOT_VERIFIED: chapter-to-section mapping has not been applied to the database, so chapter membership cannot be listed.',
    );
  }
  if (!section.sectionNotes) {
    warnings.push('SECTION_NOTES_MISSING: the source contains no section notes for this section.');
  }
  if (!capabilities.chapterSectionCodeColumn) {
    warnings.push('SECTION_CODE_COLUMN_MISSING: cet_chapter_notes.section_code does not exist yet (pending approved migration).');
  }

  return {
    section,
    chapters,
    chapterCount: chapters === null ? null : chapters.length,
    contextComplete: chapters !== null,
    warnings,
  };
}
