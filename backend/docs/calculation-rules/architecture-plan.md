# Architecture Plan — Tanzania Mainland Import Cost Calculator (Phase 3)

Planning only. No source code, API behaviour, database records or migrations are
changed by this document.

## 1. Overall architecture

Modular monolith, preserving the existing Express 5 / TypeScript / PostgreSQL /
Zod / Pino stack and the `/api/v1` prefix. Calculation logic stays outside
controllers. New modules live under `backend/src/modules/calculations/` and are
added alongside (not replacing) existing tariff/search/notes modules.

High-level flow:

```
HTTP request
  -> validate-request (Zod)
  -> calculation.controller (thin)
  -> calculation.service (orchestration)
      -> tariff-resolution.service
      -> rate-parser.service (existing)
      -> customs-valuation.service
      -> exchange-rate.service
      -> tax-rule.service
      -> tax-calculation.service
      -> calculation-audit.service
  -> response envelope
```

All money uses decimal-safe arithmetic. All rates/bases come from the rule
store or the tariff source; nothing is accepted from the client.

## 2. Component responsibilities

- `calculation.routes.ts` — route registration only.
- `calculation.controller.ts` — HTTP in/out, no business logic.
- `calculation.schemas.ts` — Zod request validation (new contract).
- `calculation.service.ts` — orchestration, state aggregation, warnings.
- `tariff-resolution.service.ts` — HS normalize/validate, retrieve matches,
  schedule detection, SI resolution, ambiguity detection.
- `rate-parser.service.ts` (existing) — classify raw rate text.
- `customs-valuation.service.ts` — valuation components, currency conversion.
- `exchange-rate.service.ts` — lookup verified rate by date/currency.
- `tax-rule.service.ts` — select effective, verified rules by charge/date.
- `tax-calculation.service.ts` — per-charge components in legal order.
- `calculation-audit.service.ts` — persist reproducible calculation snapshot.
- `decimal.utils.ts`, `rounding.utils.ts` — exact money helpers.

## 3. Tariff resolution workflow

```
input hsCode (string)
  -> normalizeHsCode (digits only, leading zeros preserved)
  -> validate length 2..12
  -> findByNormalizedHsCode(normalized)  // all matches, ORDER BY id
  -> if none: TARIFF_NOT_FOUND
  -> group by scheduleType
  -> if client supplies tariffId:
        verify tariffId is among matches; else validation error
     else if matches.length == 1: select it
     else if matches.length > 1: AMBIGUOUS_TARIFF (return candidates; no auto-select)
  -> if selected.rate is SI:
        siMatches = findByNormalizedHsCodeAndSchedule(code, 'SENSITIVE_ITEMS')
        if none: UNRESOLVED_SENSITIVE_ITEM
        if multiple: require selection / return candidates
        record both main and SI tariff ids + raw rates
  -> return selected tariff + schedule + raw rate + rateAnalysis + candidates
```

Pseudocode (resolution):

```
function resolveTariff(hsCode, tariffId?) {
  const n = normalizeHsCode(hsCode);
  if (!n.isValid) throw INVALID_HS_CODE;
  const matches = repo.findByNormalizedHsCode(n.normalized);
  if (!matches.length) throw TARIFF_NOT_FOUND;
  let selected;
  if (tariffId) {
    selected = matches.find(m => m.id === tariffId);
    if (!selected) throw validationError('tariffId does not match hsCode');
  } else if (matches.length === 1) {
    selected = matches[0];
  } else {
    return { status: 'ambiguous', candidates: matches };
  }
  let sensitiveEntry = null;
  if (analyzeRate(selected.rate).isSensitiveItem) {
    const si = repo.findByNormalizedHsCodeAndSchedule(n.normalized, 'SENSITIVE_ITEMS');
    if (!si.length) throw UNRESOLVED_SENSITIVE_ITEM;
    if (si.length > 1) return { status: 'ambiguous', candidates: si, sensitive: true };
    sensitiveEntry = si[0];
  }
  return { status: 'resolved', selected, sensitiveEntry, candidates: matches };
}
```

## 4. Customs valuation workflow

Inputs: invoiceValue (FOB), currency, freight, insurance, otherCosts, originCountry,
simulationDate. Mandatory: invoiceValue, currency, hsCode/tariff. Conditional:
freight, insurance, otherCosts, quantity, preferential evidence.

```
1. Validate monetary decimals (non-negative where appropriate).
2. Convert invoiceValue (and each includable component) using exchange rate
   for (currency, simulationDate). Reject if unavailable.
3. Apply verified includability rules:
   - freight, insurance: includable per verified method (SECONDARY: CIF basis).
   - otherCosts: includable only if a verified rule says so; otherwise excluded
     and reported in warnings.
4. customsValue = converted invoice + includable adjustments.
5. Round per verified rounding rule.
6. Record exchangeRate, source, effectiveDate, components, adjustments.
```

No hard-coded exchange rates; `exchange-rate.service` queries the proposed
`customs_exchange_rates` table (or a verified provider) and returns null when no
effective rate exists.

## 5. Tax calculation workflow

Legal order (to be confirmed by primary sources):

1. Customs duty (base = customsValue).
2. Excise duty (base = verified dutiable value; default candidate = customsValue).
3. Levies (RDL/IDL) (base = verified; candidate = CIF/customs value).
4. VAT (base = verified cumulative base).

Each charge is a separate component with: code, name, rateType, rate, taxableBase,
formula, amount, currency, source, ruleId, effectiveFrom.

Dependencies are explicit: VAT base references the amounts of prior charges by
rule, not by a generic percentage sum. Circular references are rejected at rule
load time.

Unverified rules are filtered out by `tax-rule.service` (verification_status =
'VERIFIED' only). If no verified rule applies, the charge returns
`unsupported` with a reason.

## 6. Database design (proposals only — not applied)

### `import_tax_rules`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| rule_code | TEXT UNIQUE NOT NULL | e.g. TZ_RDL_2PCT |
| tax_name | TEXT NOT NULL | |
| tax_type | TEXT NOT NULL | duty/excise/vat/levy |
| rate_type | TEXT NOT NULL | ad_valorem/specific/compound/free |
| rate_value | NUMERIC(18,6) NULL | |
| rate_expression | TEXT NULL | original legal expression |
| calculation_base | TEXT NOT NULL | customs_value/cif/dutiable_value/vat_base |
| calculation_order | INT NOT NULL | |
| applicability_conditions | JSONB NULL | |
| exemption_conditions | JSONB NULL | |
| effective_from | DATE NOT NULL | |
| effective_to | DATE NULL | |
| source_title | TEXT NOT NULL | |
| source_url | TEXT NULL | |
| source_provision | TEXT NOT NULL | |
| verification_status | TEXT NOT NULL | VERIFIED/SECONDARY/UNVERIFIED |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes: `(tax_type, effective_from)`, `(rule_code)`, `(verification_status)`.

### `customs_exchange_rates`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| currency_code | CHAR(3) NOT NULL | |
| base_currency | CHAR(3) NOT NULL DEFAULT 'TZS' | |
| exchange_rate | NUMERIC(18,6) NOT NULL | |
| effective_from | DATE NOT NULL | |
| effective_to | DATE NULL | |
| source | TEXT NOT NULL | |
| verification_status | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Unique: `(currency_code, base_currency, effective_from)`. Index on `(currency_code, effective_from)`.

### `import_calculations`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK (gen_random_uuid) | calculation ID |
| request_id | TEXT NULL | correlation |
| destination | TEXT NOT NULL | |
| simulation_date | DATE NOT NULL | |
| reference | TEXT NULL | |
| hs_code_input | TEXT NOT NULL | |
| hs_code_normalized | TEXT NOT NULL | |
| tariff_id | BIGINT NULL FK -> cet_tariffs(id) | |
| sensitive_tariff_id | BIGINT NULL FK -> cet_tariffs(id) | |
| origin_country | CHAR(2) NULL | |
| currency | CHAR(3) NOT NULL | |
| invoice_value | NUMERIC(18,2) NOT NULL | |
| freight | NUMERIC(18,2) NOT NULL DEFAULT 0 | |
| insurance | NUMERIC(18,2) NOT NULL DEFAULT 0 | |
| other_costs | NUMERIC(18,2) NOT NULL DEFAULT 0 | |
| other_costs_included | NUMERIC(18,2) NOT NULL DEFAULT 0 | |
| quantity_value | NUMERIC(18,6) NULL | |
| quantity_unit | TEXT NULL | |
| preferential_treatment | BOOLEAN NOT NULL DEFAULT false | |
| exchange_rate | NUMERIC(18,6) NULL | |
| exchange_rate_source | TEXT NULL | |
| exchange_rate_effective_date | DATE NULL | |
| customs_value | NUMERIC(18,2) NULL | |
| customs_currency | CHAR(3) NOT NULL DEFAULT 'TZS' | |
| total_import_charges | NUMERIC(18,2) NULL | |
| estimated_landed_cost | NUMERIC(18,2) NULL | |
| state | TEXT NOT NULL | |
| rule_version | TEXT NOT NULL | |
| warnings | JSONB NOT NULL DEFAULT '[]' | |
| assumptions | JSONB NOT NULL DEFAULT '[]' | |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | |

### `import_calculation_charges`

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| calculation_id | UUID NOT NULL FK -> import_calculations(id) ON DELETE CASCADE | |
| code | TEXT NOT NULL | CUSTOMS_DUTY etc |
| name | TEXT NOT NULL | |
| rate_type | TEXT NOT NULL | |
| rate | TEXT NOT NULL | as applied |
| taxable_base | NUMERIC(18,2) NOT NULL | |
| formula | TEXT NOT NULL | |
| amount | NUMERIC(18,2) NOT NULL | |
| currency | CHAR(3) NOT NULL | |
| source | TEXT NOT NULL | |
| rule_id | TEXT NULL | |
| calculation_order | INT NOT NULL | |

Indexes: `(calculation_id)`, `(code)`.

Reproducibility: charges and totals are snapshotted at calculation time, including
rule ids and rule version, so later rule changes do not alter historical rows.

Migration SQL and rollback SQL will be provided as separate `.up.sql`/`.down.sql`
files (with preflight/postflight) following the existing M2 convention, for
review and approval. No migration is executed in Phase 3.

## 7. API contract

### Request (proposed)

```json
{
  "destination": "TZ_MAINLAND",
  "simulationDate": "2026-11-18",
  "reference": "OPTIONAL-REFERENCE",
  "hsCode": "04011000",
  "tariffId": 331,
  "originCountry": "KE",
  "currency": "USD",
  "invoiceValue": "1000.00",
  "freight": "150.00",
  "insurance": "20.00",
  "otherCosts": "0.00",
  "quantity": { "value": "100", "unit": "KG" },
  "preferentialTreatment": false
}
```

Validation:
- `destination`: enum `TZ_MAINLAND` (only supported value).
- `simulationDate`: ISO date, not in the future beyond a configured horizon.
- `hsCode`: 2..12 digits after normalization.
- `tariffId`: optional; if provided must match a retrieved tariff.
- `currency`: 3-letter ISO.
- monetary fields: decimal strings or numbers, non-negative, bounded.
- `quantity`: optional; required only when the resolved tariff/rate needs it
  (validated after tariff resolution; if missing → `MISSING_REQUIRED_QUANTITY`).
- `originCountry`: ISO-2 (optional but recommended).
- `preferentialTreatment`: boolean (default false); evidence fields may be added later.

### Response (proposed)

```json
{
  "success": true,
  "data": {
    "calculationId": "uuid",
    "status": "completed|needs_review|unsupported",
    "destination": "TZ_MAINLAND",
    "simulationDate": "2026-11-18",
    "tariff": {
      "id": 331,
      "hsCode": "0401.10.00",
      "description": "...",
      "schedule": "MAIN_TARIFF",
      "originalRate": "SI",
      "resolvedRate": "verified rate or null",
      "sensitiveTariffId": 999
    },
    "candidates": [],
    "valuation": {
      "currency": "USD",
      "invoiceValue": "1000.00",
      "freight": "150.00",
      "insurance": "20.00",
      "otherCostsIncluded": "0.00",
      "exchangeRate": "...",
      "exchangeRateSource": "...",
      "exchangeRateEffectiveDate": "...",
      "customsValue": "...",
      "customsCurrency": "TZS"
    },
    "charges": [
      {
        "code": "CUSTOMS_DUTY",
        "name": "Customs Import Duty",
        "rateType": "ad_valorem",
        "rate": "...",
        "taxableBase": "...",
        "formula": "...",
        "amount": "...",
        "currency": "TZS",
        "source": "...",
        "ruleId": "..."
      }
    ],
    "totals": {
      "customsDuty": "...",
      "exciseDuty": "...",
      "vat": "...",
      "levies": "...",
      "otherCharges": "...",
      "totalImportCharges": "...",
      "customsValue": "...",
      "estimatedLandedCost": "..."
    },
    "warnings": [],
    "assumptions": [],
    "ruleVersion": "TZ-MAINLAND-IMPORTS-DRAFT-UNVERIFIED"
  }
}
```

`totals` is `null` only when the calculation is not completed. The API must not
report `success: true` with fabricated or incomplete totals; use `status` to
convey outcome and HTTP 200 with `status: needs_review`/`unsupported` for
non-fatal incomplete calculations, or 422 for blocking errors.

## 8. Module structure

```
backend/src/modules/calculations/
├── calculations.routes.ts
├── calculations.controller.ts
├── calculations.schemas.ts
├── calculations.service.ts
├── types/calculation.types.ts
├── services/
│   ├── tariff-resolution.service.ts
│   ├── rate-parser.service.ts (existing, moved/kept)
│   ├── customs-valuation.service.ts
│   ├── exchange-rate.service.ts
│   ├── tax-rule.service.ts
│   ├── tax-calculation.service.ts
│   └── calculation-audit.service.ts
└── utils/
    ├── decimal.utils.ts
    └── rounding.utils.ts
```

Existing calculation files are refactored, not replaced wholesale; routes/controllers
keep their thin role.

## 9. Testing strategy

- Unit: HS normalization/leading zeros; tariff resolution (exact, duplicate, SI,
  unresolved); rate parser (all kinds); decimal/rounding; rule selection by
  effective date; tax components; valuation; exchange-rate lookup.
- Integration (DB): tariff retrieval, calculation end-to-end in `unsupported`
  state, audit persistence once tables exist (against a non-production DB).
- Regression: golden expected values from independently verified calculations
  (not generated by the engine under test).
- Error paths: invalid HS, missing exchange rate, ambiguous tariff, unresolved SI,
  unsupported rate, unverified rule, missing quantity.
- Live DB tests remain skipped when `DATABASE_URL` is absent/unreachable.

## 10. Implementation sequence (milestones)

M1 — Tariff resolution service + tests (no DB writes).
M2 — Decimal/rounding utils + customs-valuation + exchange-rate services.
M3 — Tax-rule service + rule schema; keep all rules inactive until verified.
M4 — Tax calculation engine (components + order + dependencies).
M5 — Calculation service orchestration + new request/response contract.
M6 — Audit persistence (migration proposals + service).
M7 — OpenAPI + docs + README updates.
M8 — Migration review/approval and (if approved) apply on Neon branch.

Each milestone is small and reviewable; unverified rules stay inactive.

## 11. Migration proposals

Migrations to be authored as preflight/up/postflight/down triplets following the
existing M2 convention, for review only:

- `import_tax_rules` table.
- `customs_exchange_rates` table.
- `import_calculations` and `import_calculation_charges` tables.
- Indexes and constraints as specified in section 6.

No migration is executed in Phase 3. Rollback scripts (`.down.sql`) must drop
only the new tables/indexes, never touch the four source tables.

## 12. Unresolved decisions and blockers

| # | Decision | Type | Why it matters | Evidence | Recommended approach | Blocks implementation? |
|---|----------|------|----------------|----------|----------------------|------------------------|
| 1 | Exact CET rates per HS line | Legal | Duty cannot be computed without it | cet_tariffs.rate verbatim | Resolve from tariff source; never invent | Yes (for duty amounts) |
| 2 | VAT import base | Legal | Wrong base → wrong VAT | VAT Act / TRA guidance | Verify before activating VAT | Yes |
| 3 | Excise applicability/rates | Legal | Product-specific | Excise Act / Finance Acts | Keep excise unsupported until verified | Yes |
| 4 | RDL rate/base/effective date | Legal | Levy amount | Finance Acts | Secondary 2% CIF; verify | Yes |
| 5 | IDL scope/rates | Legal | Selected goods only | Finance Acts | Keep unsupported until verified | Yes |
| 6 | Customs valuation method | Legal | Determines customsValue | EAC Customs Management Act / WTO | Document as unverified; keep configurable | Yes |
| 7 | Exchange-rate source/frequency | Legal/Technical | Conversion correctness | TRA publications | Service returns null when unavailable | Yes |
| 8 | Rounding rule | Legal/Technical | Final amounts | TRA guidance | Make configurable per rule | Partially |
| 9 | Preferential eligibility | Legal | Rate selection | EAC Rules of Origin | Default to standard CET unless verified evidence | Yes |
| 10 | Quantity mandatory per tariff | Technical | Validation | Tariff quantity column | Conditional validation after tariff resolution | No |
| 11 | Monetary input format (string vs number) | Technical | Decimal precision | Existing schema uses number | Prefer decimal strings; convert via decimal utils | No |
| 12 | Audit table approval | Technical/Legal | Persistence | Migration policy | Propose only; wait for approval | Partially |

## Architecture Review Corrections — Revision 2

### Correction 1 — Tariff and Sensitive Items resolution

Tariff resolution is split into explicit cases instead of a single
"first match" lookup:

1. **Direct selection by ID** — if `tariffId` is supplied, it must be one of the
   HS-code matches; otherwise `VALIDATION_ERROR`. No ambiguity handling needed.
2. **Genuine HS ambiguity** — multiple matches with no `tariffId` and no
   deterministic rule → `AMBIGUOUS_TARIFF`, return all candidates, totals null.
3. **Main tariff with numeric rate** — single main-schedule match with a
   percentage/specific/compound/free rate → resolve directly; no SI lookup.
4. **Main tariff with SI** — main-schedule match whose rate is `SI` → look up
   `SENSITIVE_ITEMS` rows with the same normalized HS code. Resolution succeeds
   only when exactly one Sensitive Items entry exists; otherwise return
   candidates for selection or `UNRESOLVED_SENSITIVE_ITEM`.
5. **Sensitive Items entry selected directly** — allowed when the user explicitly
   chooses a `SENSITIVE_ITEMS` tariff ID; still preserve the main-schedule
   counterpart if present.

Relationship establishment for `HS 04011000` (regression example):
- Matches include a `MAIN_TARIFF` row with raw rate `SI` and a
  `SENSITIVE_ITEMS` row with raw rate `1%`.
- The engine does not pair them by position or assumption. It pairs them only
  because (a) the main row's rate classifies as `sensitive_item`, and (b) a
  `SENSITIVE_ITEMS` row exists with the same normalized HS code.
- Both tariff IDs and both raw rates are stored; the resolved numeric rate
  (`1%`) is recorded separately with its source tariff ID.
- If no Sensitive Items row exists → `UNRESOLVED_SENSITIVE_ITEM`.
- If more than one exists → return candidates; do not guess.

Not every duplicate HS code is a valid Sensitive Items pair; duplicates may be
genuine classification ambiguity or schedule overlap. The engine only treats a
main-schedule `SI` as a Sensitive Items reference when the corresponding
schedule row exists.

Required tests: exact match; leading-zero preservation; main numeric rate;
main SI with one SI entry; main SI with multiple SI entries; main SI with no SI
entry; direct selection by ID; genuine duplicate ambiguity; cross-schedule
distinction; HS 04011000 end-to-end.

### Correction 2 — Tax-rule versioning

`import_tax_rules` no longer uses a globally unique `rule_code`. Instead:

- `rule_code` identifies the rule family (e.g. `TZ_RDL`).
- `rule_scope` identifies the applicable scope (charge + product/condition set).
- `effective_from` / `effective_to` distinguish versions.
- Unique constraint: `(rule_scope, effective_from)` (and optionally
  `(rule_code, effective_from)`).
- `supersedes_rule_id` (self-FK, nullable) links versions.
- Selection for a simulation date: among rows with `verification_status =
  'VERIFIED'`, pick the version where `effective_from <= simulationDate` and
  (`effective_to IS NULL` or `effective_to >= simulationDate`). If more than one
  matches, treat as a data-integrity error (`NO_EFFECTIVE_TAX_RULE` /
  `TAX_RULE_AMBIGUOUS`), never pick arbitrarily.
- Non-overlapping periods for the same `rule_scope` are enforced (see
  Correction 6).

### Correction 3 — Financial precision

The data model distinguishes four precision levels:

- **Input precision**: values are accepted as decimal strings and stored with
  their original scale (up to 6 decimals for rates, 2+ for money inputs).
- **Internal calculation precision**: all arithmetic uses a decimal library at
  high precision (minimum 12 significant decimals); intermediate values are
  never prematurely rounded.
- **Legal rounding precision**: applied only at charge finalization, per the
  verified rule (may be whole TZS or a defined decimal scale).
- **Display precision**: formatting only, does not affect stored amounts.

Currency decimal places are not assumed to be 2; the currency's minor-unit scale
is a property of the currency. Money columns use `NUMERIC` with sufficient scale
(e.g. `NUMERIC(18,6)` for internal, `NUMERIC(18,2)` for finalized display
amounts where legally appropriate).

### Correction 4 — Audit reproducibility

The audit design is extended to preserve:

- Tariff snapshot: selected tariff ID, schedule, original raw rate, resolved
  rate, sensitive counterpart ID and raw rate.
- Tax-rule versions: for each charge, `rule_id`, `rule_code`, `effective_from`,
  `effective_to`, `verification_status`.
- Exchange rate: value, source, effective date, currency pair.
- Input snapshot: all request inputs as submitted.
- Intermediate and final amounts at full internal precision plus rounded values.

Historical calculations remain reproducible because every applied rule version
and tariff snapshot is stored with the calculation; later changes to source
tariffs or tax rules do not alter stored snapshots.

### Correction 5 — API response semantics

Status definitions:

- `completed`: every required charge was calculated using verified rules and
  verified inputs. `totals` is populated (non-null).
- `needs_review`: the calculation could not be fully completed because of a
  resolvable condition (ambiguous tariff, unresolved SI, missing quantity/unit,
  preferential evidence required). `totals` is `null`.
- `unsupported`: a required rule or method is not verified or not applicable.
  `totals` is `null`.
- `failed`: the request could not be processed (validation error, not found,
  blocking integrity error). Returned as an error envelope with an appropriate
  HTTP status, not as a 200 calculation result.

Rules:
- `totals` may be non-null only when `status === 'completed'`.
- An incomplete calculation is never reported as `completed`.
- `success: true` with `totals: null` is allowed only for `needs_review` and
  `unsupported` states.

### Correction 6 — Database integrity

Additional constraints and validation:

- `customs_exchange_rates.exchange_rate > 0` (CHECK).
- Currency codes validated as 3 uppercase letters (CHECK regex) for both
  `currency_code` and `base_currency`; pair validity enforced by a FK to a
  currency reference table or by an approved allow-list CHECK.
- `effective_from <= effective_to` when `effective_to` is not null (CHECK).
- Non-overlapping rule periods per `rule_scope`: enforced with a PostgreSQL
  `EXCLUDE USING gist (rule_scope WITH =, daterange(effective_from,
  effective_to, '[]') WITH &&)` constraint (or equivalent application-level
  validation if the extension is unavailable).
- `verification_status` restricted to `('VERIFIED','SECONDARY','UNVERIFIED')`
  (CHECK).
- Tax dependency integrity: new table `import_tax_rule_dependencies`
  (`rule_id`, `depends_on_rule_id`, PK on both, FKs to `import_tax_rules`,
  `CHECK(rule_id <> depends_on_rule_id)`). Circular dependencies are prevented by
  application-level DAG validation before insert/update; the database enforces
  referential integrity.
- Monetary CHECK constraints where applicable (non-negative inputs).
- Foreign keys from `import_calculations` to `cet_tariffs(id)` for
  `tariff_id` and `sensitive_tariff_id`.

### Changes made in Revision 2 (summary)

1. Replaced first-match tariff selection with explicit resolution cases.
2. Added SI-pair establishment rules using HS 04011000 as a regression example.
3. Changed `import_tax_rules` to support versioned, non-overlapping rule
   periods.
4. Defined four financial precision levels and high-precision internal math.
5. Extended audit snapshot to include tariff, rule versions, exchange rate and
   inputs.
6. Defined exact API status semantics and null-total rules.
7. Added database integrity constraints (positive rates, currency validity,
   date integrity, non-overlap, status allow-list, dependency DAG).

No application code, migration or production data has been changed. Awaiting
final approval before Phase 4.

## Final note

This plan is for review. No implementation, migration or data change has been
performed. Awaiting explicit approval before Phase 4.