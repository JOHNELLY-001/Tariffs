/**
 * Versioned tax-rule management infrastructure.
 *
 * Rules are stored in an in-memory registry for M3. Production persistence will
 * use the proposed `import_tax_rules` table once migrations are approved.
 * Only rules with verificationStatus === 'VERIFIED' may be selected for
 * production calculation execution.
 */

export type VerificationStatus = 'VERIFIED' | 'SECONDARY' | 'UNVERIFIED';
export type TaxType = 'duty' | 'excise' | 'vat' | 'levy' | 'other';
export type RateType = 'ad_valorem' | 'specific' | 'compound' | 'free' | 'sensitive_item';
export type CalculationBase =
  | 'customs_value'
  | 'cif'
  | 'dutiable_value'
  | 'vat_base'
  | 'quantity';

export interface TaxRule {
  id: string;
  ruleCode: string;
  ruleScope: string;
  jurisdiction: string;
  taxName: string;
  taxType: TaxType;
  rateType: RateType;
  rateValue: string | null;
  rateExpression: string | null;
  calculationBase: CalculationBase;
  calculationOrder: number;
  applicabilityConditions: Record<string, unknown> | null;
  exemptionConditions: Record<string, unknown> | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceProvision: string;
  verificationStatus: VerificationStatus;
  dependencies: string[];
  supersedesRuleId: string | null;
  createdAt: string;
}

const SUPPORTED_BASES: CalculationBase[] = [
  'customs_value',
  'cif',
  'dutiable_value',
  'vat_base',
  'quantity',
];

const ALLOWED_VERIFICATION_STATUSES: VerificationStatus[] = ['VERIFIED', 'SECONDARY', 'UNVERIFIED'];

const rules = new Map<string, TaxRule>();

function parseDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const parts = value.split('-').map((part) => Number(part));
  const year = parts[0] as number;
  const month = parts[1] as number;
  const day = parts[2] as number;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date.getTime();
}

function periodsOverlap(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null): boolean {
  const aStart = parseDate(aFrom);
  const aEnd = aTo ? parseDate(aTo) : Number.POSITIVE_INFINITY;
  const bStart = parseDate(bFrom);
  const bEnd = bTo ? parseDate(bTo) : Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
}

export function resetTaxRuleRegistry(): void {
  rules.clear();
}

export function registerTaxRule(rule: TaxRule): void {
  if (!rule.id || !rule.ruleCode || !rule.ruleScope || !rule.jurisdiction) {
    throw new Error('A tax rule requires id, ruleCode, ruleScope and jurisdiction');
  }
  if (!rule.sourceTitle || !rule.sourceProvision || !rule.effectiveFrom) {
    throw new Error('A tax rule requires a legal source and an effective date');
  }
  if (!ALLOWED_VERIFICATION_STATUSES.includes(rule.verificationStatus)) {
    throw new Error(`Invalid verification status: ${rule.verificationStatus}`);
  }
  if (!SUPPORTED_BASES.includes(rule.calculationBase)) {
    throw new Error(`Unsupported calculation base: ${rule.calculationBase}`);
  }
  if (rule.effectiveTo && parseDate(rule.effectiveTo) < parseDate(rule.effectiveFrom)) {
    throw new Error('effectiveTo must be on or after effectiveFrom');
  }
  if (rules.has(rule.id)) {
    throw new Error(`Rule ${rule.id} is already registered`);
  }

  // Non-overlapping effective periods within the same scope and jurisdiction.
  for (const existing of rules.values()) {
    if (existing.ruleScope === rule.ruleScope && existing.jurisdiction === rule.jurisdiction) {
      if (periodsOverlap(existing.effectiveFrom, existing.effectiveTo, rule.effectiveFrom, rule.effectiveTo)) {
        throw new Error(
          `Overlapping effective period for rule scope ${rule.ruleScope} in ${rule.jurisdiction}`,
        );
      }
    }
  }

  rules.set(rule.id, { ...rule });
}

export function listTaxRules(filter?: {
  jurisdiction?: string;
  verificationStatus?: VerificationStatus;
  ruleScope?: string;
}): TaxRule[] {
  return [...rules.values()].filter((rule) => {
    if (filter?.jurisdiction && rule.jurisdiction !== filter.jurisdiction) return false;
    if (filter?.verificationStatus && rule.verificationStatus !== filter.verificationStatus) return false;
    if (filter?.ruleScope && rule.ruleScope !== filter.ruleScope) return false;
    return true;
  });
}

export function getTaxRule(id: string): TaxRule | null {
  return rules.get(id) ?? null;
}

export interface SelectTaxRuleInput {
  ruleScope: string;
  jurisdiction: string;
  simulationDate: string;
  allowUnverified?: boolean;
}

export function selectTaxRule(input: SelectTaxRuleInput): TaxRule | null {
  const simulationTime = parseDate(input.simulationDate);
  const candidates = [...rules.values()].filter((rule) => {
    if (rule.ruleScope !== input.ruleScope) return false;
    if (rule.jurisdiction !== input.jurisdiction) return false;
    if (!input.allowUnverified && rule.verificationStatus !== 'VERIFIED') return false;
    const from = parseDate(rule.effectiveFrom);
    const to = rule.effectiveTo ? parseDate(rule.effectiveTo) : Number.POSITIVE_INFINITY;
    return from <= simulationTime && simulationTime <= to;
  });

  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    throw new Error(`Multiple applicable tax rules for scope ${input.ruleScope}`);
  }
  return candidates[0] ?? null;
}

export function selectVerifiedTaxRule(
  ruleScope: string,
  jurisdiction: string,
  simulationDate: string,
): TaxRule | null {
  return selectTaxRule({ ruleScope, jurisdiction, simulationDate, allowUnverified: false });
}

export function listEffectiveTaxRules(jurisdiction: string, simulationDate: string): TaxRule[] {
  const simulationTime = parseDate(simulationDate);
  return listTaxRules({ jurisdiction, verificationStatus: 'VERIFIED' }).filter((rule) => {
    const from = parseDate(rule.effectiveFrom);
    const to = rule.effectiveTo ? parseDate(rule.effectiveTo) : Number.POSITIVE_INFINITY;
    return from <= simulationTime && simulationTime <= to;
  });
}

export function validateDependencies(allRules: TaxRule[] = [...rules.values()]): void {
  const byId = new Map(allRules.map((rule) => [rule.id, rule]));

  // Circular dependency detection (DFS) first.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular dependency detected at ${id}`);
    visiting.add(id);
    const rule = byId.get(id);
    if (rule) {
      for (const dep of rule.dependencies) visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const rule of allRules) visit(rule.id);

  for (const rule of allRules) {
    for (const dependency of rule.dependencies) {
      const dep = byId.get(dependency);
      if (!dep) {
        throw new Error(`Missing dependency ${dependency} for rule ${rule.id}`);
      }
      if (dep.calculationOrder >= rule.calculationOrder) {
        throw new Error(`Invalid calculation order: ${rule.id} must run after ${dependency}`);
      }
    }
  }
}
