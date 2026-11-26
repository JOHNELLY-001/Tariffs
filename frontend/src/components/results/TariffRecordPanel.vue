<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight } from '@lucide/vue';
import ScheduleBadge from '@/components/tariffs/ScheduleBadge.vue';
import type { ImportCostResult } from '@/types/api';
import { rateKindLabel, tariffRateLabel } from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const tariff = computed(() => props.result.tariff);
const ambiguous = computed(
  () => !tariff.value && props.result.candidates.length > 0,
);

const emit = defineEmits<{ choose: [] }>();

function pageLabel(value: number | null): string {
  return value === null ? 'Not recorded' : String(value);
}
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="border-b border-line px-5 py-4 sm:px-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-base font-semibold tracking-tight text-ink">Tariff record used</h2>
          <p class="mt-1 text-sm leading-5 text-ink-muted">
            The tariff record and rate text exactly as recorded by the backend.
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
      </div>
    </header>

    <div v-if="tariff" class="px-5 py-5 sm:px-6">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <p class="break-words font-mono text-lg font-semibold text-ink">
          {{ tariff.hsCode }}
        </p>
        <ScheduleBadge :schedule="tariff.scheduleType" />
      </div>
      <p class="mt-2 text-sm leading-6 text-ink">
        {{ tariff.description || 'No product description recorded in the source.' }}
      </p>

      <dl class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Record ID
          </dt>
          <dd class="mt-1 font-mono text-sm font-semibold text-ink">#{{ tariff.id }}</dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Original rate
          </dt>
          <dd class="mt-1 break-words font-mono text-sm font-semibold text-ink">
            {{ tariffRateLabel(tariff.originalRate) }}
          </dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Resolved rate
          </dt>
          <dd class="mt-1 break-words font-mono text-sm font-semibold text-ink">
            {{ tariffRateLabel(tariff.resolvedRate) }}
          </dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Rate form
          </dt>
          <dd class="mt-1 text-sm font-medium text-ink">
            {{ rateKindLabel(tariff.rateAnalysis.kind) }}
          </dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Source page
          </dt>
          <dd class="mt-1 text-sm font-medium text-ink">{{ pageLabel(tariff.sourcePage) }}</dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-muted/40 p-3">
          <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Sensitive tariff
          </dt>
          <dd class="mt-1 text-sm font-medium text-ink">
            {{ tariff.sensitiveTariffId ? `#${tariff.sensitiveTariffId}` : 'None recorded' }}
          </dd>
        </div>
      </dl>

      <p class="mt-4 text-xs leading-5 text-ink-subtle">
        The original rate text is reported unchanged. It is not converted into an amount without a
        verified rule.
      </p>
    </div>

    <div v-else-if="ambiguous" class="px-5 py-5 sm:px-6">
      <p class="text-sm font-semibold text-warning-ink">
        No single tariff record was resolved
      </p>
      <p class="mt-1 text-sm leading-6 text-ink-muted">
        Several records share this HS code. The backend did not choose between them, and the
        calculation was returned for review. Choose the record explicitly to proceed.
      </p>
      <ul class="mt-4 space-y-2.5">
        <li
          v-for="candidate in result.candidates"
          :key="candidate.id"
          class="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line bg-surface-muted/40 p-3"
        >
          <div class="min-w-0">
            <p class="font-mono text-sm font-semibold text-ink">{{ candidate.hsCode }}</p>
            <p class="mt-0.5 font-mono text-xs text-ink-muted">
              Record #{{ candidate.id }} · rate {{ candidate.rate ?? 'Not recorded' }}
            </p>
          </div>
          <ScheduleBadge :schedule="candidate.scheduleType" />
        </li>
      </ul>
    </div>

    <div v-else class="px-5 py-5 sm:px-6">
      <div class="rounded-xl border border-dashed border-line-strong bg-surface-muted/40 px-6 py-6 text-center">
        <p class="text-sm font-semibold text-ink">No tariff record was resolved</p>
        <p class="mt-1 text-xs leading-5 text-ink-muted">
          The backend did not attach a tariff record to this calculation.
        </p>
      </div>
    </div>
  </section>
</template>
