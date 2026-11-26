<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import {
  ArrowUpRight,
  Calculator,
  Check,
  CircleCheck,
  CircleX,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from '@lucide/vue';
import CalculatorSection from '@/components/calculator/CalculatorSection.vue';
import FormField from '@/components/calculator/FormField.vue';
import ReviewDialog from '@/components/calculator/ReviewDialog.vue';
import SelectedTariffCard from '@/components/calculator/SelectedTariffCard.vue';
import TariffCandidatePicker from '@/components/calculator/TariffCandidatePicker.vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import PageContainer from '@/components/common/PageContainer.vue';
import ScheduleBadge from '@/components/tariffs/ScheduleBadge.vue';
import { useCalculationStore } from '@/stores/calculation';
import { useCalculatorStore, type ValuationBasis } from '@/stores/calculator';
import { useHistoryStore } from '@/stores/history';
import { ApiError } from '@/services/api/client';
import { calculateImportCost, getTariffByHsCode } from '@/services/api/endpoints';
import type { TariffView } from '@/types/api';
import {
  buildImportCostRequest,
  hasFormErrors,
  hsDigits,
  type ImportCostFormErrors,
  type TariffValidationContext,
  validateImportCostForm,
} from '@/utils/importCost';

type LookupState = 'idle' | 'loading' | 'single' | 'ambiguous' | 'not_found' | 'error';
type LookupOutcome = 'selected' | 'ambiguous' | 'not_found' | 'error' | 'idle';

interface SubmissionFailure {
  message: string;
  code: string | null;
  requestId: string | null;
  details: string[];
}

interface ReviewItem {
  label: string;
  value: string;
}

interface ReviewGroup {
  title: string;
  items: ReviewItem[];
}

const router = useRouter();
const calculator = useCalculatorStore();
const calculationStore = useCalculationStore();
const historyStore = useHistoryStore();
const { draft, selectedTariff } = storeToRefs(calculator);

const errors = ref<ImportCostFormErrors>({});
const hasAttemptedSubmit = ref(false);

const lookupState = ref<LookupState>('idle');
const candidates = ref<TariffView[]>([]);
const lookupError = ref('');
const lastLookupDigits = ref('');
let lookupSequence = 0;

const reviewOpen = ref(false);
const isSubmitting = ref(false);
const isResolving = ref(false);
const submissionError = ref<SubmissionFailure | null>(null);

const isBusy = computed(() => isSubmitting.value || isResolving.value);
const currencyCode = computed(() => draft.value.currency.trim().toUpperCase() || 'currency');
const valuationAmount = computed(() =>
  draft.value.valuationBasis === 'invoiceValue' ? draft.value.invoiceValue : draft.value.customsValue,
);
const validationCount = computed(() => Object.keys(errors.value).length);

const valuationOptions: Array<{
  value: ValuationBasis;
  title: string;
  description: string;
}> = [
  {
    value: 'invoiceValue',
    title: 'Invoice value',
    description: 'The transaction or invoice amount for the goods, before freight and insurance.',
  },
  {
    value: 'customsValue',
    title: 'Customs value',
    description: 'A declared customs value that has already been determined outside this form.',
  },
];

const currencyOptions = computed(() => {
  const options = [
    { code: 'TZS', label: 'TZS — Tanzanian shilling' },
    { code: 'USD', label: 'USD — US dollar' },
    { code: 'EUR', label: 'EUR — Euro' },
    { code: 'GBP', label: 'GBP — Pound sterling' },
    { code: 'KES', label: 'KES — Kenyan shilling' },
    { code: 'UGX', label: 'UGX — Ugandan shilling' },
    { code: 'RWF', label: 'RWF — Rwandan franc' },
    { code: 'BIF', label: 'BIF — Burundian franc' },
    { code: 'CDF', label: 'CDF — Congolese franc' },
    { code: 'ZMW', label: 'ZMW — Zambian kwacha' },
    { code: 'MWK', label: 'MWK — Malawian kwacha' },
    { code: 'MZN', label: 'MZN — Mozambican metical' },
    { code: 'ZAR', label: 'ZAR — South African rand' },
    { code: 'CNY', label: 'CNY — Chinese yuan' },
    { code: 'INR', label: 'INR — Indian rupee' },
    { code: 'AED', label: 'AED — UAE dirham' },
    { code: 'JPY', label: 'JPY — Japanese yen' },
  ];

  const current = currencyCode.value;
  if (current !== 'currency' && !options.some((option) => option.code === current)) {
    options.unshift({ code: current, label: current });
  }
  return options;
});

const reviewGroups = computed<ReviewGroup[]>(() => {
  const currency = currencyCode.value;
  const tariff = selectedTariff.value;
  const quantity = draft.value.quantity.trim();

  return [
    {
      title: 'Tariff',
      items: [
        { label: 'HS code', value: draft.value.hsCode.trim() || '—' },
        {
          label: 'Tariff record',
          value: tariff
            ? `#${tariff.id} · ${tariff.rate ?? 'Rate not recorded'}`
            : 'Not selected',
        },
        {
          label: 'Schedule type',
          value: tariff?.scheduleType ?? 'Not recorded',
        },
        {
          label: 'Product description',
          value: tariff?.description || 'Not recorded',
        },
      ],
    },
    {
      title: 'Import information',
      items: [
        {
          label: 'Country of origin',
          value: draft.value.originCountry.trim().toUpperCase() || 'Not provided',
        },
        { label: 'Destination', value: 'Tanzania mainland (TZ_MAINLAND)' },
        { label: 'Simulation date', value: draft.value.simulationDate || '—' },
      ],
    },
    {
      title: 'Valuation',
      items: [
        {
          label: draft.value.valuationBasis === 'invoiceValue' ? 'Invoice value' : 'Customs value',
          value: `${valuationAmount.value.trim() || '—'} ${currency}`,
        },
        { label: 'Currency', value: currency },
        {
          label: 'Freight',
          value: `${draft.value.freight.trim() || '0'} ${currency}`,
        },
        {
          label: 'Insurance',
          value: `${draft.value.insurance.trim() || '0'} ${currency}`,
        },
        {
          label: 'Other costs',
          value: `${draft.value.otherCosts.trim() || '0'} ${currency}`,
        },
      ],
    },
    {
      title: 'Quantity',
      items: [
        {
          label: 'Quantity',
          value: quantity ? `${quantity} ${draft.value.unit.trim()}` : 'Not provided',
        },
        {
          label: 'Preferential treatment',
          value: draft.value.preferentialTreatment ? 'Requested' : 'Not requested',
        },
        {
          label: 'Reference',
          value: draft.value.reference.trim() || 'Not provided',
        },
      ],
    },
  ];
});

function currentValidationContext(): TariffValidationContext {
  return {
    ambiguousCandidateCount: lookupState.value === 'ambiguous' ? candidates.value.length : 0,
  };
}

function clearFieldError(field: keyof ImportCostFormErrors): void {
  if (errors.value[field]) delete errors.value[field];
}

function clearLookupState(): void {
  lookupSequence += 1;
  lookupState.value = 'idle';
  candidates.value = [];
  lookupError.value = '';
  lastLookupDigits.value = '';
}

function onHsInput(): void {
  clearFieldError('hsCode');
  clearFieldError('tariff');

  const digits = hsDigits(draft.value.hsCode);
  if (digits !== lastLookupDigits.value) {
    lookupSequence += 1;
    lookupState.value = 'idle';
    candidates.value = [];
    lookupError.value = '';
    lastLookupDigits.value = '';
  }
}

watch(
  () => draft.value.hsCode,
  (value) => {
    const tariff = selectedTariff.value;
    if (tariff && hsDigits(tariff.hsCode) !== hsDigits(value)) {
      calculator.clearTariff();
    }
  },
);

async function resolveTariff(quiet = false): Promise<LookupOutcome> {
  const code = draft.value.hsCode.trim();
  const digits = hsDigits(code);

  clearFieldError('tariff');

  if (!code || digits.length < 2) {
    clearLookupState();
    return 'idle';
  }

  if (selectedTariff.value && hsDigits(selectedTariff.value.hsCode) === digits) {
    lookupState.value = 'single';
    return 'selected';
  }

  const attempt = ++lookupSequence;
  lookupState.value = 'loading';
  lookupError.value = '';
  lastLookupDigits.value = digits;

  try {
    const result = await getTariffByHsCode(code);
    if (attempt !== lookupSequence) return 'idle';

    candidates.value = result.data.matches;

    if (result.data.matches.length === 1) {
      const only = result.data.matches[0];
      if (!only) throw new Error('The tariff lookup returned no usable record.');
      calculator.selectTariff(only);
      lookupState.value = 'single';
      return 'selected';
    }

    if (result.data.matches.length > 1) {
      const existing = selectedTariff.value;
      const stillPresent = existing
        ? result.data.matches.some((candidate) => candidate.id === existing.id)
        : false;

      if (!stillPresent) calculator.clearTariff();

      lookupState.value = 'ambiguous';
      return stillPresent ? 'selected' : 'ambiguous';
    }

    calculator.clearTariff();
    lookupState.value = 'not_found';
    return 'not_found';
  } catch (error) {
    if (attempt !== lookupSequence) return 'idle';

    if (error instanceof ApiError && error.status === 404) {
      candidates.value = [];
      calculator.clearTariff();
      lookupState.value = 'not_found';
      return 'not_found';
    }

    lookupState.value = 'error';
    lookupError.value =
      error instanceof ApiError
        ? error.message
        : 'The tariff lookup could not be completed. Please try again.';
    if (!quiet) errors.value.tariff = lookupError.value;
    return 'error';
  }
}

function onHsBlur(): void {
  const digits = hsDigits(draft.value.hsCode);
  if (digits.length < 4) return;
  if (selectedTariff.value && hsDigits(selectedTariff.value.hsCode) === digits) return;
  if (lookupState.value === 'loading' || digits === lastLookupDigits.value) return;
  void resolveTariff(true);
}

function selectCandidate(tariff: TariffView): void {
  calculator.selectTariff(tariff);
  lookupState.value = 'ambiguous';
  clearFieldError('tariff');
}

function clearTariffSelection(): void {
  calculator.clearTariff();
  clearLookupState();
  clearFieldError('tariff');
}

function browseTariffs(): void {
  const query: Record<string, string> = { intent: 'calculator' };
  if (hsDigits(draft.value.hsCode).length >= 2) query.q = draft.value.hsCode.trim();
  void router.push({ name: 'tariffs', query });
}

async function focusFirstError(): Promise<void> {
  await nextTick();
  const form = document.querySelector<HTMLElement>('[data-calculator-form]');
  const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
  const target = invalid ?? document.getElementById('tariff-selection');
  target?.focus();
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleReview(): Promise<void> {
  if (isBusy.value) return;

  hasAttemptedSubmit.value = true;
  submissionError.value = null;

  errors.value = validateImportCostForm(
    draft.value,
    selectedTariff.value,
    currentValidationContext(),
  );

  if (hasFormErrors(errors.value)) {
    await focusFirstError();
    return;
  }

  const needsResolution =
    !selectedTariff.value ||
    hsDigits(selectedTariff.value.hsCode) !== hsDigits(draft.value.hsCode);

  if (needsResolution) {
    isResolving.value = true;
    const outcome = await resolveTariff(false);
    isResolving.value = false;

    if (outcome === 'ambiguous') {
      errors.value.tariff = `This HS code has ${candidates.value.length} tariff records. Choose the record to use before calculating.`;
      await focusFirstError();
      return;
    }
    if (outcome === 'not_found') {
      errors.value.tariff = 'No tariff record matches this HS code. Check the code or use the Tariff Explorer.';
      await focusFirstError();
      return;
    }
    if (outcome === 'error') {
      errors.value.tariff = lookupError.value || 'The tariff record could not be resolved.';
      await focusFirstError();
      return;
    }
    if (outcome !== 'selected') {
      errors.value.tariff = 'Resolve the HS code to a tariff record before calculating.';
      await focusFirstError();
      return;
    }

    errors.value = validateImportCostForm(
      draft.value,
      selectedTariff.value,
      currentValidationContext(),
    );
    if (hasFormErrors(errors.value)) {
      await focusFirstError();
      return;
    }
  }

  reviewOpen.value = true;
}

function resetForm(): void {
  calculator.reset();
  errors.value = {};
  hasAttemptedSubmit.value = false;
  submissionError.value = null;
  clearLookupState();
}

function describeFailure(error: unknown): SubmissionFailure {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      details: error.details.map((detail) =>
        detail.path ? `${detail.path}: ${detail.message}` : detail.message,
      ),
    };
  }

  return {
    message: 'An unexpected client error occurred before the calculation could be submitted.',
    code: null,
    requestId: null,
    details: [],
  };
}

function applyBackendFieldErrors(error: ApiError): boolean {
  const fieldMap: Record<string, keyof ImportCostFormErrors> = {
    hsCode: 'hsCode',
    tariffId: 'tariff',
    simulationDate: 'simulationDate',
    currency: 'currency',
    originCountry: 'originCountry',
    invoiceValue: 'invoiceValue',
    customsValue: 'customsValue',
    freight: 'freight',
    insurance: 'insurance',
    otherCosts: 'otherCosts',
    quantity: 'quantity',
    unit: 'unit',
    reference: 'reference',
  };

  let mapped = false;
  for (const detail of error.details) {
    const path = detail.path?.split('.')[0];
    if (!path) continue;
    const field = fieldMap[path];
    if (!field) continue;
    errors.value[field] = detail.message;
    mapped = true;
  }
  return mapped;
}

async function confirmSubmit(): Promise<void> {
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  submissionError.value = null;

  try {
    const request = buildImportCostRequest(draft.value, selectedTariff.value);
    const result = await calculateImportCost(request);

    calculationStore.setResult(result.data);
    historyStore.record(result.data);
    reviewOpen.value = false;

    await router.push({
      name: 'calculation-result',
      params: { calculationId: result.data.calculationId },
    });
  } catch (error) {
    reviewOpen.value = false;
    submissionError.value = describeFailure(error);

    if (error instanceof ApiError && error.status < 500 && applyBackendFieldErrors(error)) {
      submissionError.value.message =
        'The backend rejected some values. Review the highlighted fields and try again.';
      await focusFirstError();
    }
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  if (
    selectedTariff.value &&
    hsDigits(selectedTariff.value.hsCode) === hsDigits(draft.value.hsCode)
  ) {
    lookupState.value = 'single';
    candidates.value = [selectedTariff.value];
  } else if (selectedTariff.value) {
    calculator.clearTariff();
    clearLookupState();
  }
});
</script>

<template>
  <PageContainer>
    <section class="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <div class="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-center">
        <div class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
          >
            <Calculator class="h-3.5 w-3.5" aria-hidden="true" />
            Import Cost Calculator
          </span>

          <h2 class="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Build an import-cost calculation
          </h2>
          <p class="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
            Identify the exact tariff record, value the shipment and describe the quantity. 
          </p>

          <div class="mt-5 flex flex-wrap gap-2 text-xs font-medium">
            <span class="rounded-full border border-line bg-surface-muted/60 px-3 py-1 text-ink-muted">
              1 · Tariff
            </span>
            <span class="rounded-full border border-line bg-surface-muted/60 px-3 py-1 text-ink-muted">
              2 · Valuation
            </span>
            <span class="rounded-full border border-line bg-surface-muted/60 px-3 py-1 text-ink-muted">
              3 · Review
            </span>
            <span class="rounded-full border border-line bg-surface-muted/60 px-3 py-1 text-ink-muted">
              4 · Result
            </span>
          </div>
        </div>

      </div>
    </section>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <form
        id="import-cost-form"
        data-calculator-form
        class="min-w-0 space-y-5"
        novalidate
        @submit.prevent="handleReview"
      >
        <CalculatorSection
          step="1"
          title="Product identification"
          description="Enter the HS code and select one exact tariff record. Multiple records are never selected automatically."
        >
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <FormField
              id="hs-code"
              label="HS code"
              required
              :error="errors.hsCode"
              hint="Up to 12 digits. Dots, spaces, hyphens and slashes are accepted."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.hsCode"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  spellcheck="false"
                  class="field-input font-mono"
                  placeholder="e.g. 8471.30.00"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @blur="onHsBlur"
                  @input="onHsInput"
                />
              </template>
            </FormField>

            <button
              type="button"
              class="btn-secondary sm:mb-6"
              :disabled="lookupState === 'loading'"
              @click="resolveTariff()"
            >
              <LoaderCircle
                v-if="lookupState === 'loading'"
                class="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <Search v-else class="h-4 w-4" aria-hidden="true" />
              {{ lookupState === 'loading' ? 'Finding tariff…' : 'Find tariff' }}
            </button>
          </div>

          <div
            v-if="lookupState === 'loading'"
            class="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-muted/50 px-4 py-3 text-sm text-ink-muted"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle class="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
            Looking up tariff records for this HS code…
          </div>

          <div v-else-if="lookupState === 'not_found'" class="mt-4">
            <InlineNotice tone="warning" title="No tariff record matches this HS code">
              Check the code, try a shorter recorded code, or search the Tariff Explorer. The
              calculator only submits HS codes that resolve to a recorded tariff line.
              <div class="mt-3">
                <button type="button" class="btn-secondary" @click="browseTariffs">
                  Search the Tariff Explorer
                  <ArrowUpRight class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </InlineNotice>
          </div>

          <div v-else-if="lookupState === 'error'" class="mt-4 space-y-3">
            <InlineNotice tone="warning" title="Tariff lookup could not be completed">
              {{ lookupError }}
            </InlineNotice>
            <button type="button" class="btn-secondary" @click="resolveTariff()">
              <RefreshCw class="h-4 w-4" aria-hidden="true" />
              Retry lookup
            </button>
          </div>

          <div id="tariff-selection" tabindex="-1" class="mt-4 space-y-4 focus:outline-none">
            <div
              v-if="lookupState === 'ambiguous'"
              class="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3.5"
            >
              <div class="flex items-start gap-3">
                <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-warning-ink">
                    Multiple tariff records share this HS code
                  </p>
                  <p class="mt-1 text-sm leading-6 text-ink-muted">
                    {{ candidates.length }} records were returned. Compare the schedule, original
                    rate and source page, then choose the record to use. No record is selected
                    automatically.
                  </p>
                </div>
              </div>
            </div>

            <TariffCandidatePicker
              v-if="lookupState === 'ambiguous' && candidates.length > 0"
              :candidates="candidates"
              :selected-id="selectedTariff?.id ?? null"
              @select="selectCandidate"
            />

            <p v-if="errors.tariff" class="field-error" role="alert">{{ errors.tariff }}</p>

            <SelectedTariffCard
              :tariff="selectedTariff"
              @browse="browseTariffs"
              @clear="clearTariffSelection"
            />
          </div>
        </CalculatorSection>

        <CalculatorSection
          step="2"
          title="Import information"
          description="Confirm where the goods come from and the date used to select effective rules."
        >
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="origin-country"
              label="Country of origin"
              optional
              :error="errors.originCountry"
              hint="Two-letter ISO code, for example CN."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.originCountry"
                  type="text"
                  maxlength="2"
                  autocomplete="country"
                  class="field-input font-mono uppercase"
                  placeholder="CN"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('originCountry')"
                />
              </template>
            </FormField>

            <FormField
              id="destination"
              label="Destination"
              required
              hint="The current API supports Tanzania mainland only."
            >
              <template #default="{ id, describedBy }">
                <select
                  :id="id"
                  v-model="draft.destination"
                  class="field-input"
                  :aria-describedby="describedBy"
                >
                  <option value="TZ_MAINLAND">Tanzania mainland (TZ_MAINLAND)</option>
                </select>
              </template>
            </FormField>

            <FormField
              id="simulation-date"
              label="Simulation date"
              required
              :error="errors.simulationDate"
              hint="Rules and exchange rates effective on this date are used."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.simulationDate"
                  type="date"
                  class="field-input"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('simulationDate')"
                />
              </template>
            </FormField>
          </div>
        </CalculatorSection>

        <CalculatorSection
          step="3"
          title="Shipment valuation"
          description="Provide one valuation basis. Amounts are sent to the backend; the browser does not convert or sum them."
        >
          <fieldset>
            <legend class="field-label">
              Valuation basis
              <span class="ml-0.5 text-danger" aria-hidden="true">*</span>
              <span class="sr-only">(required)</span>
            </legend>
            <p class="field-hint">Choose the basis supported by the documents you hold.</p>

            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label
                v-for="option in valuationOptions"
                :key="option.value"
                class="flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors"
                :class="
                  draft.valuationBasis === option.value
                    ? 'border-accent bg-accent-soft/40 ring-1 ring-accent/20'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted/40'
                "
              >
                <input
                  v-model="draft.valuationBasis"
                  type="radio"
                  :value="option.value"
                  class="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span class="min-w-0">
                  <span class="flex items-center gap-2 text-sm font-semibold text-ink">
                    {{ option.title }}
                    <CircleCheck
                      v-if="draft.valuationBasis === option.value"
                      class="h-3.5 w-3.5 text-accent"
                      aria-hidden="true"
                    />
                  </span>
                  <span class="mt-1 block text-xs leading-5 text-ink-muted">
                    {{ option.description }}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField
              :id="draft.valuationBasis === 'invoiceValue' ? 'invoice-value' : 'customs-value'"
              :label="
                draft.valuationBasis === 'invoiceValue'
                  ? `Invoice value (${currencyCode})`
                  : `Customs value (${currencyCode})`
              "
              required
              :error="
                draft.valuationBasis === 'invoiceValue'
                  ? errors.invoiceValue
                  : errors.customsValue
              "
              hint="Non-negative amount. Digits and a decimal point only."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  v-if="draft.valuationBasis === 'invoiceValue'"
                  :id="id"
                  v-model="draft.invoiceValue"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="field-input font-mono"
                  placeholder="0.00"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('invoiceValue')"
                />
                <input
                  v-else
                  :id="id"
                  v-model="draft.customsValue"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="field-input font-mono"
                  placeholder="0.00"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('customsValue')"
                />
              </template>
            </FormField>

            <FormField
              id="currency"
              label="Currency"
              required
              :error="errors.currency"
              hint="Used for every monetary value in this request."
            >
              <template #default="{ id, describedBy, invalid }">
                <select
                  :id="id"
                  v-model="draft.currency"
                  class="field-input"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @change="clearFieldError('currency')"
                >
                  <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
                    {{ option.label }}
                  </option>
                </select>
              </template>
            </FormField>
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="freight"
              :label="`Freight (${currencyCode})`"
              optional
              :error="errors.freight"
              hint="International freight. Blank is sent as 0."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.freight"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="field-input font-mono"
                  placeholder="0.00"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('freight')"
                />
              </template>
            </FormField>

            <FormField
              id="insurance"
              :label="`Insurance (${currencyCode})`"
              optional
              :error="errors.insurance"
              hint="Blank is sent as 0."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.insurance"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="field-input font-mono"
                  placeholder="0.00"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('insurance')"
                />
              </template>
            </FormField>

            <FormField
              id="other-costs"
              :label="`Other costs (${currencyCode})`"
              optional
              :error="errors.otherCosts"
              hint="Blank is sent as 0."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.otherCosts"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="field-input font-mono"
                  placeholder="0.00"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('otherCosts')"
                />
              </template>
            </FormField>
          </div>
        </CalculatorSection>

        <CalculatorSection
          step="4"
          title="Quantity"
          description="Optional. Provide a quantity and unit when the tariff rate or tax rule depends on it."
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField
              id="quantity"
              label="Quantity value"
              optional
              :error="errors.quantity"
              hint="Must be greater than zero when provided."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.quantity"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  class="field-input font-mono"
                  placeholder="e.g. 120"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('quantity')"
                />
              </template>
            </FormField>

            <FormField
              id="unit"
              label="Unit"
              optional
              :error="errors.unit"
              hint="Up to 30 characters, for example kg, litres or pairs."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.unit"
                  type="text"
                  maxlength="30"
                  autocomplete="off"
                  class="field-input"
                  placeholder="e.g. kg"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('unit')"
                />
              </template>
            </FormField>
          </div>

          <p
            v-if="selectedTariff?.quantity"
            class="mt-4 rounded-lg border border-line bg-surface-muted/50 px-4 py-3 text-xs leading-5 text-ink-muted"
          >
            The selected tariff records a quantity basis of
            <span class="font-mono font-semibold text-ink">{{ selectedTariff.quantity }}</span>.
            Enter the quantity in the same unit where possible.
          </p>
        </CalculatorSection>

        <CalculatorSection
          step="5"
          title="Additional information"
          description="Only fields supported by the import-cost contract are shown here."
        >
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-muted/30 p-4"
          >
            <input
              v-model="draft.preferentialTreatment"
              type="checkbox"
              class="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-[var(--accent)]"
            />
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink">Preferential treatment</span>
              <span class="mt-1 block text-xs leading-5 text-ink-muted">
                Requests preferential treatment where a verified rule exists. The backend decides
                eligibility from the origin, tariff and simulation date; this form does not.
              </span>
            </span>
          </label>

          <div class="mt-4">
            <FormField
              id="reference"
              label="Reference"
              optional
              :error="errors.reference"
              hint="Up to 120 characters. Stored with the calculation for later identification."
            >
              <template #default="{ id, describedBy, invalid }">
                <input
                  :id="id"
                  v-model="draft.reference"
                  type="text"
                  maxlength="120"
                  autocomplete="off"
                  class="field-input"
                  placeholder="e.g. PO-2026-00184"
                  :aria-describedby="describedBy"
                  :aria-invalid="invalid || undefined"
                  @input="clearFieldError('reference')"
                />
              </template>
            </FormField>
          </div>
        </CalculatorSection>

        <div
          v-if="submissionError"
          class="rounded-xl border border-danger/30 bg-danger-soft px-4 py-4"
          role="alert"
        >
          <div class="flex items-start gap-3">
            <CircleX class="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-danger-ink">Calculation request failed</p>
              <p class="mt-1 text-sm leading-6 text-ink-muted">{{ submissionError.message }}</p>
              <p
                v-if="submissionError.code || submissionError.requestId"
                class="mt-2 font-mono text-[11px] text-ink-subtle"
              >
                <template v-if="submissionError.code">Code: {{ submissionError.code }}</template>
                <template v-if="submissionError.code && submissionError.requestId"> · </template>
                <template v-if="submissionError.requestId">
                  Request: {{ submissionError.requestId }}
                </template>
              </p>
              <ul
                v-if="submissionError.details.length > 0"
                class="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-muted"
              >
                <li v-for="detail in submissionError.details" :key="detail">{{ detail }}</li>
              </ul>
              <button type="button" class="btn-secondary mt-3" @click="handleReview">
                <RefreshCw class="h-4 w-4" aria-hidden="true" />
                Review and try again
              </button>
            </div>
          </div>
        </div>

        <InlineNotice
          v-if="hasAttemptedSubmit && validationCount > 0"
          tone="warning"
          :title="`${validationCount} field${validationCount === 1 ? '' : 's'} need attention`"
        >
          Correct the highlighted fields before opening the review step. Nothing has been sent to
          the backend yet.
        </InlineNotice>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" class="btn-secondary" :disabled="isBusy" @click="resetForm">
            Clear form
          </button>
          <button type="submit" class="btn-primary" :disabled="isBusy">
            <LoaderCircle v-if="isBusy" class="h-4 w-4 animate-spin" aria-hidden="true" />
            <ShieldCheck v-else class="h-4 w-4" aria-hidden="true" />
            {{ isResolving ? 'Resolving tariff…' : 'Review calculation' }}
          </button>
        </div>
      </form>

      <aside class="space-y-4 xl:sticky xl:top-6">
        <section class="surface-card overflow-hidden">
          <header class="border-b border-line px-5 py-4">
            <h2 class="text-sm font-semibold tracking-tight text-ink">Calculation summary</h2>
            <p class="mt-1 text-xs leading-5 text-ink-muted">
              A live preview of the request values. This is not a calculated duty or tax.
            </p>
          </header>

          <div class="space-y-4 px-5 py-4">
            <div v-if="selectedTariff" class="rounded-lg border border-line bg-surface-muted/50 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-mono text-sm font-semibold text-ink">
                  {{ selectedTariff.hsCode }}
                </p>
                <ScheduleBadge :schedule="selectedTariff.scheduleType" />
              </div>
              <p class="mt-1.5 text-xs leading-5 text-ink-muted">
                {{ selectedTariff.description || 'No description recorded.' }}
              </p>
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-subtle">
                <span>Record #{{ selectedTariff.id }}</span>
                <span class="font-mono">Rate: {{ selectedTariff.rate ?? 'Not recorded' }}</span>
              </div>
            </div>
            <div
              v-else
              class="rounded-lg border border-dashed border-line-strong bg-surface-muted/40 p-3 text-xs leading-5 text-ink-muted"
            >
              No tariff record selected. The request will be blocked until an exact record is
              resolved and, where several exist, chosen explicitly.
            </div>

            <dl class="space-y-2.5 text-xs">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-subtle">HS code</dt>
                <dd class="text-right font-mono font-semibold text-ink">
                  {{ draft.hsCode.trim() || '—' }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-subtle">Valuation basis</dt>
                <dd class="text-right font-medium text-ink">
                  {{ draft.valuationBasis === 'invoiceValue' ? 'Invoice value' : 'Customs value' }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-subtle">Amount</dt>
                <dd class="text-right font-mono font-semibold text-ink">
                  {{ valuationAmount.trim() || '—' }} {{ currencyCode }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-subtle">Simulation date</dt>
                <dd class="text-right font-medium text-ink">
                  {{ draft.simulationDate || '—' }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-subtle">Quantity</dt>
                <dd class="text-right font-medium text-ink">
                  {{ draft.quantity.trim() ? `${draft.quantity} ${draft.unit}` : 'Not provided' }}
                </dd>
              </div>
            </dl>

            <p class="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-[11px] leading-5 text-warning-ink">
              No duty, levy or VAT is calculated in this browser. The backend returns the
              calculation state and any verified charges.
            </p>
          </div>
        </section>

        <section class="surface-card overflow-hidden">
          <header class="border-b border-line px-5 py-4">
            <h2 class="text-sm font-semibold tracking-tight text-ink">Before you calculate</h2>
          </header>
          <ul class="space-y-3 px-5 py-4 text-xs leading-5 text-ink-muted">
            <li class="flex gap-2">
              <Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span>The selected tariff ID must belong to the submitted HS code.</span>
            </li>
            <li class="flex gap-2">
              <Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span>Monetary values are non-negative and sent in the chosen currency.</span>
            </li>
            <li class="flex gap-2">
              <Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Unverified valuation and tax rules may return a
                <span class="font-semibold text-ink">needs-review</span> or
                <span class="font-semibold text-ink">unsupported</span> state.
              </span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <ReviewDialog
      :open="reviewOpen"
      :submitting="isSubmitting"
      :groups="reviewGroups"
      @cancel="reviewOpen = false"
      @confirm="confirmSubmit"
    />
  </PageContainer>
</template>
