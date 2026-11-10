# M2 — Migration Proposal (NOT APPLIED)

**Status: awaiting explicit owner approval.**
No migration in this directory has been executed against any database. The
runner refuses to apply or roll back unless `ALLOW_MIGRATE=true` is set and the
corresponding flag is passed.

## 1. Why these changes

| Requirement | Current state (documented baseline) | Proposed change |
|---|---|---|
| Verified chapter→section relationship | `cet_chapter_notes.section_code` does not exist | Add nullable column, load a reviewed 97-row mapping, add FK + index |
| Verified tariff→chapter relationship | `cet_tariffs.chapter_code` does not exist | Add nullable column, backfill only from validated HS codes, add FK + index |
| Subheading-note ownership | Enforced only by convention | Add `CHECK` that exactly one of `chapter_code`/`section_code` is populated |
| Bounded, indexed search | No FTS/trigram/normalized-code index | Add `pg_trgm`, GIN FTS index, trigram index, normalized HS-code expression index |
| Migration audit trail | None | Add `cet_schema_migrations` bookkeeping table |

No column, note, rate, description or source-page value is deleted or rewritten.
`section_code` and `chapter_code` are **new, derived** columns; every existing
column keeps its value.

## 2. Precondition: confirm the live schema first

The documentation is not authoritative over the database. Run at least:

```bash
npm run db:check                                   # read-only inspection
npm run db:migrate -- --status                     # discovery + checksums
npm run db:migrate                                 # dry run: preflights only
```

`db:check` must confirm before approval:

1. Actual columns and types for all four tables (including `heading`, and whether
   `chapter_code`/`section_code` already exist).
2. Exact FK/constraint names on `cet_subheading_notes`.
3. Row counts: 5,966 / 97 / 21 / 76 baseline (report any difference; do not
   "correct" data to match the baseline).
4. Chapter-code and section-code formats (`'01'` vs `'1'`, roman numerals).
5. Whether normalized HS codes are duplicated across schedules.
6. Actual `rate` string forms (including `SI`).

Anything that contradicts this proposal stops the process — the proposal is
updated, not forced.

## 3. Ordered migrations

| # | Migration | Preflight blocks when | Rollback |
|---|---|---|---|
| 0001 | Create `cet_schema_migrations` | Existing table has unexpected columns | Drop bookkeeping table only |
| 0002 | Add `cet_chapter_notes.section_code VARCHAR(10)` | Column exists with wrong type/length | Drop the new column |
| 0003 | Load reviewed chapter→section mapping | Missing/duplicate staging rows, unknown section code, missing source-page reference | Clear derived mapping values |
| 0004 | Add `fk_chapter_section` + index | Any chapter unmapped, orphan reference, non-unique section code | Drop constraint + index |
| 0005 | Add `cet_tariffs.chapter_code VARCHAR(2)` | Column exists with wrong type/length | Drop the new column |
| 0006 | Backfill `chapter_code` from normalized HS codes | Malformed HS code, or derived chapter with no chapter record | Clear derived values |
| 0007 | Add `fk_tariff_chapter` + index | Orphan chapter reference, non-unique chapter code | Drop constraint + index |
| 0008 | Enforce subheading-note ownership | Any row with zero or two owners | Drop check constraint |
| 0009 | Search + normalized-code indexes | `cet_tariffs` large enough that a non-concurrent build needs review | Drop the three indexes |

Each migration is a four-file set:

- `.preflight.sql` — returns **blocking rows**; any row aborts before writes.
- `.up.sql` — forward change, executed in a transaction.
- `.postflight.sql` — returns **anomaly rows**; any row rolls the migration back.
- `.down.sql` — reviewed inverse; `TRUNCATE`/`DELETE` are always rejected.

`NOT NULL` is deliberately **not** added to either relationship column. The
specification requires owner confirmation first, including the treatment of
reserved Chapter 77.

## 4. Chapter→section mapping (0003) — blocking input

`migrations/data/chapter_section_mapping.template.csv` defines the required
staging shape:

```text
chapter_code,section_code,source_page,source_reference
```

Rules:

- One row per chapter, all **97** chapters, sourced from the
  `CET 2022 VERSION updated June 2025` PDF.
- `source_page` and `source_reference` are mandatory; the preflight rejects rows
  without them.
- Membership is **never** inferred from chapter order or HS numbering.
- Chapter 77 (reserved) must be mapped or explicitly flagged for a separate
  decision — not guessed.

Until this file exists and is reviewed, migration 0003/0004 cannot proceed. The
backend remains fully functional without them: section context is reported as
unverified (`contextComplete: false`, `SECTION_MAPPING_NOT_VERIFIED`).

## 5. Search index evidence

Migration 0009 proposes:

- `GIN (to_tsvector('simple', COALESCE(description, '')))` — matches the
  application's query exactly.
- `GIN (description gin_trgm_ops)` — partial/typo tolerance.
- `((regexp_replace(hs_code, '[^0-9]', '', 'g')))` — exact/prefix code lookup.

A stored generated `hs_code_normalized` column was considered and is **not**
proposed yet: it depends on confirming stored code formats and duplicate
behaviour from the live database. The expression index delivers the same
lookup performance without adding a column.

Before approval, capture query plans for the search and exact-code predicates
(`EXPLAIN (ANALYZE, BUFFERS)`) on a Neon branch, with and without these indexes,
and include the comparison in the approval record.

## 6. Apply procedure (only after approval)

```bash
# 1. Confirm the branch/staging target
npm run db:migrate -- --status

# 2. Dry run: preflight only
npm run db:migrate

# 3. Apply on a Neon branch first
ALLOW_MIGRATE=true npm run db:migrate -- --apply

# 4. Verify counts unchanged, then apply to production
ALLOW_MIGRATE=true npm run db:migrate -- --apply
```

Rollback (same review discipline):

```bash
ALLOW_MIGRATE=true npm run db:migrate -- --down 0009 --confirm-rollback
```

## 7. Approval checklist

- [ ] Live schema inspection attached (`npm run db:check` output).
- [ ] Row counts match the baseline, or differences explained.
- [ ] 97-row mapping reviewed with source-page references; Chapter 77 decided.
- [ ] HS-code format and duplicate analysis attached.
- [ ] Rate-string sample attached, including `SI` and compound forms.
- [ ] Index plan compared on a Neon branch.
- [ ] Named approver and target database recorded.
