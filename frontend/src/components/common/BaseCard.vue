<script setup lang="ts">
import { computed } from 'vue';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    padding?: Padding;
  }>(),
  { padding: 'md' },
);

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'px-4 py-4 sm:px-5',
  md: 'px-5 py-5 sm:px-6',
  lg: 'px-5 py-6 sm:px-8 sm:py-8',
};

const bodyClass = computed(() => paddingClasses[props.padding]);
</script>

<template>
  <section class="surface-card overflow-hidden">
    <header
      v-if="title || description || $slots.header"
      class="border-b border-line px-5 py-4 sm:px-6"
    >
      <slot name="header">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 v-if="title" class="text-base font-semibold tracking-tight text-ink">
              {{ title }}
            </h2>
            <p v-if="description" class="mt-1 text-sm leading-5 text-ink-muted">
              {{ description }}
            </p>
          </div>
          <slot name="actions" />
        </div>
      </slot>
    </header>

    <div :class="bodyClass">
      <slot />
    </div>

    <footer
      v-if="$slots.footer"
      class="border-t border-line bg-surface-muted/60 px-5 py-3 sm:px-6"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
