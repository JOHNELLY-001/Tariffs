# Customs Valuation Methodology — Tanzania Mainland

## Method

Tanzania is an EAC Partner State and applies the EAC customs valuation regime,
which is based on the WTO Agreement on Customs Valuation (transaction value).
The exact EAC/Tanzania valuation provisions, adjustments and exclusions must be
confirmed against the EAC Customs Management Act and TRA guidance before
activation.

- Primary method (to be confirmed): transaction value — the price actually paid
  or payable for the goods when sold for export to Tanzania, subject to permitted
  additions and deductions.
- Fallback methods (sequential, to be confirmed): transaction value of identical
  goods, of similar goods, deductive value, computed value, fallback.

Verification status: `UNVERIFIED` (method stated from general knowledge; primary
text not filed).

## Valuation components and treatment

| Component | Treatment | Status |
|-----------|-----------|--------|
| Invoice (FOB) value | Included (price paid/payable) | SECONDARY |
| International freight to port of entry | Included (CIF basis used for RDL per S3) | SECONDARY |
| Insurance | Included (CIF basis used for RDL per S3) | SECONDARY |
| Packing costs | Likely included (WTO addition) | UNVERIFIED |
| Selling commissions / assists / royalties | May be added where applicable | UNVERIFIED |
| Post-importation inland freight and handling | Likely excluded | UNVERIFIED |
| Discounts (trade/quantity) | Treatment per verified conditions | UNVERIFIED |
| "Other costs" field | Must not be assumed includable; each cost requires a defined treatment | UNVERIFIED |

The API collects `invoiceValue`, `freight`, `insurance` and `otherCosts`. The
engine must not silently add `otherCosts` to the customs value until its legal
treatment is defined and verified.

## Currency conversion

- Invoice currency may differ from the customs currency (TZS).
- Conversion uses a verified customs exchange rate for the simulation date.
- Exchange rate source and effective date must be recorded.
- No exchange rate is hard-coded.
- If the required rate is unavailable, the calculation is rejected with
  `EXCHANGE_RATE_UNAVAILABLE`.
- Verification status: `UNVERIFIED` (TRA exchange-rate publication and frequency
  not yet filed).

## Decimal and rounding rules

- All monetary calculations use decimal-safe arithmetic (no JavaScript
  floating point).
- Rounding to TZS units: UNVERIFIED (whether to whole TZS or 2 decimals).
- Rounding must be applied per charge as defined by the verified rules.

## Output fields

- `currency` (invoice currency)
- `invoiceValue`
- `freight`
- `insurance`
- `otherCostsIncluded`
- `exchangeRate`
- `exchangeRateSource`
- `exchangeRateEffectiveDate`
- `customsValue`
- `customsCurrency` (TZS)
