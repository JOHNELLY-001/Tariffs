# Legal Sources Register — Tanzania Mainland Import-Cost Calculation

Scope: Tanzania Mainland, normal commercial imports for home consumption only.
Zanzibar, transit, bonded warehousing, temporary admission and other customs
regimes are out of scope for this register.

Status legend:

- `VERIFIED` — confirmed against a primary legal/institutional source and an
  effective date.
- `SECONDARY` — reported by a secondary (non-authoritative) source; primary
  verification still pending.
- `UNVERIFIED` — not yet confirmed; must not be activated in production
  calculations.

Primary sources that must be obtained and filed before any rate is activated:

1. East African Community Common External Tariff (CET) schedule applicable to
   Tanzania — the tariff book the `cet_tariffs` table is derived from
   (CET 2022, updated June 2025 per project documentation).
2. EAC Customs Union Protocol and the EAC Customs Management Act / Regulations.
3. Tanzania Value Added Tax Act (Cap. 148) and VAT (General) Regulations.
4. Tanzania Excise (Management and Tariff) Act and Finance Act amendments.
5. Tanzania Finance Acts (current and recent years) for RDL, IDL, excise and
   VAT changes.
6. Tanzania Revenue Authority (TRA) customs valuation and exchange-rate
   publications.
7. EAC Rules of Origin and preferential-treatment instruments.

## Sources consulted

| # | Source | Type | Status | Notes |
|---|--------|------|--------|-------|
| S1 | EAC website (`eac.int`) — Customs Union overview | Institutional (primary, general) | SECONDARY | General Customs Union context only; no rate tables retrieved. |
| S2 | Wikipedia "Taxation in Tanzania" | Tertiary | SECONDARY | VAT standard rate 18% reported; VAT Act citation not captured. |
| S3 | TanzaniaInvest "Taxation in Tanzania: Guide to The Tax System and Rates" (2026) | Commercial/secondary | SECONDARY | Detailed rates and Finance Act 2025/2026 changes; not a legal authority. Used only as a working reference pending primary verification. |
| S4 | Project dataset `cet_tariffs` (5,966 rows) | Source data | VERIFIED (as stored) | Rates preserved verbatim; never overwritten. |
| S5 | TRA website (`tra.go.tz`) | Institutional (primary) | UNVERIFIED | Not reachable from this environment; must be retrieved and filed. |
| S6 | Tanzania Finance Acts / EAC CET tariff book | Legislation (primary) | UNVERIFIED | Not available in repository; must be obtained and filed. |

## Network/access limitation recorded

The TRA website and the EAC online tariff tool were not reachable during this
phase. Consequently every rate, base and formula below is recorded as
`UNVERIFIED` or `SECONDARY` and is **not** activated in production calculations.
No migration, no code change and no test expectation in this phase relies on a
rate being correct. Primary documents must be filed under
`backend/docs/calculation-rules/` (or an agreed evidence folder) before
Phase 4 implementation activates any charge.

## Rule version

Draft rule version identifier (not yet effective for production):
`TZ-MAINLAND-IMPORTS-DRAFT-UNVERIFIED` (simulation dates accepted, but charges
remain disabled until verification).
