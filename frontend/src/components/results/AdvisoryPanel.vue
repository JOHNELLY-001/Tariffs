<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown } from '@lucide/vue';
import type { ImportCostResult } from '@/types/api';
import { allWarnings, missingInformationItems, reasonText } from '@/utils/calculationResult';
import { splitWarning } from '@/utils/warnings';

const props = defineProps<{ result: ImportCostResult }>();

const warnings = computed(() =>
  allWarnings(props.result).map((warning) => splitWarning(warning).message || warning),
);

const missing = computed(() => missingInformationItems(props.result));

const unresolved = computed(() => {
  const reasons: string[] = [];

  if (props.result.valuation.reason) {
    reasons.push(`Customs valuation: ${reasonText(props.result.valuation.reason)}`);
  }
  if (props.result.duty.state !== 'calculated' && props.result.duty.reason) {
    reasons.push(`Customs duty: ${reasonText(props.result.duty.reason)}`);
  }
  if (props.result.tax.state !== 'calculated' && props.result.tax.reason) {
    reasons.push(`Taxes and levies: ${reasonText(props.result.tax.reason)}`);
  }
  if (props.result.state === 'failed') {
    reasons.push('The backend reported a failed calculation state.');
  }
  if (props.result.state === 'unsupported') {
    reasons.push('No verified rules are registered for this request.');
  }

  return [...new Set(reasons)];
});

const assumptions = computed(() => props.result.assumptions);

const total = computed(
  () =>
    warnings.value.length +
    missing.value.length +
    unresolved.value.length +
    assumptions.value.length,
);
</script>

<template>
  <section
    v-if="total > 0"
    class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none"
  >
    <details class="group">
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6"
      >
        <div class="min-w-0">
          <h2 class="text-base font-semibold tracking-tight text-ink">Warnings and notes</h2>
          <p class="mt-1 text-sm leading-5 text-ink-muted">
            Backend warnings, assumptions and unresolved items.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="text-xs font-medium text-ink-subtle">{{ total }}</span>
          <ChevronDown
            class="h-4 w-4 text-ink-subtle transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </div>
      </summary>

      <div class="space-y-5 border-t border-line px-5 py-5 sm:px-6">
        <div v-if="unresolved.length > 0">
          <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Not final because
          </h3>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="reason in unresolved"
              :key="reason"
              class="text-sm leading-6 text-ink-muted"
            >
              {{ reason }}
            </li>
          </ul>
        </div>

        <div v-if="warnings.length > 0">
          <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Backend warnings
          </h3>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="warning in warnings"
              :key="warning"
              class="text-sm leading-6 text-ink-muted"
            >
              {{ warning }}
            </li>
          </ul>
        </div>

        <div v-if="missing.length > 0">
          <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Still required
          </h3>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="item in missing"
              :key="item"
              class="text-sm leading-6 text-ink-muted"
            >
              {{ item }}
            </li>
          </ul>
        </div>

        <div v-if="assumptions.length > 0">
          <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Assumptions
          </h3>
          <ul class="mt-2 space-y-1.5">
            <li
              v-for="assumption in assumptions"
              :key="assumption"
              class="text-sm leading-6 text-ink-muted"
            >
              {{ assumption }}
            </li>
          </ul>
        </div>
      </div>
    </details>
  </section>
</template>
