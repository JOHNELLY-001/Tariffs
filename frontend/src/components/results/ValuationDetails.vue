<script setup lang="ts">
import { computed } from 'vue';
import StatusPill from './StatusPill.vue';
import type { ImportCostResult, ValuationComponent } from '@/types/api';
import {
  formatDate,
  formatMoney,
  submittedComponentValue,
} from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const valuation = computed(() => props.result.valuation);
const exchangeRate = computed(() => props.result.exchangeRate);

const stateLabel = computed(() => {
  switch (valuation.value.state) {
    case 'calculated':
      return 'Calculated';
    case 'needs_review':
      return 'Needs review';
    default:
      return 'Unsupported';
  }
});

const stateTone = computed(() => {
  switch (valuation.value.state) {
    case 'calculated':
      return 'accent' as const;
    case 'needs_review':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
});

function submittedLabel(component: ValuationComponent): string {
  const submitted = submittedComponentValue(props.result, component);
  return formatMoney(submitted.value, submitted.currency);
}
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">Customs valuation</h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">
          Valuation components and exchange rate as returned by the backend.
        </p>
      </div>
      <StatusPill :tone="stateTone" :label="stateLabel" size="md" />
    </header>

    <div class="px-5 py-5 sm:px-6">
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Customs value
          </dt>
          <dd class="mt-0.5 break-words font-mono text-sm font-semibold text-ink">
            {{ formatMoney(valuation.customsValue, valuation.currency) }}
          </dd>
        </div>
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Exchange rate
          </dt>
          <dd class="mt-0.5 break-words font-mono text-sm font-semibold text-ink">
            {{ exchangeRate.rate ?? 'Not available' }}
          </dd>
        </div>
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Rate source
          </dt>
          <dd class="mt-0.5 break-words text-xs text-ink-muted">
            {{ exchangeRate.source ?? 'Not available' }}
          </dd>
        </div>
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Effective date
          </dt>
          <dd class="mt-0.5 text-xs text-ink-muted">
            {{ exchangeRate.effectiveDate ? formatDate(exchangeRate.effectiveDate) : 'Not available' }}
          </dd>
        </div>
      </dl>

      <div v-if="valuation.components.length > 0" class="mt-5 overflow-x-auto rounded-lg border border-line">
        <table class="w-full min-w-[520px] text-left text-sm print:min-w-0">
          <caption class="sr-only">
            Valuation components returned by the backend, with submitted and converted amounts.
          </caption>
          <thead class="bg-surface-muted/80 text-[10px] uppercase tracking-wider text-ink-subtle">
            <tr>
              <th scope="col" class="px-3 py-2.5 font-semibold">Component</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Submitted</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Included</th>
              <th scope="col" class="px-3 py-2.5 text-right font-semibold">Converted value</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="component in valuation.components" :key="component.code" class="align-top">
              <th scope="row" class="px-3 py-2.5 text-left font-medium text-ink">
                {{ component.description }}
                <span class="mt-0.5 block font-mono text-[10px] font-normal text-ink-subtle">
                  {{ component.code }}
                </span>
              </th>
              <td class="px-3 py-2.5 font-mono text-xs text-ink-muted">
                {{ submittedLabel(component) }}
              </td>
              <td class="px-3 py-2.5 text-xs text-ink-muted">
                {{ component.included ? 'Included' : 'Not included' }}
              </td>
              <td class="px-3 py-2.5 text-right font-mono text-xs font-semibold text-ink">
                {{ formatMoney(component.amount, component.currency) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="mt-4 text-xs text-ink-muted">
        No valuation component breakdown was returned for this request.
      </p>
    </div>
  </section>
</template>
