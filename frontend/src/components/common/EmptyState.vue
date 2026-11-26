<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  icon: Component;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface-muted/40 px-6 py-10 text-center"
  >
    <div
      class="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-ink-subtle"
    >
      <component :is="icon" class="h-5 w-5" aria-hidden="true" />
    </div>
    <h3 class="mt-4 text-sm font-semibold text-ink">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-md text-sm leading-6 text-ink-muted">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="mt-5">
      <slot name="actions" />
    </div>
  </div>
</template>
