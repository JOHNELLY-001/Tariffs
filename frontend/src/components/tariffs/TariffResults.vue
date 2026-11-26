<script setup lang="ts">
import { ArrowUpRight, Check } from '@lucide/vue';
import type { MatchType } from '@/types/api';
import type { TariffSearchRow } from '@/composables/useTariffSearch';
import ScheduleBadge from './ScheduleBadge.vue';

withDefaults(
  defineProps<{
    items: TariffSearchRow[];
    loading: boolean;
    selectable?: boolean;
    selectedId?: number | null;
  }>(),
  { selectable: false, selectedId: null },
);

const emit = defineEmits<{
  inspect: [id: number];
  select: [tariff: TariffSearchRow];
}>();

const matchLabels: Record<MatchType, string> = {
  exact_code: 'Exact code',
  code_prefix: 'Code prefix',
  description: 'Description',
};

function matchLabel(row: TariffSearchRow): string {
  return row.matchType ? matchLabels[row.matchType] : 'Exact HS code';
}

function matchNote(row: TariffSearchRow): string | null {
  if (row.relevance === null) return null;
  return `Text relevance ${Math.round(row.relevance * 100)}%`;
}

function rateIsSensitive(row: TariffSearchRow): boolean {
  return (
    row.rateAnalysis.isSensitiveItem ||
    (row.rate ?? '').trim().toUpperCase() === 'SI'
  );
}

function pageLabel(page: number | null): string {
  return page === null ? 'Not recorded' : String(page);
}
</script>

<template>
  <div v-if="loading" class="space-y-3" role="status" aria-live="polite">
    <span class="sr-only">Searching the tariff schedule…</span>
    <div
      v-for="index in 4"
      :key="index"
      class="h-16 animate-pulse rounded-lg border border-line bg-surface-muted/60"
      aria-hidden="true"
    />
  </div>

  <template v-else>
    <div class="hidden overflow-x-auto rounded-lg border border-line md:block">
      <table class="w-full min-w-[880px] text-left text-sm">
        <caption class="sr-only">
          Tariff search results. Every matching record is listed; none is selected automatically.
          <template v-if="selectable">
            Use a record to return it to the import calculator.
          </template>
        </caption>
        <thead class="bg-surface-muted/80 text-[11px] uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">HS code</th>
            <th scope="col" class="px-4 py-3 font-semibold">Description</th>
            <th scope="col" class="px-4 py-3 font-semibold">Recorded rate</th>
            <th scope="col" class="px-4 py-3 font-semibold">Schedule</th>
            <th scope="col" class="px-4 py-3 font-semibold">Source page</th>
            <th scope="col" class="px-4 py-3 font-semibold">Record</th>
            <th scope="col" class="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="row in items"
            :key="row.id"
            class="align-top transition-colors hover:bg-surface-muted/40"
            :class="selectedId === row.id ? 'bg-accent-soft/35' : ''"
          >
            <td class="px-4 py-4">
              <p class="font-mono text-sm font-semibold text-ink">{{ row.hsCode || '—' }}</p>
              <p class="mt-1 text-[11px] font-medium text-ink-subtle">
                {{ matchLabel(row) }}
                <template v-if="matchNote(row)"> · {{ matchNote(row) }}</template>
              </p>
            </td>
            <td class="max-w-[26rem] px-4 py-4">
              <p class="line-clamp-3 text-sm leading-6 text-ink-muted">
                {{ row.description || 'No description recorded in the source.' }}
              </p>
            </td>
            <td class="px-4 py-4">
              <span
                v-if="rateIsSensitive(row)"
                class="inline-flex items-center rounded-md border border-warning/35 bg-warning-soft px-2 py-1 font-mono text-xs font-semibold text-warning-ink"
                title="Sensitive Items reference, preserved exactly as recorded"
              >
                {{ row.rate ?? 'Rate not recorded' }}
              </span>
              <span v-else class="font-mono text-sm text-ink">{{ row.rate ?? 'Not recorded' }}</span>
            </td>
            <td class="px-4 py-4">
              <ScheduleBadge :schedule="row.scheduleType" />
            </td>
            <td class="px-4 py-4 text-sm text-ink-muted">{{ pageLabel(row.sourcePage) }}</td>
            <td class="px-4 py-4">
              <span class="font-mono text-xs text-ink-subtle">#{{ row.id }}</span>
            </td>
            <td class="px-4 py-4 text-right">
              <div class="flex flex-col items-end gap-2">
                <button
                  v-if="selectable"
                  type="button"
                  class="btn-primary px-3 py-1.5 text-xs"
                  :aria-label="`Use tariff ${row.hsCode || `record ${row.id}`} in the import calculator`"
                  @click="emit('select', row)"
                >
                  <Check class="h-3.5 w-3.5" aria-hidden="true" />
                  Use this tariff
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                  :aria-label="`View tariff details for ${row.hsCode || `record ${row.id}`}`"
                  @click="emit('inspect', row.id)"
                >
                  Details
                  <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="space-y-3 md:hidden">
      <article
        v-for="row in items"
        :key="row.id"
        class="rounded-xl border border-line bg-surface p-4 shadow-sm"
        :class="selectedId === row.id ? 'border-accent ring-1 ring-accent/20' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-base font-semibold text-ink">{{ row.hsCode || '—' }}</p>
            <p class="mt-1 text-[11px] font-medium text-ink-subtle">
              {{ matchLabel(row) }}
              <template v-if="matchNote(row)"> · {{ matchNote(row) }}</template>
            </p>
          </div>
          <ScheduleBadge :schedule="row.scheduleType" />
        </div>

        <p class="mt-3 text-sm leading-6 text-ink-muted">
          {{ row.description || 'No description recorded in the source.' }}
        </p>

        <dl class="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-muted/50 p-3">
          <div class="col-span-2">
            <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              Recorded rate
            </dt>
            <dd class="mt-1">
              <span
                v-if="rateIsSensitive(row)"
                class="inline-flex items-center rounded-md border border-warning/35 bg-warning-soft px-2 py-1 font-mono text-xs font-semibold text-warning-ink"
              >
                {{ row.rate ?? 'Rate not recorded' }}
              </span>
              <span v-else class="font-mono text-sm text-ink">{{ row.rate ?? 'Not recorded' }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              Source page
            </dt>
            <dd class="mt-1 text-sm text-ink-muted">{{ pageLabel(row.sourcePage) }}</dd>
          </div>
          <div>
            <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
              Record ID
            </dt>
            <dd class="mt-1 font-mono text-xs text-ink-muted">#{{ row.id }}</dd>
          </div>
        </dl>

        <button
          v-if="selectable"
          type="button"
          class="btn-primary mt-3 w-full"
          :aria-label="`Use tariff ${row.hsCode || `record ${row.id}`} in the import calculator`"
          @click="emit('select', row)"
        >
          <Check class="h-4 w-4" aria-hidden="true" />
          Use this tariff
        </button>

        <button
          type="button"
          class="btn-secondary mt-2 w-full"
          :aria-label="`View tariff details for ${row.hsCode || `record ${row.id}`}`"
          @click="emit('inspect', row.id)"
        >
          View tariff details
          <ArrowUpRight class="h-4 w-4" aria-hidden="true" />
        </button>
      </article>
    </div>
  </template>
</template>
