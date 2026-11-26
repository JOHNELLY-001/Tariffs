import type { ImportCostRequest, TariffView } from '@/types/api';
import type { CalculatorDraft } from '@/stores/calculator';

/**
 * Client-side mirror of the import-cost request contract.
 *
 * These checks only prevent requests the backend would reject. They never
 * calculate duty, tax or customs value.
 */

export interface ImportCostFormErrors {
  hsCode?: string;
  tariff?: string;
  originCountry?: string;
  simulationDate?: string;
  currency?: string;
  invoiceValue?: string;
  customsValue?: string;
  freight?: string;
  insurance?: string;
  otherCosts?: string;
  quantity?: string;
  unit?: string;
  reference?: string;
}

export interface TariffValidationContext {
  /** True when the exact HS lookup returned several records. */
  ambiguousCandidateCount?: number;
}

const DECIMAL = /^\d+(\.\d+)?$/;
const PERMITTED_HS_CHARACTERS = /^[0-9.\s\-/]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function hsDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateMoney(value: string, label: string, required: boolean): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? `${label} is required.` : undefined;
  }
  if (!DECIMAL.test(trimmed)) {
    return `${label} must be a non-negative number using digits and a decimal point.`;
  }
  return undefined;
}

export function validateImportCostForm(
  draft: CalculatorDraft,
  selectedTariff: TariffView | null,
  context: TariffValidationContext = {},
): ImportCostFormErrors {
  const errors: ImportCostFormErrors = {};

  const code = draft.hsCode.trim();
  if (!code) {
    errors.hsCode = 'Enter an HS code.';
  } else if (code.length > 40) {
    errors.hsCode = 'An HS code must be at most 40 characters.';
  } else if (!PERMITTED_HS_CHARACTERS.test(code)) {
    errors.hsCode =
      'An HS code may contain only digits, dots, spaces, hyphens and slashes.';
  } else {
    const digits = hsDigits(code);
    if (digits.length < 2) {
      errors.hsCode = 'An HS code must contain at least 2 digits.';
    } else if (digits.length > 12) {
      errors.hsCode = 'An HS code must contain at most 12 digits.';
    }
  }

  if (!errors.hsCode) {
    if (selectedTariff) {
      if (hsDigits(selectedTariff.hsCode) !== hsDigits(code)) {
        errors.tariff =
          'The selected tariff record no longer matches this HS code. Resolve the tariff again.';
      }
    } else if ((context.ambiguousCandidateCount ?? 0) > 1) {
      errors.tariff = `This HS code has ${context.ambiguousCandidateCount} tariff records. Choose the record to use before calculating.`;
    }
  }

  if (!draft.simulationDate.trim()) {
    errors.simulationDate = 'Choose a simulation date.';
  } else if (!isValidIsoDate(draft.simulationDate.trim())) {
    errors.simulationDate = 'Enter a valid simulation date in YYYY-MM-DD format.';
  }

  if (!draft.currency.trim()) {
    errors.currency = 'Choose the currency used for the shipment values.';
  } else if (!/^[A-Za-z]{3}$/.test(draft.currency.trim())) {
    errors.currency = 'The currency must be a three-letter ISO code.';
  }

  const origin = draft.originCountry.trim();
  if (origin && !/^[A-Za-z]{2}$/.test(origin)) {
    errors.originCountry = 'Use a two-letter country code, for example CN.';
  }

  if (draft.valuationBasis === 'invoiceValue') {
    const message = validateMoney(draft.invoiceValue, 'Invoice value', true);
    if (message) errors.invoiceValue = message;
  } else {
    const message = validateMoney(draft.customsValue, 'Customs value', true);
    if (message) errors.customsValue = message;
  }

  const freight = validateMoney(draft.freight, 'Freight', false);
  if (freight) errors.freight = freight;

  const insurance = validateMoney(draft.insurance, 'Insurance', false);
  if (insurance) errors.insurance = insurance;

  const otherCosts = validateMoney(draft.otherCosts, 'Other costs', false);
  if (otherCosts) errors.otherCosts = otherCosts;

  const quantity = draft.quantity.trim();
  const unit = draft.unit.trim();

  if (!quantity && unit) {
    errors.quantity = 'Enter the quantity that this unit applies to.';
  }

  if (quantity) {
    if (!DECIMAL.test(quantity)) {
      errors.quantity = 'Quantity must be a number greater than zero.';
    } else if (Number(quantity) <= 0) {
      errors.quantity = 'Quantity must be greater than zero.';
    }

    if (!unit) {
      errors.unit = 'Enter the unit for this quantity, for example kg.';
    } else if (unit.length > 30) {
      errors.unit = 'The unit must be at most 30 characters.';
    }
  } else if (unit.length > 30) {
    errors.unit = 'The unit must be at most 30 characters.';
  }

  if (draft.reference.trim().length > 120) {
    errors.reference = 'The reference must be at most 120 characters.';
  }

  return errors;
}

export function hasFormErrors(errors: ImportCostFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function moneyOrDefault(value: string): string {
  const trimmed = value.trim();
  return trimmed === '' ? '0' : trimmed;
}

export function buildImportCostRequest(
  draft: CalculatorDraft,
  selectedTariff: TariffView | null,
): ImportCostRequest {
  const request: ImportCostRequest = {
    destination: 'TZ_MAINLAND',
    simulationDate: draft.simulationDate.trim(),
    hsCode: draft.hsCode.trim(),
    currency: draft.currency.trim().toUpperCase(),
    freight: moneyOrDefault(draft.freight),
    insurance: moneyOrDefault(draft.insurance),
    otherCosts: moneyOrDefault(draft.otherCosts),
    preferentialTreatment: draft.preferentialTreatment,
  };

  if (draft.valuationBasis === 'invoiceValue') {
    request.invoiceValue = draft.invoiceValue.trim();
  } else {
    request.customsValue = draft.customsValue.trim();
  }

  if (selectedTariff) request.tariffId = selectedTariff.id;

  const origin = draft.originCountry.trim();
  if (origin) request.originCountry = origin.toUpperCase();

  const quantity = draft.quantity.trim();
  const unit = draft.unit.trim();
  if (quantity) request.quantity = { value: quantity, unit };

  const reference = draft.reference.trim();
  if (reference) request.reference = reference;

  return request;
}
