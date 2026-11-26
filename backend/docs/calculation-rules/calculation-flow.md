# Calculation Flow — Tanzania Mainland Import Cost

## Scope

Tanzania Mainland, normal commercial imports for home consumption. No other
regime is supported.

## Sequence

1. Validate request (Zod): HS code format, currency, monetary values, country
   code, simulation date, quantity/unit conditionally.
2. Resolve tariff from `cet_tariffs` by normalized HS code (preserve leading
   zeros). Return all matches; never auto-select among duplicates.
   - Detect schedule (`MAIN_TARIFF`, `SENSITIVE_ITEMS`).
   - Detect `SI`; resolve against `SENSITIVE_ITEMS` schedule or reject.
3. Parse the original rate text (percentage / specific / compound / sensitive
   item / free / unknown). Preserve raw text.
4. Determine customs value per verified valuation rules and currency conversion.
5. Calculate customs duty (order 1).
6. Calculate excise duty if applicable (order 2), using its own base.
7. Calculate levies (RDL, IDL where applicable) (order 3).
8. Calculate VAT (order 4) on its verified base (likely cumulative of customs
   value + duty + excise + levies — to be confirmed).
9. Sum charges → `totalImportCharges`.
10. `estimatedLandedCost = customsValue + totalImportCharges`.
11. Persist calculation audit record.
12. Return detailed, traceable response with warnings and assumptions.

## Dependency rules

- VAT must not be computed as `customsValue * (duty% + vat% + levy%)`.
- Each charge's base is defined independently.
- Circular calculations are forbidden.
- If any required rule is unverified, the affected charge returns `unsupported`
  and the overall state is `unsupported` or `needs_review`; no fabricated totals.

## Error codes

- `INVALID_HS_CODE`
- `TARIFF_NOT_FOUND`
- `AMBIGUOUS_TARIFF`
- `UNRESOLVED_SENSITIVE_ITEM`
- `UNSUPPORTED_RATE_TYPE`
- `MISSING_REQUIRED_QUANTITY`
- `INVALID_QUANTITY_UNIT`
- `EXCHANGE_RATE_UNAVAILABLE`
- `TAX_RULE_NOT_VERIFIED`
- `NO_EFFECTIVE_TAX_RULE`
- `ORIGIN_REQUIREMENTS_NOT_MET`
- `CUSTOMS_VALUATION_INCOMPLETE`
- `CALCULATION_REQUIRES_REVIEW`

## Reproducibility

Every completed calculation must record inputs, selected tariff id, original and
resolved rate, schedule, customs value, exchange rate and source, applied rule
ids, bases, charge amounts, totals, simulation date, rule version, warnings and
timestamp, so the result can be reproduced after rule updates.
