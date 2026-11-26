<script setup lang="ts">
import { ArrowUpRight, Check } from '@lucide/vue';
import type { MatchType, RateKind } from '@/types/api';
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

const rateKindLabels: Record<RateKind, string> = {
  percentage: 'Percentage',
  specific: 'Specific',
  compound: 'Compound',
  sensitive_item: 'Sensitive item',
  free: 'Free',
  unknown: 'Rate form not recorded',
};

function isSensitive(row: TariffSearchRow): boolean {
  return (
    row.rateAnalysis.isSensitiveItem ||
    (row.rate ?? '').trim().toUpperCase() === 'SI'
  );
}

function rateKindLabel(row: TariffSearchRow): string {
  if (isSensitive(row)) return rateKindLabels.sensitive_item;
  return rateKindLabels[row.rateAnalysis.kind] ?? rateKindLabels.unknown;
}

/** Chapter and heading are returned fields; the HS code is the tariff line. */
function hierarchy(row: TariffSearchRow): string {
  const parts: string[] = [];
  if (row.chapterCode) parts.push(`Chapter ${row.chapterCode}`);
  if (row.heading) parts.push(`Heading ${row.heading}`);
  return parts.join(' · ');
}

function matchLabel(row: TariffSearchRow): string | null {
  return row.matchType ? matchLabels[row.matchType] : null;
}
</script>

<template>
  <div v-if="loading" class="space-y-2" role="status" aria-live="polite">
    <span class="sr-only">Searching the tariff schedule…</span>
    <div
      v-for="index in 4"
      :key="index"
      class="h-14 animate-pulse rounded-lg border border-line bg-surface-muted/60"
      aria-hidden="true"
    />
  </div>

  <template v-else>
    <!-- Desktop: comparison list -->
    <div class="hidden overflow-x-auto rounded-lg border border-line md:block">
      <table class="w-full min-w-[720px] text-left text-sm">
        <caption class="sr-only">
          Tariff search results. Every matching record is listed; none is selected automatically.
          <template v-if="selectable">
            Use a record to return it to the import calculator.
          </template>
        </caption>
        <thead class="bg-surface-muted/80 text-[11px] uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">Tariff line</th>
            <th scope="col" class="px-4 py-3 font-semibold">Description</th>
            <th scope="col" class="px-4 py-3 font-semibold">Rate</th>
            <th scope="col" class="px-4 py-3 font-semibold">Schedule</th>
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
            <td class="min-w-[11rem] px-4 py-4">
              <p class="font-mono text-sm font-semibold text-ink">{{ row.hsCode || '—' }}</p>
              <p v-if="hierarchy(row)" class="mt-1 text-[11px] text-ink-subtle">
                {{ hierarchy(row) }}
              </p>
              <p v-if="matchLabel(row)" class="mt-0.5 text-[11px] text-ink-subtle">
                {{ matchLabel(row) }} match
              </p>
            </td>
            <td class="max-w-[30rem] px-4 py-4">
              <p class="text-sm leading-6 text-ink">
                {{ row.description || 'No description recorded in the source.' }}
              </p>
            </td>
            <td class="px-4 py-4">
              <p
                class="font-mono text-sm font-semibold"
                :class="isSensitive(row) ? 'text-warning-ink' : 'text-ink'"
              >
                {{ row.rate ?? 'Not recorded' }}
              </p>
              <p class="mt-0.5 text-[11px] text-ink-subtle">{{ rateKindLabel(row) }}</p>
            </td>
            <td class="px-4 py-4">
              <ScheduleBadge :schedule="row.scheduleType" />
            </td>
            <td class="px-4 py-4 text-right">
              <div class="flex flex-col items-end gap-1.5">
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

    <!-- Mobile: stacked records -->
    <div class="space-y-3 md:hidden">
      <article
        v-for="row in items"
        :key="row.id"
        class="rounded-lg border border-line bg-surface p-4"
        :class="selectedId === row.id ? 'border-accent ring-1 ring-accent/20' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-base font-semibold text-ink">{{ row.hsCode || '—' }}</p>
            <p v-if="hierarchy(row)" class="mt-1 text-[11px] text-ink-subtle">
              {{ hierarchy(row) }}
            </p>
          </div>
          <ScheduleBadge :schedule="row.scheduleType" />
        </div>

        <p class="mt-3 text-sm leading-6 text-ink">
          {{ row.description || 'No description recorded in the source.' }}
        </p>

        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Rate</span>
          <span
            class="font-mono text-sm font-semibold"
            :class="isSensitive(row) ? 'text-warning-ink' : 'text-ink'"
          >
            {{ row.rate ?? 'Not recorded' }}
          </span>
          <span class="text-[11px] text-ink-subtle">· {{ rateKindLabel(row) }}</span>
        </div>

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
          View details
          <ArrowUpRight class="h-4 w-4" aria-hidden="true" />
        </button>
      </article>
    </div>
  </template>
</template>
