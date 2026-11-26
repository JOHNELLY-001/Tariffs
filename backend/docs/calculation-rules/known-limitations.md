# Known Limitations

1. No charge is currently activated. Customs duty, excise, VAT, RDL, IDL and
   other levies return `unsupported` / `needs_review` until their rules are
   verified against primary legal sources.
2. Primary legal sources (TRA, Finance Acts, EAC CET book, EAC Customs
   Management Act) were not reachable/filed during this phase. Rates recorded
   here come from secondary sources and are marked `SECONDARY`/`UNVERIFIED`.
3. Excise duty rates and applicability are product-specific and unverified.
4. Industrial Development Levy scope and rates are from a secondary source only.
5. VAT import base is unverified.
6. Customs valuation method and component treatment are unverified; `otherCosts`
   is not automatically included.
7. Customs exchange-rate source, frequency and effective-date rule are unverified.
8. Rounding rules are unverified.
9. Preferential/EAC treatment is not auto-granted; origin evidence handling is
   unverified.
10. Zanzibar, transit, bonded warehousing, temporary admission and other
    regimes are out of scope.
11. No production database migration has been applied or requested.
12. The calculation audit tables (`import_calculations`,
    `import_calculation_charges`) are proposed only; migration SQL will be
    provided separately for approval.
13. The existing unsupported calculation contract and tests remain valid and
    must continue to pass.
