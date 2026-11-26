<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BookOpen, RefreshCw, Search, SearchX } from '@lucide/vue';
import BaseCard from '@/components/common/BaseCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import PageContainer from '@/components/common/PageContainer.vue';
import TariffDetailDrawer from '@/components/tariffs/TariffDetailDrawer.vue';
import TariffPagination from '@/components/tariffs/TariffPagination.vue';
import TariffResults from '@/components/tariffs/TariffResults.vue';
import TariffSearchForm from '@/components/tariffs/TariffSearchForm.vue';
import WarningList from '@/components/tariffs/WarningList.vue';
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
  warnings,
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
  if (isLoading.value) return `Searching for “${submittedQuery.value}”…`;
  if (status.value === 'error') {
    return `The search for “${submittedQuery.value}” could not be completed.`;
  }
  if (status.value === 'empty') return `No records matched “${submittedQuery.value}”.`;

  const total =
    source.value === 'exact' ? rows.value.length : (pagination.value?.total ?? rows.value.length);
  const noun = total === 1 ? 'record' : 'records';

  if (source.value === 'exact') {
    return `${total} exact HS-code ${noun} for “${submittedQuery.value}”.`;
  }

  const pageText = pagination.value
    ? ` · page ${pagination.value.page} of ${Math.max(1, pagination.value.totalPages)}`
    : '';
  return `${total} ${noun} for “${submittedQuery.value}”${pageText}.`;
});

const lookupScheduleText = computed(() =>
  (lookup.value?.schedules ?? [])
    .map((schedule) => schedule ?? 'Schedule not recorded')
    .join(', '),
);

function inspect(id: number): void {
  void showTariffDetail(id);
}
</script>

<template>
  <PageContainer>
    <InlineNotice
      v-if="isSelectionMode"
      tone="info"
      title="Selecting a tariff for your import calculation"
    >
      <p>
        Choose <span class="font-semibold text-ink">Use this tariff</span> on a result row or in the
        detail drawer. Your calculator draft is preserved; only the selected record ID and HS code
        are carried back.
      </p>
      <p v-if="calculatorStore.selectedTariff" class="mt-2">
        Currently selected:
        <span class="font-mono font-semibold text-ink">
          {{ calculatorStore.selectedTariff.hsCode }}
        </span>
        · record #{{ calculatorStore.selectedTariff.id }}
      </p>
      <p v-else class="mt-2">No record is selected yet. Nothing is chosen automatically.</p>
      <button type="button" class="btn-secondary mt-3" @click="backToCalculator">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Back to calculator
      </button>
    </InlineNotice>

    <section class="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <div class="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-center">
        <div class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
          >
            <BookOpen class="h-3.5 w-3.5" aria-hidden="true" />
            {{ isSelectionMode ? 'Selection mode · returns to calculator' : 'Reference data · no tax calculation' }}
          </span>

          <h2 class="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {{
              isSelectionMode
                ? 'Choose the tariff record for your calculation'
                : 'Search the CET tariff schedule'
            }}
          </h2>
          <p class="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
            <template v-if="isSelectionMode">
              Search by HS code or product description. Every matching record is listed with its
              schedule and original rate. You must choose the record explicitly; the explorer never
              selects one for you.
            </template>
            <template v-else>
              Find tariff lines by HS code or product description. When an HS code belongs to more
              than one record, every candidate is listed with its schedule and original rate text.
              Nothing is selected automatically.
            </template>
          </p>
        </div>

      </div>
    </section>

    <BaseCard
      title="Tariff search"
      description="Search is explicit: type your query, then press Enter or choose Search."
    >
      <TariffSearchForm
        v-model="query"
        :loading="isLoading"
        :input-error="inputError"
        :can-clear="hasSearched || query.length > 0"
        @submit="submit"
        @clear="clear"
      />

      <div class="mt-4 rounded-lg border border-line bg-surface-muted/50 px-4 py-3">
        <p class="text-xs leading-5 text-ink-muted">
          Rates are presented exactly as recorded in the source schedule. This screen does not
          calculate customs duty, excise, VAT or any other import charge.
        </p>
      </div>
    </BaseCard>

    <BaseCard
      v-if="hasSearched"
      title="Search results"
      :description="resultSummary"
    >
      <div class="space-y-4">
        <div v-if="status === 'error'" class="space-y-4">
          <InlineNotice tone="warning" title="Search could not be completed">
            {{ errorMessage }}
          </InlineNotice>
          <button type="button" class="btn-secondary" @click="retry">
            <RefreshCw class="h-4 w-4" aria-hidden="true" />
            Retry search
          </button>
        </div>

        <EmptyState
          v-else-if="status === 'empty'"
          :icon="SearchX"
          title="No tariff records matched"
          :description="`Nothing matched “${submittedQuery}”. Try a shorter HS-code prefix or a different product description. Only recorded tariff descriptions are searched.`"
        >
          <template #actions>
            <button type="button" class="btn-secondary" @click="clear">
              Clear search
            </button>
          </template>
        </EmptyState>

        <template v-else>
          <InlineNotice
            v-if="lookup?.ambiguous"
            tone="warning"
            title="Multiple tariff records share this HS code"
          >
            <p>
              The exact HS-code lookup for
              <span class="font-mono font-semibold text-ink">
                {{ lookup.normalizedCode ?? submittedQuery }}
              </span>
              returned {{ rows.length }} records. All of them are listed below; none has been
              selected automatically.
            </p>
            <p v-if="lookupScheduleText" class="mt-2">
              Schedules present:
              <span class="font-semibold text-ink">{{ lookupScheduleText }}</span>.
            </p>
            <p v-for="note in lookup.notes" :key="note" class="mt-2">{{ note }}</p>
            <p class="mt-2">
              Compare schedule, original rate text and source page before using a tariff line in
              any later calculation.
            </p>
          </InlineNotice>

          <InlineNotice
            v-else-if="duplicates.length > 0"
            tone="warning"
            title="Repeated HS codes in these results"
          >
            <p>
              Some HS codes appear more than once on this result page. Every record is shown with
              its own schedule and rate text.
            </p>
            <ul class="mt-2 space-y-1">
              <li v-for="group in duplicates" :key="group.hsCode">
                <span class="font-mono font-semibold text-ink">{{ group.hsCode }}</span>
                — {{ group.count }} records
              </li>
            </ul>
          </InlineNotice>

          <InlineNotice
            v-if="source === 'search' && warnings.length > 0"
            tone="info"
            title="Search notes"
          >
            <WarningList :warnings="warnings" />
          </InlineNotice>

          <InlineNotice
            v-else-if="
              source === 'exact' && lookup && !lookup.ambiguous && lookup.notes.length > 0
            "
            tone="info"
            title="Lookup notes"
          >
            <p v-for="note in lookup.notes" :key="note">{{ note }}</p>
          </InlineNotice>

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
    </BaseCard>

    <BaseCard
      v-else
      title="Search results"
      description="Results will appear here after an explicit search."
    >
      <EmptyState
        :icon="Search"
        title="No search yet"
        description="Start with a full or partial HS code, or a product description. Every matching record will be shown — the explorer never chooses a tariff line for you."
      >
        <template #actions>
          <p class="text-xs font-medium text-ink-subtle">
            Examples: <span class="font-mono text-ink-muted">8471.30</span> ·
            <span class="font-mono text-ink-muted">0901</span> ·
            <span class="text-ink-muted">rice</span>
          </p>
        </template>
      </EmptyState>
    </BaseCard>

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
