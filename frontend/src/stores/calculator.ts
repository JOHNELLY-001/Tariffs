import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { TariffView } from '@/types/api';

/**
 * Import-cost calculator draft.
 *
 * The draft is kept in sessionStorage so navigating to the Tariff Explorer to
 * choose a record never discards the user's work. Only the form values and the
 * explicitly selected tariff are stored; no calculation is performed here.
 */

export type ValuationBasis = 'invoiceValue' | 'customsValue';

export interface CalculatorDraft {
  hsCode: string;
  destination: 'TZ_MAINLAND';
  originCountry: string;
  simulationDate: string;
  currency: string;
  valuationBasis: ValuationBasis;
  invoiceValue: string;
  customsValue: string;
  freight: string;
  insurance: string;
  otherCosts: string;
  quantity: string;
  unit: string;
  reference: string;
  preferentialTreatment: boolean;
}

interface PersistedState {
  draft: CalculatorDraft;
  selectedTariff: TariffView | null;
}

const STORAGE_KEY = 'cet-import-calculator-draft';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createDefaultDraft(): CalculatorDraft {
  return {
    hsCode: '',
    destination: 'TZ_MAINLAND',
    originCountry: '',
    simulationDate: todayIso(),
    currency: 'TZS',
    valuationBasis: 'invoiceValue',
    invoiceValue: '',
    customsValue: '',
    freight: '',
    insurance: '',
    otherCosts: '',
    quantity: '',
    unit: '',
    reference: '',
    preferentialTreatment: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTariffView(value: unknown): value is TariffView {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.hsCode === 'string' &&
    (value.description === null || typeof value.description === 'string') &&
    (value.rate === null || typeof value.rate === 'string') &&
    (value.scheduleType === null || typeof value.scheduleType === 'string') &&
    isRecord(value.rateAnalysis)
  );
}

function loadState(): PersistedState {
  const fallback: PersistedState = { draft: createDefaultDraft(), selectedTariff: null };
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;

    const storedDraft = isRecord(parsed.draft) ? parsed.draft : {};
    const draft: CalculatorDraft = {
      ...fallback.draft,
      ...storedDraft,
      destination: 'TZ_MAINLAND',
    };

    if (draft.valuationBasis !== 'invoiceValue' && draft.valuationBasis !== 'customsValue') {
      draft.valuationBasis = 'invoiceValue';
    }

    return {
      draft,
      selectedTariff: isTariffView(parsed.selectedTariff) ? parsed.selectedTariff : null,
    };
  } catch {
    return fallback;
  }
}

export const useCalculatorStore = defineStore('calculator', () => {
  const initial = loadState();

  const draft = ref<CalculatorDraft>(initial.draft);
  const selectedTariff = ref<TariffView | null>(initial.selectedTariff);

  function persist(): void {
    if (typeof window === 'undefined') return;

    try {
      const payload: PersistedState = {
        draft: draft.value,
        selectedTariff: selectedTariff.value,
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* Session storage can be unavailable; the in-memory draft still works. */
    }
  }

  watch([draft, selectedTariff], persist, { deep: true });

  function selectTariff(tariff: TariffView): void {
    selectedTariff.value = tariff;
    draft.value.hsCode = tariff.hsCode;

    if (!draft.value.currency) draft.value.currency = 'TZS';
  }

  function clearTariff(): void {
    selectedTariff.value = null;
  }

  function reset(): void {
    draft.value = createDefaultDraft();
    selectedTariff.value = null;
  }

  return {
    draft,
    selectedTariff,
    selectTariff,
    clearTariff,
    reset,
    persist,
  };
});
