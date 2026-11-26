<script setup lang="ts">
import { computed } from 'vue';
import StatusPill from './StatusPill.vue';
import WarningList from '@/components/tariffs/WarningList.vue';
import type { ImportCostResult, ValuationComponent } from '@/types/api';
import {
  componentIncludedLabel,
  formatMoney,
  reasonText,
  submittedComponentValue,
} from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const valuation = computed(() => props.result.valuation);
const stateLabel = computed(() => {
  switch (valuation.value.state) {
    case 'calculated':
      return 'Calculated';
    case 'needs_review':
      return 'Needs review';
    case 'unsupported':
      return 'Unsupported';
    default:
      return valuation.value.state;
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

const exchangeRate = computed(() => props.result.exchangeRate);

const components = computed(() => valuation.value.components);

function componentRow(component: ValuationComponent) {
  const submitted = submittedComponentValue(props.result, component);
  return {
    submitted: formatMoney(submitted.value, submitted.currency),
    converted: formatMoney(component.amount, component.currency),
    included: componentIncludedLabel(component),
    reason: reasonText(component.reason),
  };
}
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">Customs valuation</h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">
          Valuation components, exchange rate and the customs value exactly as returned by the
          backend.
        </p>
      </div>
      <StatusPill :tone="stateTone" :label="stateLabel" size="md" />
    </header>

    <div class="space-y-5 px-5 py-5 sm:px-6">
      <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Exchange rate
          </dt>
          <dd class="mt-1 break-words font-mono text-sm font-semibold text-ink">
            {{ exchangeRate.rate ?? 'Not available' }}
          </dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Rate source
          </dt>
          <dd class="mt-1 break-words text-xs font-medium text-ink">
            {{ exchangeRate.source ?? 'Not available' }}
          </dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Effective date
          </dt>
          <dd class="mt-1 break-words text-xs font-medium text-ink">
            {{ exchangeRate.effectiveDate ?? 'Not available' }}
          </dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Converted customs value
          </dt>
          <dd class="mt-1 break-words font-mono text-sm font-semibold text-ink">
            {{ formatMoney(valuation.customsValue, valuation.currency) }}
          </dd>
        </div>
      </dl>

      <p v-if="valuation.reason" class="text-xs leading-5 text-ink-muted">
        {{ reasonText(valuation.reason) }}
      </p>

      <div v-if="components.length > 0" class="overflow-x-auto rounded-lg border border-line">
        <table class="w-full min-w-[640px] text-left text-sm print:min-w-0">
          <caption class="sr-only">
            Valuation components returned by the backend, with submitted and converted amounts.
          </caption>
          <thead class="bg-surface-muted/80 text-[10px] uppercase tracking-wider text-ink-subtle">
            <tr>
              <th scope="col" class="px-3 py-2.5 font-semibold">Component</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Submitted</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Converted</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Included</th>
              <th scope="col" class="px-3 py-2.5 font-semibold">Backend note</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="component in components" :key="component.code" class="align-top">
              <th scope="row" class="px-3 py-3 text-left">
                <p class="font-medium text-ink">{{ component.description }}</p>
                <p class="mt-0.5 font-mono text-[10px] text-ink-subtle">
                  {{ component.code }}
                </p>
              </th>
              <td class="px-3 py-3 font-mono text-xs text-ink">
                {{ componentRow(component).submitted }}
              </td>
              <td class="px-3 py-3 font-mono text-xs text-ink">
                {{ componentRow(component).converted }}
              </td>
              <td class="px-3 py-3 text-xs text-ink-muted">
                {{ componentRow(component).included }}
              </td>
              <td class="px-3 py-3 text-xs leading-5 text-ink-muted">
                {{ componentRow(component).reason }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="rounded-xl border border-dashed border-line-strong bg-surface-muted/40 px-6 py-6 text-center">
        <p class="text-sm font-semibold text-ink">No valuation components were returned</p>
        <p class="mt-1 text-xs leading-5 text-ink-muted">
          The backend did not include a component breakdown for this request.
        </p>
      </div>

      <div v-if="valuation.warnings.length > 0" class="rounded-lg border border-line bg-surface-muted/50 px-4 py-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          Valuation warnings
        </p>
        <div class="mt-2">
          <WarningList :warnings="valuation.warnings" />
        </div>
      </div>
    </div>
  </section>
</template>
