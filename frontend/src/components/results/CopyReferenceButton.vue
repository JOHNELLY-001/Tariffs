<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { Check, Copy } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    value: string;
    variant?: 'inline' | 'button';
    label?: string;
  }>(),
  { variant: 'inline', label: 'Copy reference' },
);

const copied = ref(false);
let timer: number | undefined;

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.value);
    copied.value = true;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    copied.value = false;
  }
}

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearTimeout(timer);
});
</script>

<template>
  <button
    type="button"
    :class="variant === 'button' ? 'btn-secondary print:hidden' : 'print:hidden'"
    :aria-label="copied ? 'Calculation reference copied' : label"
    @click="copy"
  >
    <template v-if="variant === 'button'">
      <Check v-if="copied" class="h-4 w-4 text-accent" aria-hidden="true" />
      <Copy v-else class="h-4 w-4" aria-hidden="true" />
      {{ copied ? 'Reference copied' : 'Copy reference' }}
    </template>
    <template v-else>
      <span
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent-soft"
      >
        <Check v-if="copied" class="h-3.5 w-3.5" aria-hidden="true" />
        <Copy v-else class="h-3.5 w-3.5" aria-hidden="true" />
        {{ copied ? 'Copied' : 'Copy' }}
      </span>
    </template>
    <span class="sr-only" role="status" aria-live="polite">
      {{ copied ? 'Calculation reference copied to the clipboard.' : '' }}
    </span>
  </button>
</template>
