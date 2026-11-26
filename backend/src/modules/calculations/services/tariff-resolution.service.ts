import { TARIFF_LOOKUP } from '../../../config/constants.js';
import { AppError, validationError } from '../../../shared/errors/app-error.js';
import { describeHsCodeIssue, normalizeHsCode } from '../../../shared/utils/hs-code.js';
import { analyzeRate, type RateAnalysis } from '../rate-parser.service.js';
import * as tariffRepository from '../../tariffs/tariff.repository.js';
import { toTariffView, type TariffView } from '../../tariffs/tariff.service.js';

/**
 * Tariff resolution for import-cost calculations.
 *
 * Resolves an HS code to a tariff record without silently choosing among
 * duplicates. Sensitive Items entries are resolved only when a genuine
 * MAIN_TARIFF -> SENSITIVE_ITEMS relationship exists.
 */

export interface TariffResolutionInput {
  hsCode: string;
  tariffId?: number;
}

export interface TariffResolutionResult {
  status: 'resolved' | 'ambiguous';
  normalizedCode: string;
  chapter: string | null;
  selected: TariffView | null;
  sensitiveTariff: TariffView | null;
  candidates: TariffView[];
  warnings: string[];
}

export async function resolveTariff(input: TariffResolutionInput): Promise<TariffResolutionResult> {
  const normalized = normalizeHsCode(input.hsCode);
  if (!normalized.isValid) {
    throw new AppError(
      'INVALID_HS_CODE',
      400,
      'The HS code is not a valid tariff code',
      [{ path: 'hsCode', message: describeHsCodeIssue(normalized.issue ?? 'INVALID_CHARACTERS') }],
    );
  }

  const matches = await tariffRepository.findByNormalizedHsCode(
    normalized.normalized,
    TARIFF_LOOKUP.maxMatchesPerCode,
  );

  if (matches.length === 0) {
    throw new AppError('TARIFF_NOT_FOUND', 404, `No tariff record matches HS code ${normalized.normalized}`);
  }

  const candidates = matches.map(toTariffView);

  // Direct selection by ID.
  let selected: TariffView | null = null;
  if (input.tariffId !== undefined) {
    selected = candidates.find((candidate) => candidate.id === input.tariffId) ?? null;
    if (!selected) {
      throw validationError('The supplied tariffId does not match the supplied HS code', [
        { path: 'tariffId', message: 'tariffId must identify one of the tariff records for the given HS code' },
      ]);
    }
  } else if (candidates.length === 1) {
    selected = candidates[0] ?? null;
  } else {
    return {
      status: 'ambiguous',
      normalizedCode: normalized.normalized,
      chapter: normalized.chapter,
      selected: null,
      sensitiveTariff: null,
      candidates,
      warnings: ['HS_CODE_AMBIGUOUS: multiple tariff records share this code; no record was selected automatically.'],
    };
  }

  if (!selected) {
    throw new AppError('AMBIGUOUS_TARIFF', 422, 'Tariff selection is ambiguous.');
  }

  // Resolve Sensitive Items treatment only when the selected main-schedule
  // entry actually carries an SI reference.
  let sensitiveTariff: TariffView | null = null;
  const rateAnalysis: RateAnalysis = selected.rateAnalysis ?? analyzeRate(selected.rate);

  if (rateAnalysis.isSensitiveItem && selected.scheduleType?.toUpperCase() !== 'SENSITIVE_ITEMS') {
    const siMatches = await tariffRepository.findByNormalizedHsCodeAndSchedule(
      normalized.normalized,
      'SENSITIVE_ITEMS',
      TARIFF_LOOKUP.maxMatchesPerCode,
    );
    const siCandidates = siMatches.map(toTariffView);

    if (siCandidates.length === 0) {
      throw new AppError(
        'UNRESOLVED_SENSITIVE_ITEM',
        422,
        'The source rate refers to Sensitive Items treatment, but no corresponding SENSITIVE_ITEMS entry exists.',
      );
    }

    if (siCandidates.length > 1) {
      return {
        status: 'ambiguous',
        normalizedCode: normalized.normalized,
        chapter: normalized.chapter,
        selected,
        sensitiveTariff: null,
        candidates: siCandidates,
        warnings: [
          'SENSITIVE_ITEMS_AMBIGUOUS: multiple Sensitive Items entries share this HS code; selection is required.',
        ],
      };
    }

    sensitiveTariff = siCandidates[0] ?? null;
  }

  const warnings = new Set<string>(selected.rateAnalysis.warnings);
  if (sensitiveTariff) {
    for (const warning of sensitiveTariff.rateAnalysis.warnings) warnings.add(warning);
  }

  return {
    status: 'resolved',
    normalizedCode: normalized.normalized,
    chapter: normalized.chapter,
    selected,
    sensitiveTariff,
    candidates,
    warnings: [...warnings],
  };
}
