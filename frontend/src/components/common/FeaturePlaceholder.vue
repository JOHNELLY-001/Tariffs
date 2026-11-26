<script setup lang="ts">
import type { Component } from 'vue';
import { Check } from '@lucide/vue';

withDefaults(
  defineProps<{
    icon: Component;
    eyebrow?: string;
    title: string;
    description: string;
    highlights?: string[];
    footnote?: string;
    statusLabel?: string;
  }>(),
  {
    highlights: () => [],
    statusLabel: 'Planned for a later milestone',
  },
);
</script>

<template>
  <section class="surface-card overflow-hidden">
    <div class="border-b border-line bg-surface-muted/50 px-6 py-8 sm:px-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <component :is="icon" class="h-6 w-6" aria-hidden="true" />
        </div>
        <span
          class="inline-flex items-center rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink-muted"
        >
          {{ statusLabel }}
        </span>
      </div>

      <p
        v-if="eyebrow"
        class="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle"
      >
        {{ eyebrow }}
      </p>
      <h2 class="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{{ title }}</h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{{ description }}</p>
    </div>

    <div class="grid gap-6 px-6 py-6 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <ul v-if="highlights.length" class="space-y-3">
        <li v-for="highlight in highlights" :key="highlight" class="flex gap-3">
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <Check class="h-3 w-3" aria-hidden="true" />
          </span>
          <span class="text-sm leading-6 text-ink-muted">{{ highlight }}</span>
        </li>
      </ul>

      <div v-if="footnote" class="rounded-lg border border-line bg-surface-muted/60 p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Note</p>
        <p class="mt-2 text-sm leading-6 text-ink-muted">{{ footnote }}</p>
      </div>
    </div>

    <div v-if="$slots.actions" class="border-t border-line px-6 py-4 sm:px-8">
      <slot name="actions" />
    </div>
  </section>
</template>
