import { computed, ref, watch } from 'vue';
import { ApiError } from '@/services/api/client';
import { getTariffByHsCode, searchTariffs } from '@/services/api/endpoints';
import type { MatchType, PaginationMeta, TariffView } from '@/types/api';

/**
 * Tariff search orchestration.
 *
 * A query is only sent on explicit submit — never while the user types. Pure
 * code queries with at least four digits are first resolved through the exact
 * HS-code endpoint; a 404 falls back to the paginated search endpoint, which
 * also supports code prefixes and descriptions.
 */

const PAGE_SIZE = 20;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 120;
const EXACT_LOOKUP_MIN_DIGITS = 4;

export interface TariffSearchRow extends TariffView {
  /** Null when the row came from the exact HS-code endpoint. */
  matchType: MatchType | null;
  relevance: number | null;
}

export interface TariffLookupSummary {
  ambiguous: boolean;
  schedules: Array<string | null>;
  normalizedCode: string | null;
  notes: string[];
  disclaimer: string | null;
}

export type TariffSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
export type TariffSearchSource = 'exact' | 'search' | null;

export interface DuplicateCodeGroup {
  hsCode: string;
  count: number;
}

function digitsOf(value: string): string | null {
  if (!/^[0-9.\s\-/]+$/.test(value)) return null;

  const digits = value.replace(/\D/g, '');
  if (digits.length < MIN_QUERY_LENGTH || digits.length > 12) return null;
  return digits;
}

export function useTariffSearch() {
  const query = ref('');
  const submittedQuery = ref('');
  const status = ref<TariffSearchStatus>('idle');
  const source = ref<TariffSearchSource>(null);
  const rows = ref<TariffSearchRow[]>([]);
  const pagination = ref<PaginationMeta | null>(null);
  const warnings = ref<string[]>([]);
  const lookup = ref<TariffLookupSummary | null>(null);
  const errorMessage = ref<string | null>(null);
  const inputError = ref<string | null>(null);
  const lastPage = ref(1);

  // Monotonic token: only the latest request may write state.
  let sequence = 0;

  const isLoading = computed(() => status.value === 'loading');
  const hasSearched = computed(() => status.value !== 'idle');
  const hasResults = computed(() => rows.value.length > 0);

  const duplicates = computed<DuplicateCodeGroup[]>(() => {
    const counts = new Map<string, number>();
    for (const row of rows.value) {
      const code = row.hsCode.trim();
      if (!code) continue;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([hsCode, count]) => ({ hsCode, count }));
  });

  const isAmbiguous = computed(
    () => lookup.value?.ambiguous === true || duplicates.value.length > 0,
  );

  watch(query, () => {
    if (inputError.value) inputError.value = null;
  });

  function resetResults(): void {
    rows.value = [];
    pagination.value = null;
    warnings.value = [];
    lookup.value = null;
    errorMessage.value = null;
  }

  async function runSearch(page = 1): Promise<void> {
    const text = query.value.trim().slice(0, MAX_QUERY_LENGTH);
    inputError.value = null;

    if (text.length < MIN_QUERY_LENGTH) {
      inputError.value = `Enter at least ${MIN_QUERY_LENGTH} characters to search the tariff schedule.`;
      return;
    }

    const attempt = ++sequence;
    status.value = 'loading';
    submittedQuery.value = text;
    lastPage.value = page;
    source.value = null;
    resetResults();

    try {
      const digits = digitsOf(text);

      if (page === 1 && digits !== null && digits.length >= EXACT_LOOKUP_MIN_DIGITS) {
        try {
          const result = await getTariffByHsCode(text);
          if (attempt !== sequence) return;

          source.value = 'exact';
          rows.value = result.data.matches.map((match) => ({
            ...match,
            matchType: null,
            relevance: null,
          }));
          lookup.value = {
            ambiguous: result.data.ambiguous,
            schedules: result.data.schedules,
            normalizedCode: result.data.normalization?.normalized ?? null,
            notes: result.data.notes,
            disclaimer: result.data.disclaimer,
          };
          warnings.value = result.data.notes;
          status.value = rows.value.length > 0 ? 'success' : 'empty';
          return;
        } catch (error) {
          // A valid code may exist only as a prefix (for example a heading with
          // no exact line). Fall back to the search endpoint for that case.
          if (!(error instanceof ApiError) || error.status !== 404) throw error;
        }
      }

      const result = await searchTariffs({ q: text, page, pageSize: PAGE_SIZE });
      if (attempt !== sequence) return;

      source.value = 'search';
      rows.value = result.data.items.map((item) => ({ ...item }));
      pagination.value = result.data.pagination;
      warnings.value = result.data.warnings;
      status.value = rows.value.length > 0 ? 'success' : 'empty';
    } catch (error) {
      if (attempt !== sequence) return;

      status.value = 'error';
      errorMessage.value =
        error instanceof ApiError
          ? error.message
          : 'An unexpected error occurred while searching the tariff schedule.';
      rows.value = [];
      pagination.value = null;
      source.value = null;
    }
  }

  function submit(): void {
    void runSearch(1);
  }

  function goToPage(page: number): void {
    if (status.value === 'loading' || !pagination.value) return;

    const totalPages = Math.max(1, pagination.value.totalPages);
    const target = Math.min(Math.max(1, page), totalPages);
    if (target === pagination.value.page) return;

    void runSearch(target);
  }

  function retry(): void {
    void runSearch(lastPage.value);
  }

  function clear(): void {
    sequence += 1;
    query.value = '';
    submittedQuery.value = '';
    status.value = 'idle';
    source.value = null;
    lastPage.value = 1;
    inputError.value = null;
    resetResults();
  }

  return {
    query,
    submittedQuery,
    status,
    source,
    rows,
    pagination,
    warnings,
    lookup,
    errorMessage,
    inputError,
    isLoading,
    hasSearched,
    hasResults,
    duplicates,
    isAmbiguous,
    submit,
    goToPage,
    retry,
    clear,
  };
}
