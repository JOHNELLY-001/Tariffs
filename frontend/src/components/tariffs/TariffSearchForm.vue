<script setup lang="ts">
import { LoaderCircle, Search, X } from '@lucide/vue';

const props = defineProps<{
  modelValue: string;
  loading: boolean;
  inputError: string | null;
  canClear: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [];
  clear: [];
}>();

const MAX_QUERY_LENGTH = 120;

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}

function clear(): void {
  if (props.loading) return;
  emit('clear');
}
</script>

<template>
  <form role="search" class="space-y-4" @submit.prevent="emit('submit')">
    <div>
      <label for="tariff-search" class="text-sm font-semibold text-ink">
        HS code or product description
      </label>

      <div class="mt-2 flex flex-col gap-2 sm:flex-row">
        <div class="relative min-w-0 flex-1">
          <Search
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            id="tariff-search"
            :value="modelValue"
            type="search"
            name="tariff-search"
            inputmode="search"
            enterkeyhint="search"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :maxlength="MAX_QUERY_LENGTH"
            placeholder="e.g. 8471.30 or “rice”"
            class="h-11 w-full rounded-lg border border-line-strong bg-surface pl-10 pr-10 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-subtle hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            :aria-invalid="inputError ? 'true' : undefined"
            aria-describedby="tariff-search-hint tariff-search-error"
            @input="onInput"
          />
          <button
            v-if="modelValue"
            type="button"
            class="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Clear search text"
            :disabled="loading"
            @click="emit('update:modelValue', '')"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="submit"
          class="btn-primary h-11 shrink-0"
          :disabled="loading"
        >
          <LoaderCircle v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <Search v-else class="h-4 w-4" aria-hidden="true" />
          {{ loading ? 'Searching…' : 'Search' }}
        </button>
      </div>

      <p id="tariff-search-hint" class="mt-2 text-xs leading-5 text-ink-subtle">
        Enter at least 2 characters. Exact and partial HS codes and product descriptions are
        supported. Press Enter or choose Search — typing alone does not send a request.
      </p>

      <p
        v-if="inputError"
        id="tariff-search-error"
        class="mt-2 text-sm font-medium text-warning-ink"
        role="alert"
      >
        {{ inputError }}
      </p>

      <button
        v-if="canClear && !loading"
        type="button"
        class="mt-3 text-xs font-semibold text-accent underline-offset-4 hover:underline"
        @click="clear"
      >
        Clear search and results
      </button>
    </div>
  </form>
</template>
