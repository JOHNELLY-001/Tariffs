import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { ImportCostResult } from '@/types/api';

/**
 * Last backend calculation, kept only so the temporary result view can render
 * immediately after submission. The calculation id remains the authoritative
 * reference and the result view can refetch it from the API.
 */

const STORAGE_KEY = 'cet-last-calculation';

function readLastResult(): ImportCostResult | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Partial<ImportCostResult>;
    if (typeof candidate.calculationId !== 'string' || typeof candidate.state !== 'string') {
      return null;
    }
    return candidate as ImportCostResult;
  } catch {
    return null;
  }
}

export const useCalculationStore = defineStore('calculation', () => {
  const lastResult = ref<ImportCostResult | null>(readLastResult());

  watch(
    lastResult,
    (result) => {
      if (typeof window === 'undefined') return;
      try {
        if (result) {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        /* Session storage can be unavailable; the in-memory result still works. */
      }
    },
    { deep: true },
  );

  function setResult(result: ImportCostResult): void {
    lastResult.value = result;
  }

  function clear(): void {
    lastResult.value = null;
  }

  return { lastResult, setResult, clear };
});
