<script setup lang="ts">
import { computed } from 'vue';
import StatusPill from './StatusPill.vue';
import type { ImportCostResult } from '@/types/api';
import {
  calculatedChargeRows,
  unresolvedAssessments,
} from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const calculated = computed(() => calculatedChargeRows(props.result));
const unresolved = computed(() => unresolvedAssessments(props.result));
const hasRows = computed(() => calculated.value.length > 0 || unresolved.value.length > 0);
const isFinal = computed(() => props.result.state === 'completed' || props.result.state === 'calculated');

const statusLegend = computed(() => [
  { label: 'Calculated', tone: 'accent' as const },
  ...(props.result.state === 'needs_review' ? [{ label: 'Needs review', tone: 'warning' as const }] : []),
  ...(props.result.state === 'unsupported' ? [{ label: 'Unsupported', tone: 'neutral' as const }] : []),
  ...(props.result.state === 'failed' ? [{ label: 'Failed', tone: 'danger' as const }] : []),
  ...(unresolved.value.length > 0 ? [{ label: 'Not calculated', tone: 'neutral' as const }] : []),
]);
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">Charge breakdown</h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">
          <template v-if="isFinal">
            Charge lines and amounts exactly as returned by the backend.
          </template>
          <template v-else>
            Charge lines returned by the backend. They are partial and must not be treated as a final
            assessment.
          </template>
        </p>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="item in statusLegend"
          :key="item.label"
          class="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted"
        >
          <StatusPill :tone="item.tone" :label="item.label" />
        </span>
      </div>
    </header>

    <div v-if="!hasRows" class="px-5 py-8 sm:px-6">
      <div class="rounded-xl border border-dashed border-line-strong bg-surface-muted/40 px-6 py-8 text-center">
        <p class="text-sm font-semibold text-ink">No charge lines were returned</p>
        <p class="mt-1 text-xs leading-5 text-ink-muted">
          The backend did not calculate any charge for this request. See the warnings and unresolved
          reasons below for what is still missing.
        </p>
      </div>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[720px] text-left text-sm print:min-w-0">
        <caption class="sr-only">
          Charge breakdown returned by the backend, including calculated and unresolved charges.
        </caption>
        <thead class="bg-surface-muted/80 text-[10px] uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">Charge</th>
            <th scope="col" class="px-4 py-3 font-semibold">Calculation base</th>
            <th scope="col" class="px-4 py-3 font-semibold">Rate / expression</th>
            <th scope="col" class="px-4 py-3 font-semibold">Amount</th>
            <th scope="col" class="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="charge in calculated"
            :key="charge.key"
            class="align-top transition-colors hover:bg-surface-muted/40"
          >
            <th
              scope="row"
              class="min-w-[12rem] px-4 py-3 text-left font-medium text-ink"
            >
              <p class="font-semibold">{{ charge.name }}</p>
              <p class="mt-0.5 font-mono text-[10px] text-ink-subtle">
                {{ charge.code }} · {{ charge.taxType }}
              </p>
            </th>
            <td class="px-4 py-3 font-mono text-xs text-ink-muted">
              {{ charge.base }}
            </td>
            <td class="px-4 py-3">
              <p class="font-mono text-xs font-semibold text-ink">{{ charge.rate }}</p>
              <p class="mt-0.5 text-[11px] text-ink-muted">{{ charge.rateType }}</p>
              <p class="mt-1 break-words font-mono text-[10px] leading-4 text-ink-subtle">
                {{ charge.formula }}
              </p>
            </td>
            <td class="px-4 py-3 font-mono text-xs font-semibold text-ink">
              {{ charge.amount }}
            </td>
            <td class="px-4 py-3">
              <StatusPill :tone="charge.statusTone" :label="charge.statusLabel" />
            </td>
          </tr>

          <tr
            v-for="item in unresolved"
            :key="item.key"
            class="align-top bg-surface-muted/30"
          >
            <th
              scope="row"
              class="min-w-[12rem] px-4 py-3 text-left font-medium text-ink"
            >
              <p class="font-semibold">{{ item.name }}</p>
              <p class="mt-0.5 text-[11px] leading-5 text-ink-muted">
                {{ item.reason }}
              </p>
            </th>
            <td class="px-4 py-3 font-mono text-xs text-ink-muted">
              {{ item.baseLabel ?? '—' }}
            </td>
            <td class="px-4 py-3">
              <p class="font-mono text-xs font-semibold text-ink">
                {{ item.rateLabel ?? '—' }}
              </p>
              <p class="mt-0.5 text-[11px] text-ink-muted">
                {{ item.statusLabel }}
              </p>
            </td>
            <td class="px-4 py-3 font-mono text-xs font-semibold text-ink-muted">
              Not calculated
            </td>
            <td class="px-4 py-3">
              <StatusPill :tone="item.tone" :label="item.statusLabel" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer
      v-if="calculated.length > 0 || unresolved.length > 0"
      class="border-t border-line bg-surface-muted/50 px-5 py-3 text-xs leading-5 text-ink-muted sm:px-6"
    >
      <template v-if="isFinal">
        All amounts are returned by the backend. The browser does not total or recompute them.
      </template>
      <template v-else>
        Calculated lines above are partial. They are shown for reference and must not be treated as
        a final assessment.
      </template>
    </footer>
  </section>
</template>
