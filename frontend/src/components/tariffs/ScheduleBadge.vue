<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  schedule: string | null;
}>();

const label = computed(() => props.schedule?.trim() || 'Schedule not recorded');

const classes = computed(() => {
  const normalized = props.schedule?.trim().toUpperCase();

  if (normalized === 'MAIN_TARIFF') {
    return 'border-accent/25 bg-accent-soft text-accent';
  }
  if (normalized === 'SENSITIVE_ITEMS') {
    return 'border-warning/35 bg-warning-soft text-warning-ink';
  }
  return 'border-line-strong bg-surface-muted text-ink-muted';
});
</script>

<template>
  <span
    class="inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
    :class="classes"
  >
    <span class="truncate">{{ label }}</span>
  </span>
</template>
