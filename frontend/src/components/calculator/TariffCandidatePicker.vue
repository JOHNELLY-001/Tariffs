<script setup lang="ts">
import { useId } from 'vue';
import { Check } from '@lucide/vue';
import ScheduleBadge from '@/components/tariffs/ScheduleBadge.vue';
import type { TariffView } from '@/types/api';

defineProps<{
  candidates: TariffView[];
  selectedId: number | null;
}>();

const emit = defineEmits<{
  select: [tariff: TariffView];
}>();

const groupName = `tariff-candidate-${useId()}`;

function rateIsSensitive(tariff: TariffView): boolean {
  return (
    tariff.rateAnalysis.isSensitiveItem === true ||
    (tariff.rate ?? '').trim().toUpperCase() === 'SI'
  );
}

function pageLabel(page: number | null): string {
  return page === null ? 'Not recorded' : String(page);
}
</script>

<template>
  <fieldset>
    <legend class="sr-only">Choose one tariff record for this HS code</legend>
    <div class="space-y-2.5">
      <label
        v-for="candidate in candidates"
        :key="candidate.id"
        class="flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors"
        :class="
          selectedId === candidate.id
            ? 'border-accent bg-accent-soft/40 ring-1 ring-accent/20'
            : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted/40'
        "
      >
        <input
          type="radio"
          class="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
          :name="groupName"
          :value="candidate.id"
          :checked="selectedId === candidate.id"
          @change="emit('select', candidate)"
        />

        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-start justify-between gap-2">
            <span class="flex flex-wrap items-center gap-2">
              <span class="break-words font-mono text-sm font-semibold text-ink">
                {{ candidate.hsCode || '—' }}
              </span>
              <span
                v-if="selectedId === candidate.id"
                class="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent"
              >
                <Check class="h-3 w-3" aria-hidden="true" />
                Selected
              </span>
            </span>
            <ScheduleBadge :schedule="candidate.scheduleType" />
          </span>

          <span class="mt-1.5 block text-sm leading-6 text-ink-muted">
            {{ candidate.description || 'No product description recorded in the source.' }}
          </span>

          <span class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line pt-2.5 text-xs">
            <span>
              <span class="text-ink-subtle">Rate </span>
              <span
                class="font-mono font-semibold"
                :class="rateIsSensitive(candidate) ? 'text-warning-ink' : 'text-ink'"
              >
                {{ candidate.rate ?? 'Not recorded' }}
              </span>
            </span>
            <span class="text-ink-subtle">
              Source {{ pageLabel(candidate.sourcePage) }}
            </span>
            <span class="font-mono text-ink-subtle">#{{ candidate.id }}</span>
          </span>
        </span>
      </label>
    </div>
  </fieldset>
</template>
