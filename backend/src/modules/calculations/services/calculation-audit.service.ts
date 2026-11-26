import { logger } from '../../../config/logger.js';
import { query, withTransaction } from '../../../config/database.js';
import { env } from '../../../config/env.js';
import type { ImportCostResult } from '../calculation.service.js';

export async function persistCalculation(result: ImportCostResult): Promise<boolean> {
  if (!env.isDatabaseConfigured) return false;

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO import_calculations (
          id, destination, simulation_date, reference, hs_code_input, hs_code_normalized,
          tariff_id, sensitive_tariff_id, origin_country, currency, invoice_value, freight,
          insurance, other_costs, other_costs_included, quantity_value, quantity_unit,
          preferential_treatment, exchange_rate, exchange_rate_source, exchange_rate_effective_date,
          customs_value, customs_currency, total_import_charges, estimated_landed_cost, state,
          rule_version, tariff_snapshot, tax_rule_versions, warnings, assumptions
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
        )`,
        [
          result.calculationId,
          result.destination,
          result.simulationDate,
          result.reference ?? null,
          result.inputs.hsCode,
          result.inputs.hsCode.replace(/\D/g, ''),
          result.tariff?.id ?? null,
          result.tariff?.sensitiveTariffId ?? null,
          result.inputs.originCountry ?? null,
          result.inputs.currency,
          Number(result.inputs.invoiceValue ?? result.inputs.customsValue ?? 0),
          Number(result.inputs.freight ?? 0),
          Number(result.inputs.insurance ?? 0),
          Number(result.inputs.otherCosts ?? 0),
          Number(result.valuation.components.find((c) => c.code === 'OTHER_COSTS' && c.included)?.amount ?? 0),
          result.inputs.quantity && typeof result.inputs.quantity === 'object' ? Number(result.inputs.quantity.value) : (typeof result.inputs.quantity === 'number' ? result.inputs.quantity : null),
          result.inputs.quantity && typeof result.inputs.quantity === 'object' ? result.inputs.quantity.unit : (result.inputs.unit ?? null),
          result.inputs.preferentialTreatment ?? false,
          result.valuation.exchangeRate ? Number(result.valuation.exchangeRate) : null,
          result.valuation.exchangeRateSource,
          result.valuation.exchangeRateEffectiveDate,
          result.valuation.customsValue ? Number(result.valuation.customsValue) : null,
          'TZS',
          result.totals ? Number(result.totals.totalImportCharges) : null,
          result.totals ? Number(result.totals.estimatedLandedCost) : null,
          result.state,
          result.ruleVersion,
          JSON.stringify({
            tariff: result.tariff,
            candidates: result.candidates,
          }),
          JSON.stringify(result.charges.map((charge) => ({
            ruleId: charge.ruleId,
            ruleVersion: charge.ruleVersion,
            code: charge.code,
          }))),
          JSON.stringify(result.warnings),
          JSON.stringify(result.assumptions),
        ],
      );

      for (const charge of result.charges) {
        await client.query(
          `INSERT INTO import_calculation_charges (
            calculation_id, code, name, tax_type, rate_type, rate, taxable_base, formula, amount,
            currency, source, rule_id, rule_version, calculation_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            result.calculationId,
            charge.code,
            charge.name,
            charge.taxType,
            charge.rateType,
            charge.rate,
            Number(charge.taxableBase),
            charge.formula,
            Number(charge.amount),
            charge.currency,
            charge.source,
            charge.ruleId,
            charge.ruleVersion,
            charge.calculationOrder,
          ],
        );
      }
    });
    return true;
  } catch (error) {
    logger.warn({ err: error, calculationId: result.calculationId }, 'calculation audit persistence failed');
    return false;
  }
}

export interface StoredCalculationCharge {
  id: number;
  calculationId: string;
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
  ruleId: string | null;
  ruleVersion: string | null;
  calculationOrder: number;
  createdAt: string;
}

export interface StoredCalculation {
  calculationId: string;
  destination: string;
  simulationDate: string;
  reference: string | null;
  hsCodeInput: string;
  hsCodeNormalized: string;
  tariffId: number | null;
  sensitiveTariffId: number | null;
  originCountry: string | null;
  currency: string;
  invoiceValue: string;
  freight: string;
  insurance: string;
  otherCosts: string;
  otherCostsIncluded: string;
  quantityValue: string | null;
  quantityUnit: string | null;
  preferentialTreatment: boolean;
  exchangeRate: string | null;
  exchangeRateSource: string | null;
  exchangeRateEffectiveDate: string | null;
  customsValue: string | null;
  customsCurrency: string;
  totalImportCharges: string | null;
  estimatedLandedCost: string | null;
  state: string;
  ruleVersion: string;
  tariffSnapshot: unknown;
  taxRuleVersions: unknown;
  warnings: string[];
  assumptions: string[];
  createdAt: string;
  charges: StoredCalculationCharge[];
}

export async function getCalculation(calculationId: string): Promise<StoredCalculation | null> {
  if (!env.isDatabaseConfigured) return null;
  try {
    const calcResult = await query<{
      id: string;
      destination: string;
      simulation_date: string | Date;
      reference: string | null;
      hs_code_input: string;
      hs_code_normalized: string;
      tariff_id: string | number | null;
      sensitive_tariff_id: string | number | null;
      origin_country: string | null;
      currency: string;
      invoice_value: string | number;
      freight: string | number;
      insurance: string | number;
      other_costs: string | number;
      other_costs_included: string | number;
      quantity_value: string | number | null;
      quantity_unit: string | null;
      preferential_treatment: boolean;
      exchange_rate: string | number | null;
      exchange_rate_source: string | null;
      exchange_rate_effective_date: string | Date | null;
      customs_value: string | number | null;
      customs_currency: string;
      total_import_charges: string | number | null;
      estimated_landed_cost: string | number | null;
      state: string;
      rule_version: string;
      tariff_snapshot: unknown;
      tax_rule_versions: unknown;
      warnings: unknown;
      assumptions: unknown;
      created_at: string | Date;
    }>('SELECT * FROM import_calculations WHERE id = $1', [calculationId]);
    const row = calcResult.rows[0];
    if (!row) return null;

    const chargeResult = await query<{
      id: string | number;
      calculation_id: string;
      code: string;
      name: string;
      tax_type: string;
      rate_type: string;
      rate: string;
      taxable_base: string | number;
      formula: string;
      amount: string | number;
      currency: string;
      source: string;
      rule_id: string | null;
      rule_version: string | null;
      calculation_order: number;
      created_at: string | Date;
    }>('SELECT * FROM import_calculation_charges WHERE calculation_id = $1 ORDER BY calculation_order, id', [calculationId]);

    const toDate = (value: string | Date | null) =>
      value ? (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)) : null;

    return {
      calculationId: row.id,
      destination: row.destination,
      simulationDate: toDate(row.simulation_date)!,
      reference: row.reference,
      hsCodeInput: row.hs_code_input,
      hsCodeNormalized: row.hs_code_normalized,
      tariffId: row.tariff_id !== null ? Number(row.tariff_id) : null,
      sensitiveTariffId: row.sensitive_tariff_id !== null ? Number(row.sensitive_tariff_id) : null,
      originCountry: row.origin_country,
      currency: row.currency,
      invoiceValue: String(row.invoice_value),
      freight: String(row.freight),
      insurance: String(row.insurance),
      otherCosts: String(row.other_costs),
      otherCostsIncluded: String(row.other_costs_included),
      quantityValue: row.quantity_value !== null ? String(row.quantity_value) : null,
      quantityUnit: row.quantity_unit,
      preferentialTreatment: row.preferential_treatment,
      exchangeRate: row.exchange_rate !== null ? String(row.exchange_rate) : null,
      exchangeRateSource: row.exchange_rate_source,
      exchangeRateEffectiveDate: toDate(row.exchange_rate_effective_date),
      customsValue: row.customs_value !== null ? String(row.customs_value) : null,
      customsCurrency: row.customs_currency,
      totalImportCharges: row.total_import_charges !== null ? String(row.total_import_charges) : null,
      estimatedLandedCost: row.estimated_landed_cost !== null ? String(row.estimated_landed_cost) : null,
      state: row.state,
      ruleVersion: row.rule_version,
      tariffSnapshot: row.tariff_snapshot,
      taxRuleVersions: row.tax_rule_versions,
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
      assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      charges: chargeResult.rows.map((charge) => ({
        id: Number(charge.id),
        calculationId: charge.calculation_id,
        code: charge.code,
        name: charge.name,
        taxType: charge.tax_type,
        rateType: charge.rate_type,
        rate: charge.rate,
        taxableBase: String(charge.taxable_base),
        formula: charge.formula,
        amount: String(charge.amount),
        currency: charge.currency,
        source: charge.source,
        ruleId: charge.rule_id,
        ruleVersion: charge.rule_version,
        calculationOrder: charge.calculation_order,
        createdAt: charge.created_at instanceof Date ? charge.created_at.toISOString() : String(charge.created_at),
      })),
    };
  } catch (error) {
    logger.warn({ err: error, calculationId }, 'calculation retrieval failed');
    return null;
  }
}
