<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight } from '@lucide/vue';
import ScheduleBadge from '@/components/tariffs/ScheduleBadge.vue';
import type { ImportCostResult } from '@/types/api';
import { rateKindLabel, tariffRateLabel } from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const tariff = computed(() => props.result.tariff);
const ambiguous = computed(() => !tariff.value && props.result.candidates.length > 0);

const emit = defineEmits<{ choose: [] }>();

function pageLabel(value: number | null): string {
  return value === null ? '—' : String(value);
}
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">Tariff record</h2>
        <p class="mt-1 text-sm leading-5 text-ink-muted">
          The tariff line and recorded rate used for this calculation.
        </p>
      </div>
      <button
        v-if="tariff"
        type="button"
        class="btn-secondary px-3 py-2 text-xs print:hidden"
        @click="emit('choose')"
      >
        Change tariff
        <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </header>

    <div v-if="tariff" class="px-5 py-5 sm:px-6">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <p class="break-words font-mono text-lg font-semibold text-ink">
          {{ tariff.hsCode }}
        </p>
        <ScheduleBadge :schedule="tariff.scheduleType" />
      </div>
      <p class="mt-1.5 text-sm leading-6 text-ink">
        {{ tariff.description || 'No product description recorded in the source.' }}
      </p>

      <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Original rate
          </dt>
          <dd class="mt-0.5 break-words font-mono text-sm font-semibold text-ink">
            {{ tariffRateLabel(tariff.originalRate) }}
          </dd>
        </div>
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Resolved rate
          </dt>
          <dd class="mt-0.5 break-words font-mono text-sm font-semibold text-ink">
            {{ tariffRateLabel(tariff.resolvedRate) }}
          </dd>
        </div>
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Rate form
          </dt>
          <dd class="mt-0.5 text-ink">{{ rateKindLabel(tariff.rateAnalysis.kind) }}</dd>
        </div>
        <div>
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Source page
          </dt>
          <dd class="mt-0.5 text-ink">{{ pageLabel(tariff.sourcePage) }}</dd>
        </div>
      </dl>
    </div>

    <div v-else-if="ambiguous" class="px-5 py-5 sm:px-6">
      <p class="text-sm font-medium text-warning-ink">No single tariff record was resolved</p>
      <p class="mt-1 text-sm leading-6 text-ink-muted">
        Several records share this HS code. The backend did not choose between them. Choose the
        record explicitly to proceed.
      </p>
      <ul class="mt-3 divide-y divide-line">
        <li
          v-for="candidate in result.candidates"
          :key="candidate.id"
          class="flex flex-wrap items-baseline justify-between gap-2 py-2"
        >
          <span class="font-mono text-sm font-semibold text-ink">{{ candidate.hsCode }}</span>
          <span class="font-mono text-xs text-ink-muted">
            Rate {{ candidate.rate ?? 'Not recorded' }}
          </span>
          <ScheduleBadge :schedule="candidate.scheduleType" />
        </li>
      </ul>
    </div>

    <div v-else class="px-5 py-5 text-sm text-ink-muted sm:px-6">
      The backend did not attach a tariff record to this calculation.
    </div>
  </section>
</template>
