import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { CalculationState, ImportCostResult } from '@/types/api';

/**
 * Client-side index of calculations created in this browser.
 *
 * The backend exposes retrieval by reference (`GET /calculations/import-cost/:id`)
 * but no list endpoint, so the history index is maintained locally from the
 * responses returned by the calculation API. Summary fields come from the API
 * response; nothing is calculated or inferred in the browser.
 */

export interface HistoryEntry {
  calculationId: string;
  state: CalculationState;
  generatedAt: string;
  hsCode: string;
  tariffDescription: string | null;
  originCountry: string | null;
  destination: string;
  currency: string;
  reference: string | null;
  totalImportCharges: string | null;
  estimatedLandedCost: string | null;
}

const STORAGE_KEY = 'cet-calculation-history';

function readEntries(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<HistoryEntry>;
  return (
    typeof candidate.calculationId === 'string' &&
    typeof candidate.state === 'string' &&
    typeof candidate.generatedAt === 'string' &&
    typeof candidate.hsCode === 'string' &&
    typeof candidate.destination === 'string' &&
    typeof candidate.currency === 'string'
  );
}

function entryFromResult(result: ImportCostResult): HistoryEntry {
  return {
    calculationId: result.calculationId,
    state: result.state,
    generatedAt: result.generatedAt,
    hsCode: result.inputs.hsCode,
    tariffDescription: result.tariff?.description ?? null,
    originCountry: result.inputs.originCountry ?? null,
    destination: result.destination,
    currency: result.valuation.currency || result.inputs.currency,
    reference: result.reference ?? result.inputs.reference ?? null,
    totalImportCharges: result.totals?.totalImportCharges ?? null,
    estimatedLandedCost: result.totals?.estimatedLandedCost ?? null,
  };
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(readEntries());

  watch(
    entries,
    (value) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* Storage can be unavailable; the in-memory index still works. */
      }
    },
    { deep: true },
  );

  function record(result: ImportCostResult): void {
    const entry = entryFromResult(result);
    const withoutDuplicate = entries.value.filter(
      (existing) => existing.calculationId !== entry.calculationId,
    );
    entries.value = [entry, ...withoutDuplicate];
  }

  function remove(calculationId: string): void {
    entries.value = entries.value.filter((entry) => entry.calculationId !== calculationId);
  }

  function clear(): void {
    entries.value = [];
  }

  function update(entry: HistoryEntry): void {
    const index = entries.value.findIndex(
      (existing) => existing.calculationId === entry.calculationId,
    );
    if (index === -1) {
      entries.value = [entry, ...entries.value];
      return;
    }
    const next = [...entries.value];
    next[index] = entry;
    entries.value = next;
  }

  return { entries, record, remove, clear, update };
});
