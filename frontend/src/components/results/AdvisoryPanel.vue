<script setup lang="ts">
import { computed } from 'vue';
import WarningList from '@/components/tariffs/WarningList.vue';
import type { ImportCostResult } from '@/types/api';
import {
  allWarnings,
  missingInformationItems,
  reasonText,
  totalsUnavailableReasons,
} from '@/utils/calculationResult';

const props = defineProps<{ result: ImportCostResult }>();

const warnings = computed(() => allWarnings(props.result));
const missing = computed(() => missingInformationItems(props.result));
const unavailableReasons = computed(() => totalsUnavailableReasons(props.result));

const unresolvedReasons = computed(() => {
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

const hasAssumptions = computed(() => props.result.assumptions.length > 0);
const hasWarnings = computed(() => warnings.value.length > 0);
const hasMissing = computed(() => missing.value.length > 0);
const hasUnresolved = computed(() => unresolvedReasons.value.length > 0);
const hasTotalsUnavailable = computed(() => unavailableReasons.value.length > 0);
</script>

<template>
  <section class="surface-card overflow-hidden print:break-inside-avoid print:shadow-none">
    <header class="border-b border-line px-5 py-4 sm:px-6">
      <h2 class="text-base font-semibold tracking-tight text-ink">Warnings, assumptions and open items</h2>
      <p class="mt-1 text-sm leading-5 text-ink-muted">
        Backend warnings, unresolved reasons, assumptions and information the backend still requires.
        Nothing here is a legal conclusion; it is the backend's own status output.
      </p>
    </header>

    <div class="space-y-6 px-5 py-5 sm:px-6">
      <div v-if="hasUnresolved || hasTotalsUnavailable">
        <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          Why this is not final
        </h3>
        <ul class="mt-2 space-y-2.5">
          <li
            v-for="reason in (hasUnresolved ? unresolvedReasons : unavailableReasons)"
            :key="reason"
            class="flex items-start gap-2.5 text-sm leading-6 text-ink-muted"
          >
            <span
              class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
              aria-hidden="true"
            />
            <span class="min-w-0 break-words">{{ reason }}</span>
          </li>
        </ul>
      </div>

      <div v-if="hasWarnings">
        <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          Backend warnings
        </h3>
        <div class="mt-2">
          <WarningList :warnings="warnings" />
        </div>
      </div>

      <div v-if="hasAssumptions">
        <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          Assumptions recorded by the backend
        </h3>
        <ul class="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-muted">
          <li v-for="assumption in result.assumptions" :key="assumption">
            {{ assumption }}
          </li>
        </ul>
      </div>

      <div v-if="hasMissing">
        <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          Information the backend still needs
        </h3>
        <ul class="mt-2 space-y-2.5">
          <li
            v-for="item in missing"
            :key="item"
            class="flex items-start gap-2.5 text-sm leading-6 text-ink-muted"
          >
            <span
              class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-subtle"
              aria-hidden="true"
            />
            <span class="min-w-0">{{ item }}</span>
          </li>
        </ul>
      </div>

      <p
        v-if="!hasWarnings && !hasAssumptions && !hasMissing && !hasUnresolved"
        class="text-sm leading-6 text-ink-muted"
      >
        The backend did not record any warnings, assumptions or open items for this calculation.
      </p>
    </div>
  </section>
</template>
