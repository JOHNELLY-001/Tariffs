/**
 * API contract types mirrored from the verified backend responses.
 *
 * The frontend must never derive duties, taxes or totals itself. These types
 * describe what the API returns so screens can present it faithfully.
 */

export interface ApiErrorDetail {
  path?: string;
  message: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: Record<string, unknown> & { requestId?: string };
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
  meta: Record<string, unknown> & { requestId?: string };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type RateKind =
  | 'percentage'
  | 'specific'
  | 'compound'
  | 'sensitive_item'
  | 'free'
  | 'unknown';

export interface RateComponent {
  kind: RateKind;
  value: string | null;
  currency: string | null;
  unit: string | null;
  text: string;
}

export interface RateAnalysis {
  raw: string | null;
  kind: RateKind;
  isSensitiveItem: boolean;
  components: RateComponent[];
  warnings: string[];
  classifiedFromSource: boolean;
}

export interface TariffRecord {
  id: number;
  hsCode: string;
  description: string | null;
  quantity: string | null;
  rate: string | null;
  heading: string | null;
  sourcePage: number | null;
  extractionPhase: number | null;
  scheduleType: string | null;
  createdAt: string | null;
  chapterCode: string | null;
}

export interface TariffView extends TariffRecord {
  rateAnalysis: RateAnalysis;
}

export type MatchType = 'exact_code' | 'code_prefix' | 'description';

export interface SearchItem extends TariffView {
  matchType: MatchType;
  relevance: number;
}

export interface SearchQueryMeta {
  text: string;
  normalizedCode: string;
  chapterCode: string | null;
  scheduleType: string | null;
}

export interface SearchResult {
  items: SearchItem[];
  pagination: PaginationMeta | null;
  query: SearchQueryMeta | null;
  warnings: string[];
}

export interface HsCodeNormalization {
  input: string;
  normalized: string;
  chapter: string | null;
}

/**
 * Exact HS-code lookup. The backend returns every record sharing the code and
 * never selects one; `ambiguous` is metadata, not an instruction to choose.
 */
export interface TariffLookupData {
  matches: TariffView[];
  ambiguous: boolean;
  schedules: Array<string | null>;
  normalization: HsCodeNormalization | null;
  notes: string[];
  disclaimer: string | null;
}

export interface SubheadingNoteRecord {
  id: number;
  chapterCode: string | null;
  sectionCode: string | null;
  noteNumber: string | null;
  subheadingReference: string | null;
  noteText: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  ownership: 'chapter' | 'section' | 'unassigned';
}

export interface SensitiveItemsReference {
  reason: string;
  matches: TariffView[];
}

/** Classification context returned by `/tariffs/:id/notes`. */
export interface ClassificationContext {
  tariff: TariffView;
  chapter: ChapterRecord | null;
  section: SectionRecord | null;
  subheadingNotes: SubheadingNoteRecord[];
  sensitiveItemsReference: SensitiveItemsReference | null;
  contextComplete: boolean;
  chapterSource: 'verified_column' | 'derived_from_hs_code' | 'none';
  warnings: string[];
  disclaimer: string;
}

export interface SearchMeta {
  pagination: PaginationMeta;
  query: SearchQueryMeta;
  warnings: string[];
}

export interface SectionRecord {
  id: number;
  sectionCode: string;
  sectionTitle: string | null;
  sectionNotes: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  createdAt: string | null;
}

export interface ChapterRecord {
  id: number;
  chapterCode: string;
  chapterTitle: string | null;
  chapterNotes: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  createdAt: string | null;
  sectionCode: string | null;
}

export interface SectionDetail {
  section: SectionRecord;
  chapters: ChapterRecord[] | null;
  chapterCount: number | null;
  contextComplete: boolean;
  warnings: string[];
}

export interface ChapterDetail {
  chapter: ChapterRecord;
  section: SectionRecord | null;
  tariffCount: number;
  contextComplete: boolean;
  warnings: string[];
}

export type CalculationState =
  | 'calculated'
  | 'completed'
  | 'partially_calculated'
  | 'unsupported'
  | 'needs_review'
  | 'failed';

export interface ImportCostRequest {
  destination?: 'TZ_MAINLAND';
  simulationDate?: string;
  reference?: string;
  hsCode: string;
  tariffId?: number;
  originCountry?: string;
  currency: string;
  invoiceValue?: string | number;
  customsValue?: string | number;
  freight?: string | number;
  insurance?: string | number;
  otherCosts?: string | number;
  quantity?: number | { value: string | number; unit: string };
  unit?: string;
  preferentialTreatment?: boolean;
  assumptions?: string[];
}

export interface ValuationComponent {
  code: string;
  description: string;
  amount: string | null;
  currency: string;
  included: boolean;
  reason: string;
}

export interface ValuationResult {
  state: 'calculated' | 'needs_review' | 'unsupported';
  customsValue: string | null;
  currency: string;
  components: ValuationComponent[];
  exchangeRate: string | null;
  exchangeRateSource: string | null;
  exchangeRateEffectiveDate: string | null;
  ruleId: string | null;
  reason: string | null;
  warnings: string[];
}

export interface TaxCharge {
  code: string;
  name: string;
  taxType: string;
  rateType: string;
  rate: string;
  taxableBase: string;
  formula: string;
  amount: string;
  currency: string;
  source: string;
  ruleId: string;
  ruleVersion: string;
  calculationOrder: number;
}

export interface DutyLine {
  ruleId: string;
  description: string;
  amount: number;
  currency: string;
  legalSource: string;
  effectiveFrom: string;
}

export type AssessmentState = 'calculated' | 'needs_review' | 'unsupported';

/** Duty assessment summary returned by the backend. */
export interface DutyResult {
  state: AssessmentState;
  lines: DutyLine[];
  appliedRuleIds: string[];
  reason: string | null;
  warnings: string[];
}

export interface TaxLine {
  ruleId: string;
  description: string;
  amount: string;
  currency: string;
  legalSource: string;
  effectiveFrom: string;
}

/** Tax and levy assessment summary returned by the backend. */
export interface TaxResult {
  state: AssessmentState;
  lines: TaxLine[];
  appliedRuleIds: string[];
  reason: string | null;
  warnings: string[];
  totalCharges: string | null;
}

export interface ImportCostTotals {
  customsDuty: string;
  exciseDuty: string;
  vat: string;
  levies: string;
  otherCharges: string;
  totalImportCharges: string;
  customsValue: string;
  estimatedLandedCost: string;
}

export interface ImportCostResult {
  calculationId: string;
  status: CalculationState;
  state: CalculationState;
  destination: string;
  simulationDate: string;
  reference?: string;
  inputs: ImportCostRequest;
  tariff: {
    id: number;
    hsCode: string;
    description: string | null;
    rate: string | null;
    rateAnalysis: RateAnalysis;
    sourcePage: number | null;
    extractionPhase: number | null;
    scheduleType: string | null;
    originalRate: string | null;
    resolvedRate: string | null;
    sensitiveTariffId: number | null;
  } | null;
  candidates: Array<{
    id: number;
    hsCode: string;
    rate: string | null;
    extractionPhase: number | null;
    scheduleType: string | null;
  }>;
  valuation: ValuationResult;
  exchangeRate: {
    rate: string | null;
    source: string | null;
    effectiveDate: string | null;
  };
  charges: TaxCharge[];
  duty: DutyResult;
  tax: TaxResult;
  items: Array<Record<string, never>>;
  totals: ImportCostTotals | null;
  assumptions: string[];
  ruleIds: string[];
  warnings: string[];
  disclaimer: string;
  ruleVersion: string;
  generatedAt: string;
}
