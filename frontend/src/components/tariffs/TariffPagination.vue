<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import type { PaginationMeta } from '@/types/api';

const props = defineProps<{
  pagination: PaginationMeta;
}>();

const emit = defineEmits<{
  change: [page: number];
}>();

const rangeStart = computed(() =>
  props.pagination.total === 0 ? 0 : (props.pagination.page - 1) * props.pagination.pageSize + 1,
);

const rangeEnd = computed(() =>
  Math.min(props.pagination.page * props.pagination.pageSize, props.pagination.total),
);

const pageCount = computed(() => Math.max(1, props.pagination.totalPages));
</script>

<template>
  <div
    class="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-xs text-ink-muted">
      Showing
      <span class="font-semibold text-ink">{{ rangeStart }}–{{ rangeEnd }}</span>
      of
      <span class="font-semibold text-ink">{{ pagination.total }}</span>
      records
      <span class="text-ink-subtle">· page {{ pagination.page }} of {{ pageCount }}</span>
    </p>

    <nav class="flex items-center gap-2" aria-label="Search result pages">
      <button
        type="button"
        class="btn-secondary px-3 py-2 text-xs"
        :disabled="!pagination.hasPreviousPage"
        @click="emit('change', pagination.page - 1)"
      >
        <ChevronLeft class="h-4 w-4" aria-hidden="true" />
        Previous
      </button>
      <button
        type="button"
        class="btn-secondary px-3 py-2 text-xs"
        :disabled="!pagination.hasNextPage"
        @click="emit('change', pagination.page + 1)"
      >
        Next
        <ChevronRight class="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  </div>
</template>
