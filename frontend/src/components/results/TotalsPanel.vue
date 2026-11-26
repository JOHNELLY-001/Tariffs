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
const reasons = computed(() => totalsUnavailableReasons(props.result));

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
    <header
      class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6"
    >
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">
          {{ final ? 'Final payable totals' : 'Final totals are not available' }}
        </h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">
          <template v-if="final">
            Calculated by the backend for this completed request. No value is recalculated in the
            browser.
          </template>
          <template v-else>
            The backend did not return a final duty, tax or landed-cost total for this request.
          </template>
        </p>
      </div>
      <StatusPill :tone="state.tone" :label="state.label" size="md" />
    </header>

    <div v-if="final && result.totals" class="space-y-5 px-5 py-5 sm:px-6">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-accent/25 bg-accent-soft p-4">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Estimated landed cost
          </p>
          <p class="mt-1.5 break-words font-mono text-2xl font-semibold text-ink">
            {{ formatMoney(result.totals.estimatedLandedCost, currency) }}
          </p>
        </div>
        <div class="rounded-xl border border-line bg-surface-muted/60 p-4">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Total import charges
          </p>
          <p class="mt-1.5 break-words font-mono text-2xl font-semibold text-ink">
            {{ formatMoney(result.totals.totalImportCharges, currency) }}
          </p>
        </div>
      </div>

      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          v-for="item in breakdown"
          :key="item.label"
          class="rounded-lg border border-line bg-surface p-3"
        >
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            {{ item.label }}
          </dt>
          <dd class="mt-1 break-words font-mono text-sm font-semibold text-ink">
            {{ formatMoney(item.value, currency) }}
          </dd>
        </div>
      </dl>

      <p class="rounded-lg border border-line bg-surface-muted/50 px-4 py-3 text-xs leading-5 text-ink-muted">
        These figures are presented exactly as returned by the backend. Totals are only shown for a
        completed calculation with a totals object in the response.
      </p>
    </div>

    <div v-else class="space-y-4 px-5 py-5 sm:px-6">
      <div class="rounded-xl border border-warning/30 bg-warning-soft px-4 py-4">
        <p class="text-sm font-semibold text-warning-ink">
          No final duty, tax or landed cost is reported
        </p>
        <ul v-if="reasons.length > 0" class="mt-3 space-y-2.5">
          <li
            v-for="reason in reasons"
            :key="reason"
            class="flex items-start gap-2.5 text-sm leading-6 text-ink-muted"
          >
            <span
              class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
              aria-hidden="true"
            />
            <span class="min-w-0">{{ reason }}</span>
          </li>
        </ul>
        <p v-else class="mt-2 text-sm leading-6 text-ink-muted">
          The backend did not return final totals for this request.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg border border-line bg-surface p-3">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Charge lines returned
          </p>
          <p class="mt-1 font-mono text-lg font-semibold text-ink">
            {{ result.charges.length }}
          </p>
          <p class="mt-1 text-xs leading-5 text-ink-muted">
            Listed in the charge breakdown. Partial charge lines are not a final assessment.
          </p>
        </div>
        <div class="rounded-lg border border-line bg-surface p-3">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Valuation components
          </p>
          <p class="mt-1 font-mono text-lg font-semibold text-ink">
            {{ result.valuation.components.length }}
          </p>
          <p class="mt-1 text-xs leading-5 text-ink-muted">
            Shown for reference. A component being present does not mean the customs value was
            finalised.
          </p>
        </div>
      </div>

      <p class="text-xs leading-5 text-ink-subtle">
        This dashboard never estimates a substitute total. Any amount shown elsewhere in the report
        comes from the backend and is labelled with the state it belongs to.
      </p>
    </div>
  </section>
</template>
