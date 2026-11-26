<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, RefreshCw, Search, SearchX } from '@lucide/vue';
import EmptyState from '@/components/common/EmptyState.vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import PageContainer from '@/components/common/PageContainer.vue';
import TariffDetailDrawer from '@/components/tariffs/TariffDetailDrawer.vue';
import TariffPagination from '@/components/tariffs/TariffPagination.vue';
import TariffResults from '@/components/tariffs/TariffResults.vue';
import TariffSearchForm from '@/components/tariffs/TariffSearchForm.vue';
import { useTariffDetail } from '@/composables/useTariffDetail';
import { useTariffSearch } from '@/composables/useTariffSearch';
import { useCalculatorStore } from '@/stores/calculator';
import type { TariffView } from '@/types/api';

const route = useRoute();
const router = useRouter();
const calculatorStore = useCalculatorStore();

const isSelectionMode = computed(() => route.query.intent === 'calculator');
const selectedTariffId = computed(() => calculatorStore.selectedTariff?.id ?? null);

const {
  query,
  submittedQuery,
  status,
  source,
  rows,
  pagination,
  lookup,
  errorMessage,
  inputError,
  isLoading,
  hasSearched,
  duplicates,
  submit,
  goToPage,
  retry,
  clear,
} = useTariffSearch();

const {
  isOpen: detailOpen,
  isLoading: detailLoading,
  errorMessage: detailError,
  contextError: detailContextError,
  tariff: detailTariff,
  context: detailContext,
  show: showTariffDetail,
  retry: retryDetail,
  close: closeDetail,
} = useTariffDetail();

const initialCode = typeof route.query.q === 'string' ? route.query.q.trim() : '';
if (isSelectionMode.value && initialCode) {
  query.value = initialCode;
  submit();
}

watch(
  () => route.query.q,
  (value) => {
    if (!isSelectionMode.value) return;
    const next = typeof value === 'string' ? value.trim() : '';
    if (!next || next === query.value.trim()) return;
    query.value = next;
    submit();
  },
);

function useTariff(tariff: TariffView): void {
  calculatorStore.selectTariff(tariff);
  void router.push({ name: 'calculator' });
}

function backToCalculator(): void {
  void router.push({ name: 'calculator' });
}

const resultSummary = computed(() => {
  if (isLoading.value) return `Searching for ${submittedQuery.value}…`;
  if (status.value === 'error') return `Search for ${submittedQuery.value} could not be completed.`;
  if (status.value === 'empty') return `No records matched ${submittedQuery.value}.`;

  const total =
    source.value === 'exact' ? rows.value.length : (pagination.value?.total ?? rows.value.length);
  const noun = total === 1 ? 'record' : 'records';

  if (source.value === 'exact') return `${total} ${noun} found for this HS code.`;

  const pageText = pagination.value
    ? ` · page ${pagination.value.page} of ${Math.max(1, pagination.value.totalPages)}`
    : '';
  return `${total} ${noun} for ${submittedQuery.value}${pageText}.`;
});

/** One concise ambiguity note instead of several overlapping panels. */
const ambiguityNote = computed(() => {
  if (lookup.value?.ambiguous) {
    return `${rows.value.length} records share this HS code. Compare schedule and rate before choosing. No record is selected automatically.`;
  }
  if (duplicates.value.length > 0) {
    return 'Some HS codes appear more than once on this page. Compare schedule and rate before choosing. No record is selected automatically.';
  }
  return null;
});

function inspect(id: number): void {
  void showTariffDetail(id);
}
</script>

<template>
  <PageContainer>
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-2xl">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {{ isSelectionMode ? 'Selection mode' : 'Reference data' }}
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {{ isSelectionMode ? 'Choose a tariff record' : 'Tariff Explorer' }}
        </h2>
        <p class="mt-2 text-sm leading-6 text-ink-muted">
          <template v-if="isSelectionMode">
            Search by HS code or product description, then choose the exact record for your
            calculation. Nothing is chosen automatically.
          </template>
          <template v-else>
            Find tariff lines by HS code or product description. Every matching record is listed
            with its schedule and recorded rate.
          </template>
        </p>
      </div>

      <button v-if="isSelectionMode" type="button" class="btn-secondary" @click="backToCalculator">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Back to calculator
      </button>
    </header>

    <div
      v-if="isSelectionMode"
      class="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted"
    >
      <template v-if="calculatorStore.selectedTariff">
        Currently selected:
        <span class="font-mono font-semibold text-ink">
          {{ calculatorStore.selectedTariff.hsCode }}
        </span>
        · record #{{ calculatorStore.selectedTariff.id }}
      </template>
      <template v-else>No record is selected yet. Nothing is chosen automatically.</template>
    </div>

    <section class="surface-card px-5 py-5 sm:px-6">
      <TariffSearchForm
        v-model="query"
        :loading="isLoading"
        :input-error="inputError"
        :can-clear="hasSearched || query.length > 0"
        @submit="submit"
        @clear="clear"
      />
    </section>

    <section v-if="hasSearched" class="surface-card overflow-hidden">
      <header class="border-b border-line px-5 py-4 sm:px-6">
        <h2 class="text-base font-semibold tracking-tight text-ink">Results</h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">{{ resultSummary }}</p>
      </header>

      <div class="space-y-4 px-5 py-5 sm:px-6">
        <div v-if="status === 'error'" class="space-y-3">
          <InlineNotice tone="warning" title="Search could not be completed">
            {{ errorMessage }}
          </InlineNotice>
          <button type="button" class="btn-secondary" @click="retry">
            <RefreshCw class="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>

        <EmptyState
          v-else-if="status === 'empty'"
          :icon="SearchX"
          title="No tariff records matched"
          description="Try a shorter HS-code prefix or a different product description."
        >
          <template #actions>
            <button type="button" class="btn-secondary" @click="clear">Clear search</button>
          </template>
        </EmptyState>

        <template v-else>
          <p
            v-if="ambiguityNote"
            class="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink"
          >
            {{ ambiguityNote }}
          </p>

          <TariffResults
            :items="rows"
            :loading="isLoading"
            :selectable="isSelectionMode"
            :selected-id="selectedTariffId"
            @inspect="inspect"
            @select="useTariff"
          />

          <TariffPagination
            v-if="source === 'search' && pagination"
            :pagination="pagination"
            @change="goToPage"
          />
        </template>
      </div>
    </section>

    <section v-else class="surface-card px-5 py-8 text-center sm:px-6">
      <Search class="mx-auto h-5 w-5 text-ink-subtle" aria-hidden="true" />
      <p class="mt-3 text-sm font-semibold text-ink">Search the tariff schedule</p>
      <p class="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-muted">
        Enter a full or partial HS code or a product description. Examples:
        <span class="font-mono text-ink">8471.30</span> ·
        <span class="font-mono text-ink">0901</span> ·
        <span class="text-ink">rice</span>
      </p>
    </section>

    <TariffDetailDrawer
      :open="detailOpen"
      :loading="detailLoading"
      :error-message="detailError"
      :context-error="detailContextError"
      :tariff="detailTariff"
      :context="detailContext"
      :selectable="isSelectionMode"
      @close="closeDetail"
      @retry="retryDetail"
      @select="useTariff"
    />
  </PageContainer>
</template>
