<script setup lang="ts">
import { Info } from '@lucide/vue';
import { splitWarning } from '@/utils/warnings';

defineProps<{
  warnings: string[];
}>();
</script>

<template>
  <ul class="space-y-2.5">
    <li
      v-for="warning in warnings"
      :key="warning"
      class="flex items-start gap-2.5 text-sm leading-6 text-ink-muted"
    >
      <Info class="mt-1 h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span class="min-w-0">
        <code
          v-if="splitWarning(warning).code"
          class="mr-1.5 rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-subtle"
        >
          {{ splitWarning(warning).code }}
        </code>
        {{ splitWarning(warning).message }}
      </span>
    </li>
  </ul>
</template>
