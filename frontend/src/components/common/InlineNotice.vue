<script setup lang="ts">
import { computed } from 'vue';
import { Info, TriangleAlert } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    tone?: 'info' | 'warning';
    title: string;
  }>(),
  { tone: 'info' },
);

const icon = computed(() => (props.tone === 'warning' ? TriangleAlert : Info));

const toneClasses = computed(() =>
  props.tone === 'warning'
    ? {
        container: 'border-warning/30 bg-warning-soft',
        icon: 'text-warning-ink',
        title: 'text-warning-ink',
      }
    : {
        container: 'border-accent/20 bg-accent-soft',
        icon: 'text-accent',
        title: 'text-ink',
      },
);
</script>

<template>
  <div class="rounded-lg border px-4 py-3.5" :class="toneClasses.container">
    <div class="flex items-start gap-3">
      <component
        :is="icon"
        class="mt-0.5 h-4 w-4 shrink-0"
        :class="toneClasses.icon"
        aria-hidden="true"
      />
      <div class="min-w-0">
        <p class="text-sm font-semibold" :class="toneClasses.title">{{ title }}</p>
        <div v-if="$slots.default" class="mt-1 text-sm leading-6 text-ink-muted">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
