# M2 — Migration Proposal (NOT APPLIED)

**Status: awaiting explicit owner approval.**
No migration in this directory has been executed against any database. The
runner refuses to apply or roll back unless `ALLOW_MIGRATE=true` is set and the
corresponding flag is passed.

The finalized 97-row mapping and the per-migration readiness review are in
[`database-readiness-review.md`](./database-readiness-review.md). The mapping
artifact is `migrations/data/chapter_section_mapping.csv`.

## 1. Why these changes

| Requirement | Current state (documented baseline) | Proposed change |
|---|---|---|
| Verified chapter→section relationship | `cet_chapter_notes.section_code` does not exist | Add nullable column, load a reviewed 97-row mapping, add FK + index |
| Verified tariff→chapter relationship | `cet_tariffs.chapter_code` does not exist | Add nullable column, backfill only from validated HS codes, add FK + index |
| Subheading-note ownership | Enforced only by convention | Add `CHECK` that exactly one of `chapter_code`/`section_code` is populated |
| Bounded, indexed search | No FTS/normalized-code/schedule index | 0009: core GIN FTS, normalized HS-code expression, `schedule_type` index (no extension). 0010 (optional): `pg_trgm` + trigram index |
| Migration audit trail | None | Add `cet_schema_migrations` bookkeeping table |

No column, note, rate, description or source-page value is deleted or rewritten.
`section_code` and `chapter_code` are **new, derived** columns; every existing
column keeps its value.

## 2. Precondition: confirm the live schema first

The documentation is not authoritative over the database. Run at least:

```bash
npm run db:check                                   # read-only inspection
npm run db:migrate -- --status                     # discovery + checksums
```

The all-pending dry run (`npm run db:migrate`) cannot validate `0004`/`0007`
before `0002`/`0005` are applied, because those preflights reference the new
columns. See the staging note in
[`database-readiness-review.md`](./database-readiness-review.md#65-preflight).

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

### 2.1 Live inspection result (2026-11-11)

Read-only inspection confirmed:

- Counts match the baseline: 5,966 / 97 / 21 / 76.
- **Only `plpgsql` is installed**; `pg_trgm` is available on the server but not
  installed. This affects only optional migration 0010 — search works without it.
- `cet_tariffs` columns: `id bigint`, `hs_code varchar NOT NULL`,
  `description text NOT NULL`, `quantity text`, `rate text`,
  `source_page integer`, `extraction_phase integer`, `created_at timestamptz`,
  `heading varchar`, `schedule_type varchar`.
- `extraction_phase` is **integer** (not text) and is exposed as a number.
- `schedule_type` distribution: `MAIN_TARIFF` 5,760 (phases 1–11),
  `SENSITIVE_ITEMS` 206 (phase 12). 10 normalized HS codes appear under both
  schedules; 50 rows have `rate = 'SI'`, all in `MAIN_TARIFF`.
- `cet_chapter_notes.section_code` and `cet_tariffs.chapter_code` do **not**
  exist yet (this proposal's 0002/0005).
- Subheading-note chapter and section foreign keys are already present; the
  ownership `CHECK` proposed in 0008 is still absent.

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
| 0009 | Core search + schedule indexes (no extension) | `cet_tariffs` large enough that a non-concurrent build needs review | Drop the three indexes |
| 0010 | **Optional** `pg_trgm` + trigram index | `pg_trgm` unavailable, or table needs a non-concurrent review | Drop the trigram index (extension retained) |

Classification: 0001–0007 and 0009 are essential (0009 for production
performance); 0008 and 0010 are optional. The full per-migration impact and
rollback review is in
[`database-readiness-review.md`](./database-readiness-review.md#4-migration-by-migration-review).

Each migration is a four-file set:

- `.preflight.sql` — returns **blocking rows**; any row aborts before writes.
- `.up.sql` — forward change, executed in a transaction.
- `.postflight.sql` — returns **anomaly rows**; any row rolls the migration back.
- `.down.sql` — reviewed inverse; `TRUNCATE`/`DELETE` are always rejected.

`NOT NULL` is deliberately **not** added to either relationship column. The
specification requires owner confirmation first, including the treatment of
reserved Chapter 77.

## 4. Chapter→section mapping (0003) — finalized, awaiting approval

`migrations/data/chapter_section_mapping.template.csv` defines the required
staging shape. The finalized artifact is
`migrations/data/chapter_section_mapping.csv`:

```text
chapter_code,section_code,source_page,source_reference
```

Rules applied:

- One row per chapter, all **97** chapters.
- 97 distinct chapter codes and 21 distinct section codes.
- `source_page` and `source_reference` are present on every row; the preflight
  rejects rows without them.
- Membership is **never** inferred at query time from chapter order or HS
  numbering.
- Chapter 77 is recorded explicitly under Section XV, flagged as reserved, with
  zero tariff lines. See the decision in
  [`database-readiness-review.md`](./database-readiness-review.md#33-chapter-77-decision-explicit-not-inferred).

The backend remains fully functional without 0003/0004: section context is
reported as unverified (`contextComplete: false`,
`SECTION_MAPPING_NOT_VERIFIED`) until the mapping is applied.

The original CET PDF is not stored in this repository. `source_page` values come
from the chapter pages already extracted into `cet_chapter_notes`; owner
confirmation of those references is part of the approval gate.

## 5. Search index evidence

**The API does not depend on any extension.** Description search uses
`to_tsvector` / `websearch_to_tsquery` (core PostgreSQL), and HS-code matching
uses `regexp_replace` (also core). The live endpoint was returning `503` because
of a parameter-binding bug, not a missing extension or index.

Migration 0009 (core, no extension) proposes:

- `GIN (to_tsvector('simple', COALESCE(description, '')))` — matches the
  application's query exactly.
- `((regexp_replace(hs_code, '[^0-9]', '', 'g')))` — exact/prefix code lookup.
- `(schedule_type)` — schedule filtering and the distinction between
  `MAIN_TARIFF` (5,760 rows) and `SENSITIVE_ITEMS` (206 rows).

Migration 0010 is **optional** and isolated because it requires the `pg_trgm`
extension and the `CREATE EXTENSION` privilege:

- `GIN (description gin_trgm_ops)` — partial/typo tolerance.

A stored generated `hs_code_normalized` column was considered and is **not**
proposed yet: it depends on confirming stored code formats and duplicate
behaviour from the live database. The expression index delivers the same
lookup performance without adding a column.

Before approval, capture query plans for the search and exact-code predicates
(`EXPLAIN (ANALYZE, BUFFERS)`) on a Neon branch, with and without these indexes,
and include the comparison in the approval record.

## 6. Apply procedure (only after approval)

The full Neon-branch sequence — baseline fingerprints, staging-table creation and
CSV load, staging verification, preflight caveat, apply, post-apply checks,
rollback drill and query-plan capture — is in
[`database-readiness-review.md`](./database-readiness-review.md#6-neon-branch-staging-sequence).

Summary:

```bash
# 1. Confirm the branch/staging target
npm run db:migrate -- --status

# 2. Create and load chapter_section_mapping_staging from
#    migrations/data/chapter_section_mapping.csv (see the review)

# 3. Apply on a Neon branch first
ALLOW_MIGRATE=true npm run db:migrate -- --apply

# 4. Verify counts/fingerprints unchanged and run the rollback drill
# 5. Only then schedule production with a named approver and restore point
```

Rollback (same review discipline, reverse dependency order):

```bash
ALLOW_MIGRATE=true npm run db:migrate -- --down 0010 --confirm-rollback
```

## 7. Approval checklist

- [x] Live schema inspection attached (`npm run db:check` output).
- [x] Row counts match the baseline (5,966 / 97 / 21 / 76).
- [x] 97-row mapping written with source-page references; Chapter 77 explicitly
      recorded under Section XV as reserved.
- [x] HS-code format and duplicate analysis attached (0 malformed, 0 unresolved).
- [ ] Mapping and Chapter 77 decision approved by the owner.
- [ ] Rate-string sample attached, including `SI` and compound forms.
- [ ] Index plan compared on a Neon branch.
- [ ] Named approver and target database recorded.
- [ ] Neon branch run and rollback drill passed.
