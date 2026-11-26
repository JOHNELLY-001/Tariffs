# Tax Rules Specification — Tanzania Mainland Imports

All rates below are recorded with their current verification status. Until a row
is `VERIFIED`, the corresponding charge must return `unsupported` / `needs_review`
and must not produce an amount.

Scope: Tanzania Mainland, normal commercial imports for home consumption.

## 1. Customs import duty (EAC Common External Tariff)

- Legal name: Customs import duty (EAC CET).
- Rate type: ad valorem (percentage), specific, compound, or sensitive-item
  (`SI`) reference depending on the tariff line.
- Rate schedule (secondary, S3):
  - Raw materials, agricultural inputs, pharmaceuticals and medicines: 0%.
  - Industrial used goods: 10%.
  - Consumer goods: 25%.
  - Specified goods: 35%.
- Applicable goods: per the CET tariff line for the declared HS code and schedule
  (`MAIN_TARIFF` vs `SENSITIVE_ITEMS`).
- Calculation base: customs value (see `customs-valuation.md`).
- Formula: `duty = customsValue * rate / 100` for ad valorem; `quantity * rate`
  for specific; both components for compound (relationship between components
  must be taken from the legal wording — `or` vs `and` is not assumed).
- Calculation order: 1 (first charge).
- Exemptions: EAC preferential treatment where Rules of Origin are met and
  required evidence is held; statutory exemptions/remissions.
- Effective date: UNVERIFIED (CET 2022 updated June 2025 per project docs;
  Finance Act changes may apply).
- Verification status: `SECONDARY` for the band summary; `UNVERIFIED` for the
  exact rate applicable to any individual HS line (resolved from `cet_tariffs.rate`
  verbatim, never invented).
- Notes: `SI` is never a numeric rate. A main-schedule `SI` entry must be
  resolved against the `SENSITIVE_ITEMS` schedule; calculation is rejected when
  the applicable rate cannot be resolved.

## 2. Excise duty

- Legal name: Excise duty on imported goods.
- Rate type: specific and/or ad valorem, product-dependent (Excise Management and
  Tariff Act; Finance Act amendments).
- Rate schedule: UNVERIFIED — excise applies only to specified goods (e.g.
  beverages, tobacco, cosmetics, vehicles, petroleum, etc.) at rates that change
  by Finance Act. No rate is hard-coded.
- Applicable goods: only where the tariff/excise schedule lists the goods.
- Calculation base: UNVERIFIED — dutiable value per the Excise Act (may differ
  from customs value).
- Formula: UNVERIFIED until the applicable rate and base are confirmed.
- Calculation order: after customs duty, before VAT (typical; to be confirmed).
- Exemptions: statutory exemptions; EAC origin goods may be exempt where stated.
- Effective date: UNVERIFIED.
- Verification status: `UNVERIFIED`.

## 3. Value Added Tax (VAT) — Tanzania Mainland

- Legal name: Value Added Tax (VAT).
- Rate type: percentage.
- Rate (secondary, S2/S3): standard rate 18%; zero rate 0% for exports.
- Applicable goods: taxable imports for home consumption (exempt supplies
  excluded).
- Calculation base: UNVERIFIED — commonly `customs value + customs duty +
  excise duty + other charges` for imports, but the exact base and inclusions
  must be confirmed against the VAT Act and TRA guidance.
- Formula: `vat = vatBase * 18 / 100` (base definition unverified).
- Calculation order: after customs duty, excise and levies.
- Exemptions: exempt supplies; statutory reliefs.
- Effective date: UNVERIFIED (Finance Act changes; reduced 16% rate for certain
  supplies via approved electronic payment — applicability to imports unverified).
- Verification status: `SECONDARY` for the 18% rate; `UNVERIFIED` for the import
  VAT base.

## 4. Railway Development Levy (RDL)

- Legal name: Railway Development Levy.
- Rate type: percentage.
- Rate (secondary, S3): 2% of CIF value.
- Applicable goods: imports for home consumption in Tanzania Mainland.
- Calculation base: CIF value (cost + insurance + freight) — per S3.
- Formula: `rdl = cifValue * 2 / 100`.
- Calculation order: alongside/after customs duty (independent base).
- Exemptions: EAC Partner State goods meeting Rules of Origin (from 1 July 2026
  per S3); other statutory exemptions.
- Effective date: UNVERIFIED.
- Verification status: `SECONDARY` for rate and base; `UNVERIFIED` for legal
  source and effective date.

## 5. Industrial Development Levy (IDL)

- Legal name: Industrial Development Levy.
- Rate type: percentage, goods-specific.
- Rate schedule (secondary, S3, from 1 July 2026):
  - Exercise books and notebooks: 5%.
  - Trailers: 5%.
  - Aluminium doors and windows: 5%.
  - Fishing nets: 10%.
  - Steel structures: 10%.
- Applicable goods: selected goods only.
- Calculation base: UNVERIFIED (likely CIF/customs value).
- Formula: UNVERIFIED (rate × base, subject to the applicable base).
- Calculation order: with other levies.
- Exemptions: statutory.
- Effective date: UNVERIFIED.
- Verification status: `UNVERIFIED` (scope and rates from secondary source only).

## 6. Other statutory charges

- Skills and Development Levy (SDL), stamp duty, airport/port service charges,
  HIV/AIDS and universal health coverage levies, fuel levies, etc. are not import
  charges for normal commercial imports and are excluded from this engine's scope
  unless a verified import-specific charge is identified.
- Any additional import levy must be added only after primary verification.

## Verification status summary

| Charge | Rate | Base | Order | Status |
|--------|------|------|-------|--------|
| Customs duty | UNVERIFIED per line | customs value | 1 | SECONDARY (bands) |
| Excise duty | UNVERIFIED | UNVERIFIED | 2 | UNVERIFIED |
| RDL | SECONDARY 2% | CIF | 3 | SECONDARY |
| IDL | SECONDARY (selected) | UNVERIFIED | 3 | UNVERIFIED |
| VAT | SECONDARY 18% | UNVERIFIED | 4 | SECONDARY |
| Other levies | n/a | n/a | n/a | UNVERIFIED |
