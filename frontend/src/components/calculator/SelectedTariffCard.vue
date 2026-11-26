<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight, BookOpen, Check, X } from '@lucide/vue';
import ScheduleBadge from '@/components/tariffs/ScheduleBadge.vue';
import type { TariffView } from '@/types/api';

const props = defineProps<{
  tariff: TariffView | null;
}>();

const emit = defineEmits<{
  browse: [];
  clear: [];
}>();

const isSensitiveRate = computed(
  () =>
    props.tariff?.rateAnalysis.isSensitiveItem === true ||
    (props.tariff?.rate ?? '').trim().toUpperCase() === 'SI',
);

function pageLabel(page: number | null): string {
  return page === null ? 'Not recorded' : String(page);
}
</script>

<template>
  <div
    v-if="!tariff"
    class="rounded-xl border border-dashed border-line-strong bg-surface-muted/40 p-4 sm:p-5"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-start gap-3">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-subtle"
        >
          <BookOpen class="h-4 w-4" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-ink">No tariff record selected</p>
          <p class="mt-1 text-xs leading-5 text-ink-muted">
            Resolve the HS code above, or browse the Tariff Explorer and choose a record
            explicitly. Multiple records are never selected for you.
          </p>
        </div>
      </div>
      <button type="button" class="btn-secondary shrink-0" @click="emit('browse')">
        Browse Tariff Explorer
        <ArrowUpRight class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>

  <div v-else class="rounded-xl border border-accent/25 bg-accent-soft/40 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Selected tariff record
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <p class="break-words font-mono text-lg font-semibold text-ink">
            {{ tariff.hsCode || '—' }}
          </p>
          <span
            class="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-surface px-2 py-0.5 text-[10px] font-semibold text-accent"
          >
            <Check class="h-3 w-3" aria-hidden="true" />
            Selected
          </span>
        </div>
      </div>
      <ScheduleBadge :schedule="tariff.scheduleType" />
    </div>

    <p class="mt-3 text-sm leading-6 text-ink">
      {{ tariff.description || 'No product description recorded in the source.' }}
    </p>

    <dl class="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-3 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          Original rate
        </dt>
        <dd
          class="mt-1 break-words font-mono text-sm font-semibold"
          :class="isSensitiveRate ? 'text-warning-ink' : 'text-ink'"
        >
          {{ tariff.rate ?? 'Not recorded' }}
        </dd>
      </div>
      <div>
        <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          Record ID
        </dt>
        <dd class="mt-1 font-mono text-xs font-semibold text-ink-muted">#{{ tariff.id }}</dd>
      </div>
      <div>
        <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          Source page
        </dt>
        <dd class="mt-1 text-sm text-ink-muted">{{ pageLabel(tariff.sourcePage) }}</dd>
      </div>
    </dl>

    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div class="flex shrink-0 flex-wrap gap-2">
        <button type="button" class="btn-secondary px-3 py-2 text-xs" @click="emit('browse')">
          Change tariff
          <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" class="btn-secondary px-3 py-2 text-xs" @click="emit('clear')">
          <X class="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
    </div>
  </div>
</template>
