<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ArrowLeft, FileQuestionMark } from '@lucide/vue';
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center">
    <div class="surface-card w-full max-w-lg p-8 text-center sm:p-10">
      <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent"
      >
        <FileQuestionMark class="h-6 w-6" aria-hidden="true" />
      </div>
      <p class="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        Error 404
      </p>
      <h2 class="mt-2 text-xl font-semibold tracking-tight text-ink">Page not found</h2>
      <p class="mt-2 text-sm leading-6 text-ink-muted">
        The page you requested does not exist in this workspace. Return to the dashboard to
        continue.
      </p>
      <RouterLink to="/dashboard" class="btn-primary mt-6">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </RouterLink>
    </div>
  </div>
</template>
