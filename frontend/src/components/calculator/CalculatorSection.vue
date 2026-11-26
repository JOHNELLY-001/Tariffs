<script setup lang="ts">
defineProps<{
  step: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <section class="surface-card overflow-hidden">
    <header class="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent"
        aria-hidden="true"
      >
        {{ step }}
      </span>
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-tight text-ink">{{ title }}</h2>
        <p v-if="description" class="mt-1 text-sm leading-5 text-ink-muted">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="ml-auto shrink-0">
        <slot name="actions" />
      </div>
    </header>

    <div class="px-5 py-5 sm:px-6">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-t border-line bg-surface-muted/50 px-5 py-3 sm:px-6">
      <slot name="footer" />
    </footer>
  </section>
</template>
