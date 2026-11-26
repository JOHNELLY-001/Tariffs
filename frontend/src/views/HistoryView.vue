<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, Clock, LoaderCircle, RefreshCw, Search, Trash2, X } from '@lucide/vue';
import EmptyState from '@/components/common/EmptyState.vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import PageContainer from '@/components/common/PageContainer.vue';
import StatusPill from '@/components/results/StatusPill.vue';
import { ApiError } from '@/services/api/client';
import { getCalculation } from '@/services/api/endpoints';
import { useHistoryStore, type HistoryEntry } from '@/stores/history';
import { describeState, formatDateTime, formatMoney } from '@/utils/calculationResult';

const router = useRouter();
const historyStore = useHistoryStore();

const PAGE_SIZE = 10;

const verifying = ref(false);
const verifyError = ref<string | null>(null);
const hasVerified = ref(false);

const statusFilter = ref<'all' | HistoryEntry['state']>('all');
const searchQuery = ref('');
const currentPage = ref(1);

const statusOptions: Array<{ value: 'all' | HistoryEntry['state']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'unsupported', label: 'Unsupported' },
  { value: 'failed', label: 'Failed' },
  { value: 'partially_calculated', label: 'Partial' },
  { value: 'calculated', label: 'Calculated' },
];

const filteredEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return historyStore.entries.filter((entry) => {
    if (statusFilter.value !== 'all' && entry.state !== statusFilter.value) return false;
    if (!query) return true;
    const haystack = [
      entry.calculationId,
      entry.hsCode,
      entry.tariffDescription ?? '',
      entry.reference ?? '',
      entry.originCountry ?? '',
      entry.destination,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredEntries.value.length / PAGE_SIZE)),
);

const pagedEntries = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredEntries.value.slice(start, start + PAGE_SIZE);
});

watch([statusFilter, searchQuery], () => {
  currentPage.value = 1;
});

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages;
});

const verifyingProgress = ref(0);

async function verify(): Promise<void> {
  if (historyStore.entries.length === 0) {
    hasVerified.value = true;
    return;
  }

  verifying.value = true;
  verifyError.value = null;
  verifyingProgress.value = 0;

  const snapshot = [...historyStore.entries];
  let failedCount = 0;

  for (const entry of snapshot) {
    try {
      const result = await getCalculation(entry.calculationId);
      historyStore.update({
        calculationId: result.data.calculationId,
        state: result.data.state,
        generatedAt: result.data.generatedAt,
        hsCode: result.data.inputs.hsCode,
        tariffDescription: result.data.tariff?.description ?? null,
        originCountry: result.data.inputs.originCountry ?? null,
        destination: result.data.destination,
        currency: result.data.valuation.currency || result.data.inputs.currency,
        reference: result.data.reference ?? result.data.inputs.reference ?? null,
        totalImportCharges: result.data.totals?.totalImportCharges ?? null,
        estimatedLandedCost: result.data.totals?.estimatedLandedCost ?? null,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        historyStore.remove(entry.calculationId);
      } else {
        failedCount += 1;
      }
    }
    verifyingProgress.value += 1;
  }

  verifying.value = false;
  hasVerified.value = true;
  if (failedCount > 0) {
    verifyError.value =
      failedCount === snapshot.length
        ? 'The calculation service could not be reached. The list below is from this browser and may be out of date.'
        : `${failedCount} of ${snapshot.length} records could not be refreshed. The list below keeps the last known details.`;
  }
}

function openRecord(entry: HistoryEntry): void {
  void router.push({ name: 'calculation-result', params: { calculationId: entry.calculationId } });
}

function removeEntry(entry: HistoryEntry): void {
  historyStore.remove(entry.calculationId);
}

function clearAll(): void {
  if (typeof window !== 'undefined' && !window.confirm('Clear all calculation history from this browser?')) {
    return;
  }
  historyStore.clear();
}

function stateLabel(state: HistoryEntry['state']): string {
  return describeState(state).label;
}

function stateTone(state: HistoryEntry['state']) {
  return describeState(state).tone;
}

function totalLabel(entry: HistoryEntry): string {
  if (entry.totalImportCharges === null) return 'Not available';
  return formatMoney(entry.totalImportCharges, entry.currency);
}

function destinationLabel(value: string): string {
  if (value.toUpperCase() === 'TZ_MAINLAND') return 'Tanzania mainland';
  return value.replace(/_/g, ' ');
}

onMounted(() => {
  void verify();
});
</script>

<template>
  <PageContainer>
    <section class="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <div class="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-center">
        <div class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
          >
            <Clock class="h-3.5 w-3.5" aria-hidden="true" />
            Audit trail · no financial recalculation
          </span>

          <h2 class="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Calculation history
          </h2>
          <p class="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
            Opening a record retrieves the full calculation by its reference. Totals are shown only when
            confirmed a completed calculation.
          </p>
        </div>

        <div class="rounded-xl border border-line bg-surface-muted/70 p-4">
          <button
            v-if="historyStore.entries.length > 0"
            type="button"
            class="btn-secondary mt-3 w-full"
            @click="clearAll"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
            Clear history
          </button>
        </div>
      </div>
    </section>

    <div
      v-if="verifying"
      class="surface-card flex items-center gap-3 px-6 py-4 text-sm text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle class="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      Refreshing {{ verifyingProgress }} of {{ historyStore.entries.length }} records…
    </div>

    <InlineNotice v-if="verifyError" tone="warning" title="History could not be fully refreshed">
      {{ verifyError }}
      <div class="mt-3">
        <button type="button" class="btn-secondary" :disabled="verifying" @click="verify">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    </InlineNotice>

    <section v-if="historyStore.entries.length === 0" class="surface-card overflow-hidden">
      <EmptyState
        :icon="Clock"
        title="No calculations recorded yet"
        description="Run an import-cost calculation and it will appear here with its reference, status and any backend totals."
      >
        <template #actions>
          <button type="button" class="btn-primary" @click="router.push({ name: 'calculator' })">
            Open the calculator
            <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </button>
        </template>
      </EmptyState>
    </section>

    <template v-else>
      <section class="surface-card overflow-hidden">
        <div
          class="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="option in statusOptions"
              :key="option.value"
              type="button"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              :class="
                statusFilter === option.value
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
              "
              @click="statusFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <input
              v-model="searchQuery"
              type="search"
              class="field-input pl-9"
              placeholder="Search reference, HS code or description"
              aria-label="Search calculation history"
            />
          </div>
        </div>

        <div v-if="filteredEntries.length === 0" class="px-5 py-8 sm:px-6">
          <div class="rounded-xl border border-dashed border-line-strong bg-surface-muted/40 px-6 py-8 text-center">
            <p class="text-sm font-semibold text-ink">No records match these filters</p>
            <p class="mt-1 text-xs leading-5 text-ink-muted">
              Adjust the status filter or search term to see more records.
            </p>
          </div>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm print:min-w-0">
            <caption class="sr-only">
              Calculation history for this browser, with status and totals returned by the backend.
            </caption>
            <thead class="bg-surface-muted/80 text-[10px] uppercase tracking-wider text-ink-subtle">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">Reference</th>
                <th scope="col" class="px-4 py-3 font-semibold">Date</th>
                <th scope="col" class="px-4 py-3 font-semibold">HS code</th>
                <th scope="col" class="px-4 py-3 font-semibold">Origin to Destination</th>
                <th scope="col" class="px-4 py-3 font-semibold">Status</th>
                <th scope="col" class="px-4 py-3 font-semibold">Total payable</th>
                <th scope="col" class="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr
                v-for="entry in pagedEntries"
                :key="entry.calculationId"
                class="align-top transition-colors hover:bg-surface-muted/40"
              >
                <th scope="row" class="min-w-[11rem] px-4 py-3 text-left">
                  <p class="break-words font-mono text-xs font-semibold text-ink">
                    {{ entry.calculationId }}
                  </p>
                  <p
                    v-if="entry.reference"
                    class="mt-0.5 break-words text-[11px] text-ink-muted"
                  >
                    {{ entry.reference }}
                  </p>
                </th>
                <td class="px-4 py-3 text-xs text-ink-muted">
                  {{ formatDateTime(entry.generatedAt) }}
                </td>
                <td class="px-4 py-3">
                  <p class="font-mono text-xs font-semibold text-ink">{{ entry.hsCode }}</p>
                  <p
                    v-if="entry.tariffDescription"
                    class="mt-0.5 line-clamp-2 text-[11px] leading-5 text-ink-muted"
                  >
                    {{ entry.tariffDescription }}
                  </p>
                </td>
                <td class="px-4 py-3 text-xs text-ink-muted">
                  {{ entry.originCountry ?? '-' }} to {{ destinationLabel(entry.destination) }}
                </td>
                <td class="px-4 py-3">
                  <StatusPill :tone="stateTone(entry.state)" :label="stateLabel(entry.state)" />
                </td>
                <td class="px-4 py-3 font-mono text-xs font-semibold text-ink">
                  {{ totalLabel(entry) }}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                      @click="openRecord(entry)"
                    >
                      Open
                      <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-ink-subtle transition-colors hover:text-danger-ink"
                      @click="removeEntry(entry)"
                    >
                      <X class="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="totalPages > 1"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-muted/50 px-5 py-3 sm:px-6"
        >
          <p class="text-xs text-ink-muted">
            Page {{ currentPage }} of {{ totalPages }} · {{ filteredEntries.length }} records
          </p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn-secondary px-3 py-1.5 text-xs"
              :disabled="currentPage === 1"
              @click="currentPage -= 1"
            >
              Previous
            </button>
            <button
              type="button"
              class="btn-secondary px-3 py-1.5 text-xs"
              :disabled="currentPage === totalPages"
              @click="currentPage += 1"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </template>
  </PageContainer>
</template>
