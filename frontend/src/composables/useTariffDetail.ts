import { ref } from 'vue';
import { ApiError } from '@/services/api/client';
import { getTariffById, getTariffContext } from '@/services/api/endpoints';
import type { ClassificationContext, TariffView } from '@/types/api';

/**
 * Tariff detail state.
 *
 * The tariff record and its classification context are requested separately, so
 * a missing or failed context never hides the source tariff line.
 */

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useTariffDetail() {
  const isOpen = ref(false);
  const isLoading = ref(false);
  const errorMessage = ref<string | null>(null);
  const contextError = ref<string | null>(null);
  const tariff = ref<TariffView | null>(null);
  const context = ref<ClassificationContext | null>(null);

  let sequence = 0;
  let lastId: number | null = null;

  async function show(id: number): Promise<void> {
    lastId = id;
    isOpen.value = true;
    isLoading.value = true;
    errorMessage.value = null;
    contextError.value = null;
    tariff.value = null;
    context.value = null;

    const attempt = ++sequence;
    const [detail, notes] = await Promise.allSettled([
      getTariffById(id),
      getTariffContext(id),
    ]);

    if (attempt !== sequence) return;

    if (detail.status === 'fulfilled') {
      tariff.value = detail.value.data;
    } else {
      errorMessage.value = messageOf(detail.reason, 'Unable to load this tariff line.');
    }

    if (notes.status === 'fulfilled') {
      context.value = notes.value.data;
    } else {
      contextError.value = messageOf(
        notes.reason,
        'Classification context could not be loaded for this tariff line.',
      );
    }

    isLoading.value = false;
  }

  function retry(): void {
    if (lastId !== null) void show(lastId);
  }

  function close(): void {
    sequence += 1;
    isOpen.value = false;
    isLoading.value = false;
  }

  return {
    isOpen,
    isLoading,
    errorMessage,
    contextError,
    tariff,
    context,
    show,
    retry,
    close,
  };
}
