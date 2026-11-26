import type {
  ApiEnvelope,
  ChapterDetail,
  ChapterRecord,
  ClassificationContext,
  HsCodeNormalization,
  ImportCostRequest,
  ImportCostResult,
  PaginationMeta,
  SearchItem,
  SearchQueryMeta,
  SearchResult,
  SectionDetail,
  SectionRecord,
  TariffView,
  TariffLookupData,
} from '@/types/api';
import { apiClient, unwrap, type ApiResult } from './client';

/**
 * Typed endpoint helpers. Screens call these; they never assemble URLs or
 * infer duty/tax values locally.
 */

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface SearchParams extends PageParams {
  q: string;
  chapter_code?: string;
  schedule_type?: string;
}

export interface ListResult<T> {
  items: T[];
  pagination: PaginationMeta | null;
}

function paginationOf(meta: Record<string, unknown>): PaginationMeta | null {
  const value = meta.pagination;
  if (!value || typeof value !== 'object') return null;
  return value as PaginationMeta;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function queryMetaOf(meta: Record<string, unknown>): SearchQueryMeta | null {
  const value = meta.query;
  if (!value || typeof value !== 'object') return null;

  const query = value as Record<string, unknown>;
  if (typeof query.text !== 'string' || typeof query.normalizedCode !== 'string') return null;

  return {
    text: query.text,
    normalizedCode: query.normalizedCode,
    chapterCode: typeof query.chapterCode === 'string' ? query.chapterCode : null,
    scheduleType: typeof query.scheduleType === 'string' ? query.scheduleType : null,
  };
}

function normalizationOf(meta: Record<string, unknown>): HsCodeNormalization | null {
  const value = meta.normalization;
  if (!value || typeof value !== 'object') return null;

  const normalization = value as Record<string, unknown>;
  if (typeof normalization.input !== 'string' || typeof normalization.normalized !== 'string') {
    return null;
  }

  return {
    input: normalization.input,
    normalized: normalization.normalized,
    chapter: typeof normalization.chapter === 'string' ? normalization.chapter : null,
  };
}

function schedulesOf(value: unknown): Array<string | null> {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === 'string' ? entry : null));
}

export async function searchTariffs(params: SearchParams): Promise<ApiResult<SearchResult>> {
  const result = await unwrap(
    apiClient.get<ApiEnvelope<{ items: SearchItem[] }>>('/search', { params }),
  );

  return {
    data: {
      items: result.data.items,
      pagination: paginationOf(result.meta),
      query: queryMetaOf(result.meta),
      warnings: stringArray(result.meta.warnings),
    },
    meta: result.meta,
  };
}

export async function getTariffByHsCode(code: string): Promise<ApiResult<TariffLookupData>> {
  const result = await unwrap(
    apiClient.get<ApiEnvelope<{ matches: TariffView[] }>>(
      `/tariffs/hs/${encodeURIComponent(code)}`,
    ),
  );

  return {
    data: {
      matches: result.data.matches,
      ambiguous: result.meta.ambiguous === true,
      schedules: schedulesOf(result.meta.schedules),
      normalization: normalizationOf(result.meta),
      notes: stringArray(result.meta.notes),
      disclaimer: typeof result.meta.disclaimer === 'string' ? result.meta.disclaimer : null,
    },
    meta: result.meta,
  };
}

export function getTariffById(id: number): Promise<ApiResult<TariffView>> {
  return unwrap(apiClient.get(`/tariffs/${id}`));
}

export function getTariffContext(id: number): Promise<ApiResult<ClassificationContext>> {
  return unwrap(apiClient.get(`/tariffs/${id}/notes`));
}

export async function listChapterTariffs(
  chapterCode: string,
  params: PageParams = {},
): Promise<ApiResult<ListResult<TariffView>>> {
  const result = await unwrap(
    apiClient.get<ApiEnvelope<{ items: TariffView[] }>>(
      `/chapters/${encodeURIComponent(chapterCode)}/tariffs`,
      { params },
    ),
  );
  return {
    data: { items: result.data.items, pagination: paginationOf(result.meta) },
    meta: result.meta,
  };
}

export async function listSections(params: PageParams = {}): Promise<ApiResult<ListResult<SectionRecord>>> {
  const result = await unwrap(
    apiClient.get<ApiEnvelope<{ items: SectionRecord[] }>>('/sections', { params }),
  );
  return {
    data: { items: result.data.items, pagination: paginationOf(result.meta) },
    meta: result.meta,
  };
}

export function getSection(code: string): Promise<ApiResult<SectionDetail>> {
  return unwrap(apiClient.get(`/sections/${encodeURIComponent(code)}`));
}

export async function listChapters(
  params: PageParams & { section_code?: string } = {},
): Promise<ApiResult<ListResult<ChapterRecord>>> {
  const result = await unwrap(
    apiClient.get<ApiEnvelope<{ items: ChapterRecord[] }>>('/chapters', { params }),
  );
  return {
    data: { items: result.data.items, pagination: paginationOf(result.meta) },
    meta: result.meta,
  };
}

export function getChapter(code: string): Promise<ApiResult<ChapterDetail>> {
  return unwrap(apiClient.get(`/chapters/${encodeURIComponent(code)}`));
}

export function calculateImportCost(input: ImportCostRequest): Promise<ApiResult<ImportCostResult>> {
  return unwrap(apiClient.post('/calculations/import-cost', input));
}

export function getCalculation(calculationId: string): Promise<ApiResult<ImportCostResult>> {
  return unwrap(apiClient.get(`/calculations/import-cost/${encodeURIComponent(calculationId)}`));
}
