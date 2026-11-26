<script setup lang="ts">
import { computed } from 'vue';
import StatusPill from './StatusPill.vue';
import type { ImportCostResult } from '@/types/api';
import {
  describeState,
  formatMoney,
  hasFinalTotals,
  resultCurrency,
  totalsUnavailableReasons,
} from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const state = computed(() => describeState(props.result.state));
const final = computed(() => hasFinalTotals(props.result));
const currency = computed(() => resultCurrency(props.result));
const reasons = computed(() => totalsUnavailableReasons(props.result).slice(0, 2));

const breakdown = computed(() => {
  const totals = props.result.totals;
  if (!totals) return [];

  return [
    { label: 'Customs value', value: totals.customsValue },
    { label: 'Customs duty', value: totals.customsDuty },
    { label: 'Excise duty', value: totals.exciseDuty },
    { label: 'VAT', value: totals.vat },
    { label: 'Levies', value: totals.levies },
    { label: 'Other charges', value: totals.otherCharges },
  ];
});
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">Payable summary</h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">
          <template v-if="final">
            Final amounts returned by the backend. Nothing is recalculated in the browser.
          </template>
          <template v-else>
            No final payable amount is available for this calculation.
          </template>
        </p>
      </div>
      <StatusPill :tone="state.tone" :label="state.label" size="md" />
    </header>

    <div v-if="final && result.totals" class="px-5 py-5 sm:px-6">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div class="rounded-xl bg-accent-soft px-5 py-5">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Total payable
          </p>
          <p class="mt-2 break-words font-mono text-3xl font-semibold tracking-tight text-ink">
            {{ formatMoney(result.totals.totalImportCharges, currency) }}
          </p>
          <dl class="mt-4 space-y-1.5 border-t border-accent/20 pt-3 text-xs">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-muted">Customs value</dt>
              <dd class="font-mono font-semibold text-ink">
                {{ formatMoney(result.totals.customsValue, currency) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-ink-muted">Estimated landed cost</dt>
              <dd class="font-mono font-semibold text-ink">
                {{ formatMoney(result.totals.estimatedLandedCost, currency) }}
              </dd>
            </div>
          </dl>
        </div>

        <dl class="divide-y divide-line">
          <div
            v-for="item in breakdown"
            :key="item.label"
            class="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <dt class="text-sm text-ink-muted">{{ item.label }}</dt>
            <dd class="font-mono text-sm font-semibold text-ink">
              {{ formatMoney(item.value, currency) }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div v-else class="px-5 py-5 sm:px-6">
      <p class="text-sm font-medium text-ink">
        The backend did not complete this calculation.
      </p>
      <p class="mt-1 text-sm leading-6 text-ink-muted">
        No duty, tax or landed-cost total is shown, because a final payable amount requires a
        completed calculation with valid totals.
      </p>
      <ul v-if="reasons.length > 0" class="mt-3 space-y-1.5">
        <li
          v-for="reason in reasons"
          :key="reason"
          class="text-xs leading-5 text-ink-muted"
        >
          {{ reason }}
        </li>
      </ul>
    </div>
  </section>
</template>
