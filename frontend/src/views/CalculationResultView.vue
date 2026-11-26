<template>
  <PageContainer>
    <!-- Print-only report header -->
    <header class="hidden print:block print:mb-6 print:border-b print:border-line print:pb-4">
      <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        CET Tanzania · Import cost calculation
      </p>
      <h1 class="mt-1 text-xl font-semibold tracking-tight text-ink">Calculation report</h1>
      <p class="mt-1 text-sm text-ink-muted">
        Reference:
        <span class="font-mono font-semibold text-ink">
          {{ calculation?.calculationId ?? calculationId }}
        </span>
        <template v-if="calculation">
          · {{ describeState(calculation.state).label }} · {{ formatDateTime(calculation.generatedAt) }}
        </template>
      </p>
    </header>

    <div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" @click="editCalculation">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Back to calculator
        </button>
        <button type="button" class="btn-secondary" @click="browseTariffs">
          <Search class="h-4 w-4" aria-hidden="true" />
          Tariff Explorer
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <CopyReferenceButton v-if="calculation" :value="calculation.calculationId" variant="button" />
        <button
          type="button"
          class="btn-secondary"
          :disabled="!calculation"
          @click="printReport"
        >
          <Printer class="h-4 w-4" aria-hidden="true" />
          Print
        </button>
      </div>
    </div>

    <section
      v-if="isLoading"
      class="surface-card flex items-center gap-3 px-6 py-10 text-sm text-ink-muted"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle class="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
      Loading calculation…
    </section>

    <section v-else-if="loadError" class="space-y-4">
      <InlineNotice tone="warning" title="Calculation could not be loaded">
        {{ loadError }}
      </InlineNotice>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" @click="loadCalculation">
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
        <button type="button" class="btn-secondary" @click="browseTariffs">
          <Search class="h-4 w-4" aria-hidden="true" />
          Open Tariff Explorer
        </button>
      </div>
    </section>

    <template v-else-if="calculation">
      <!-- Header: status and identity -->
      <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
        <div class="px-5 py-5 sm:px-6 sm:py-6">
          <StatusPill :tone="statusMeta.tone" :label="statusMeta.label" size="md" />
          <h2 class="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {{ statusMeta.title }}
          </h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
            {{ statusMeta.description }}
          </p>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Reference
            </span>
            <code class="break-all font-mono text-sm font-semibold text-ink">
              {{ calculation.calculationId }}
            </code>
            <CopyReferenceButton :value="calculation.calculationId" />
          </div>
        </div>

        <div class="border-t border-line bg-surface-muted/40 px-5 py-4 sm:px-6">
          <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-5">
            <div class="min-w-0">
              <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                HS code
              </dt>
              <dd class="mt-0.5 break-words font-mono text-sm font-semibold text-ink">
                {{ calculation.inputs.hsCode }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Tariff record
              </dt>
              <dd class="mt-0.5 break-words text-sm font-medium text-ink">
                <template v-if="calculation.tariff">
                  #{{ calculation.tariff.id }} · {{ tariffRateLabel(calculation.tariff.rate) }}
                </template>
                <template v-else>
                  {{ calculation.candidates.length > 0 ? 'Ambiguous — not selected' : 'Not resolved' }}
                </template>
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Origin
              </dt>
              <dd class="mt-0.5 break-words text-sm font-medium text-ink">
                {{ calculation.inputs.originCountry ?? 'Not provided' }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Destination
              </dt>
              <dd class="mt-0.5 break-words text-sm font-medium text-ink">
                {{ destinationLabel(calculation.destination) }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Calculation date
              </dt>
              <dd class="mt-0.5 break-words text-sm font-medium text-ink">
                {{ formatDateTime(calculation.generatedAt) }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div class="min-w-0 space-y-6">
          <TotalsPanel :result="calculation" />
          <ChargeBreakdownTable :result="calculation" />
          <ValuationDetails :result="calculation" />
          <TariffRecordPanel :result="calculation" @choose="editCalculation" />
          <AdvisoryPanel :result="calculation" />

          <p class="text-xs leading-5 text-ink-subtle print:break-inside-avoid">
            {{ calculation.disclaimer }}
          </p>
        </div>

        <aside class="space-y-4 print:hidden xl:sticky xl:top-6">
          <section class="surface-card overflow-hidden">
            <header class="border-b border-line px-5 py-4">
              <h2 class="text-sm font-semibold tracking-tight text-ink">Calculation details</h2>
            </header>
            <dl class="space-y-3 px-5 py-4 text-xs">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-subtle">Currency</dt>
                <dd class="font-mono font-semibold text-ink">{{ resultCurrency(calculation) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-ink-subtle">Simulation date</dt>
                <dd class="text-ink">{{ formatDate(calculation.simulationDate) }}</dd>
              </div>
              <div>
                <dt class="text-ink-subtle">Rule version</dt>
                <dd class="mt-0.5 break-words font-mono text-ink-muted">
                  {{ calculation.ruleVersion }}
                </dd>
              </div>
              <div>
                <dt class="text-ink-subtle">Generated</dt>
                <dd class="mt-0.5 text-ink-muted">{{ formatDateTime(calculation.generatedAt) }}</dd>
              </div>
            </dl>
          </section>

          <section class="surface-card px-5 py-4">
            <button type="button" class="btn-secondary w-full" @click="editCalculation">
              <ArrowLeft class="h-4 w-4" aria-hidden="true" />
              Edit in calculator
            </button>
          </section>
        </aside>
      </div>
    </template>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, LoaderCircle, Printer, RefreshCw, Search } from '@lucide/vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import PageContainer from '@/components/common/PageContainer.vue';
import StatusPill from '@/components/results/StatusPill.vue';
import TotalsPanel from '@/components/results/TotalsPanel.vue';
import ChargeBreakdownTable from '@/components/results/ChargeBreakdownTable.vue';
import ValuationDetails from '@/components/results/ValuationDetails.vue';
import TariffRecordPanel from '@/components/results/TariffRecordPanel.vue';
import AdvisoryPanel from '@/components/results/AdvisoryPanel.vue';
import CopyReferenceButton from '@/components/results/CopyReferenceButton.vue';
import { ApiError } from '@/services/api/client';
import { getCalculation } from '@/services/api/endpoints';
import { useCalculationStore } from '@/stores/calculation';
import type { ImportCostResult } from '@/types/api';
import {
  describeState,
  destinationLabel,
  formatDate,
  formatDateTime,
  resultCurrency,
  tariffRateLabel,
} from '@/utils/calculationResult';

const route = useRoute();
const router = useRouter();
const calculationStore = useCalculationStore();

const calculation = ref<ImportCostResult | null>(null);
const isLoading = ref(false);
const loadError = ref<string | null>(null);

const calculationId = computed(() =>
  typeof route.params.calculationId === 'string' ? route.params.calculationId : '',
);

const statusMeta = computed(() => describeState(calculation.value?.state ?? 'failed'));

async function loadCalculation(): Promise<void> {
  loadError.value = null;

  if (!calculationId.value) {
    loadError.value = 'The calculation reference is missing from this result URL.';
    return;
  }

  const cached = calculationStore.lastResult;
  if (cached && cached.calculationId === calculationId.value) {
    calculation.value = cached;
    return;
  }

  isLoading.value = true;
  try {
    const result = await getCalculation(calculationId.value);
    calculation.value = result.data;
    calculationStore.setResult(result.data);
  } catch (error) {
    loadError.value =
      error instanceof ApiError
        ? error.message
        : 'The calculation could not be loaded from the backend.';
  } finally {
    isLoading.value = false;
  }
}

function printReport(): void {
  window.print();
}

function editCalculation(): void {
  void router.push({ name: 'calculator' });
}

function browseTariffs(): void {
  const code = calculation.value?.inputs.hsCode;
  const query: Record<string, string> = {};
  if (code) query.q = code;
  void router.push({ name: 'tariffs', query });
}

onMounted(() => {
  void loadCalculation();
});

watch(calculationId, () => {
  calculation.value = null;
  void loadCalculation();
});
</script>
