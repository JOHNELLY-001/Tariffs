<script setup lang="ts">
import { computed } from 'vue';
import StatusPill from './StatusPill.vue';
import type { ImportCostResult } from '@/types/api';
import { calculatedChargeRows, unresolvedAssessments } from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const calculated = computed(() => calculatedChargeRows(props.result));
const unresolved = computed(() => unresolvedAssessments(props.result));
const hasRows = computed(() => calculated.value.length > 0 || unresolved.value.length > 0);
const isFinal = computed(
  () => props.result.state === 'completed' || props.result.state === 'calculated',
);
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="border-b border-line px-5 py-4 sm:px-6">
      <h2 class="text-base font-semibold tracking-tight text-ink">Duty and tax breakdown</h2>
      <p class="mt-1 text-sm leading-5 text-ink-muted">
        <template v-if="isFinal">
          Charge lines exactly as returned by the backend.
        </template>
        <template v-else>
          Partial charge lines. These are not a final assessment.
        </template>
      </p>
    </header>

    <div v-if="!hasRows" class="px-5 py-6 text-sm text-ink-muted sm:px-6">
      No charge lines were returned for this request.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[560px] text-left text-sm print:min-w-0">
        <caption class="sr-only">
          Duty and tax breakdown returned by the backend, including calculated and unresolved
          charges.
        </caption>
        <thead class="bg-surface-muted/80 text-[10px] uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" class="px-4 py-2.5 font-semibold">Charge</th>
            <th scope="col" class="px-4 py-2.5 font-semibold">Base</th>
            <th scope="col" class="px-4 py-2.5 font-semibold">Rate</th>
            <th scope="col" class="px-4 py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="charge in calculated" :key="charge.key" class="align-top">
            <th scope="row" class="px-4 py-3 text-left font-medium text-ink">
              {{ charge.name }}
              <span class="mt-0.5 block font-mono text-[10px] font-normal text-ink-subtle">
                {{ charge.code }} · {{ charge.rateType }}
              </span>
            </th>
            <td class="px-4 py-3 font-mono text-xs text-ink-muted">{{ charge.base }}</td>
            <td class="px-4 py-3 font-mono text-xs text-ink">{{ charge.rate }}</td>
            <td class="px-4 py-3 text-right font-mono text-xs font-semibold text-ink">
              {{ charge.amount }}
            </td>
          </tr>

          <tr v-for="item in unresolved" :key="item.key" class="align-top">
            <th scope="row" class="px-4 py-3 text-left font-medium text-ink">
              {{ item.name }}
              <span class="mt-0.5 block text-[11px] font-normal leading-5 text-ink-muted">
                {{ item.reason }}
              </span>
            </th>
            <td class="px-4 py-3 font-mono text-xs text-ink-muted">—</td>
            <td class="px-4 py-3 text-xs text-ink-muted">
              <StatusPill :tone="item.tone" :label="item.statusLabel" />
            </td>
            <td class="px-4 py-3 text-right text-xs font-medium text-ink-muted">
              Not calculated
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
