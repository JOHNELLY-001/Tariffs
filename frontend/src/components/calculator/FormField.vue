<script setup lang="ts">
import { computed, useId } from 'vue';

const props = withDefaults(
  defineProps<{
    id?: string;
    label: string;
    required?: boolean;
    optional?: boolean;
    error?: string | null;
    hint?: string;
  }>(),
  { required: false, optional: false },
);

const generatedId = useId();
const fieldId = computed(() => props.id ?? generatedId);
const errorId = computed(() => `${fieldId.value}-error`);
const hintId = computed(() => `${fieldId.value}-hint`);

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.hint) ids.push(hintId.value);
  if (props.error) ids.push(errorId.value);
  return ids.length > 0 ? ids.join(' ') : undefined;
});
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <label :for="fieldId" class="field-label">
        {{ label }}
        <span v-if="required" class="ml-0.5 text-danger" aria-hidden="true">*</span>
        <span v-if="required" class="sr-only">(required)</span>
        <span v-else-if="optional" class="ml-1 text-xs font-normal text-ink-subtle">
          Optional
        </span>
      </label>
      <slot name="labelAside" />
    </div>

    <div class="mt-1.5">
      <slot :id="fieldId" :described-by="describedBy" :invalid="Boolean(error)" />
    </div>

    <p v-if="hint" :id="hintId" class="field-hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
