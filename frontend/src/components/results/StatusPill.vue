<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck, CircleX, Info, TriangleAlert } from '@lucide/vue';
import type { StatusTone } from '@/utils/calculationResult';

const props = withDefaults(
  defineProps<{
    tone: StatusTone;
    label: string;
    size?: 'sm' | 'md';
  }>(),
  { size: 'sm' },
);

const icon = computed(() => {
  switch (props.tone) {
    case 'accent':
      return CircleCheck;
    case 'warning':
      return TriangleAlert;
    case 'danger':
      return CircleX;
    default:
      return Info;
  }
});

const toneClass = computed(() => {
  switch (props.tone) {
    case 'accent':
      return 'border-accent/25 bg-accent-soft text-accent';
    case 'warning':
      return 'border-warning/35 bg-warning-soft text-warning-ink';
    case 'danger':
      return 'border-danger/30 bg-danger-soft text-danger-ink';
    default:
      return 'border-line-strong bg-surface-muted text-ink-muted';
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border font-semibold"
    :class="[
      toneClass,
      size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]',
    ]"
  >
    <component
      :is="icon"
      :class="size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>
