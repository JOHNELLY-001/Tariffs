# Database Readiness Review — Mapping and Migrations 0001–0010

**Status: awaiting explicit owner approval. Nothing in this document has been
executed against production.** The live database was inspected read-only on
2026-11-11. No tariff, chapter, section or subheading record was modified.

Companion artifacts:

- `migrations/data/chapter_section_mapping.csv` — finalized 97-row mapping.
- `docs/migrations/M2-proposal.md` — original proposal and rationale.

---

## 1. Guardrails used for this review

1. The live database, not the documentation, is authoritative.
2. Existing source data is never rewritten: no `rate`, `description`,
   `quantity`, `hs_code`, page, or note text is changed.
3. The only data writes proposed are the two **new derived columns**
   (`cet_chapter_notes.section_code`, `cet_tariffs.chapter_code`).
4. Chapter membership is taken from an explicit reviewed mapping; it is not
   inferred at query time from chapter order or HS numbering.
5. Nothing is applied without `ALLOW_MIGRATE=true` and an explicit `--apply`.
6. Production execution is out of scope until this review is approved.

---

## 2. Live schema verification (read-only)

| Check | Result |
|---|---|
| `cet_tariffs` rows | 5,966 |
| `cet_chapter_notes` rows | 97 (97 distinct chapter codes) |
| `cet_section_notes` rows | 21 (21 distinct section codes) |
| `cet_subheading_notes` rows | 76 |
| `schedule_type` | `MAIN_TARIFF` 5,760; `SENSITIVE_ITEMS` 206; none null |
| Installed extensions | `plpgsql` only |
| `pg_trgm` | available on the server, **not installed** |
| `cet_chapter_notes.section_code` | absent |
| `cet_tariffs.chapter_code` | absent |
| `cet_schema_migrations` | absent (all 10 migrations pending) |
| Malformed HS codes | 0 |
| HS codes with no matching chapter | 0 |
| Subheading notes with 0 or 2 owners | 0 |
| Tariff rows in Chapter 77 | 0 |
| `cet_chapter_notes.chapter_code` uniqueness | `cet_chapter_notes_chapter_code_key` (UNIQUE) |
| `cet_section_notes.section_code` uniqueness | `cet_section_notes_section_code_key` (UNIQUE) |

Consequences:

- The foreign keys in `0004` and `0007` have the required unique parent keys.
- `0006` can derive a chapter for every tariff row; it does not need to invent
  one.
- `0008` preflight is clear (zero invalid owners).
- `0010` is genuinely optional: the search path works without `pg_trgm`.

---

## 3. Finalized chapter→section mapping

Artifact: `migrations/data/chapter_section_mapping.csv`

```text
chapter_code,section_code,source_page,source_reference
```

- 97 data rows + header.
- 97 distinct chapter codes, 21 distinct section codes.
- Every row has a non-null `source_page` and `source_reference`.
- No duplicate chapter codes.

### 3.1 Section ranges represented

| Section | Chapters | Rows |
|---|---|---:|
| I — Live animals; animal products | 01–05 | 5 |
| II — Vegetable products | 06–14 | 9 |
| III — Animal/vegetable/microbial fats and oils | 15 | 1 |
| IV — Prepared foodstuffs; beverages; tobacco | 16–24 | 9 |
| V — Mineral products | 25–27 | 3 |
| VI — Products of the chemical or allied industries | 28–38 | 11 |
| VII — Plastics and rubber | 39–40 | 2 |
| VIII — Raw hides, leather, furskins | 41–43 | 3 |
| IX — Wood, cork, basketware | 44–46 | 3 |
| X — Pulp, paper and paperboard | 47–49 | 3 |
| XI — Textiles and textile articles | 50–63 | 14 |
| XII — Footwear, headgear, umbrellas, feathers | 64–67 | 4 |
| XIII — Stone, ceramics, glass | 68–70 | 3 |
| XIV — Pearls, precious metals, jewellery, coin | 71 | 1 |
| XV — Base metals and articles of base metal | 72–83 (incl. 77) | 12 |
| XVI — Machinery and electrical equipment | 84–85 | 2 |
| XVII — Vehicles, aircraft, vessels | 86–89 | 4 |
| XVIII — Optical/medical instruments, clocks, music | 90–92 | 3 |
| XIX — Arms and ammunition | 93 | 1 |
| XX — Miscellaneous manufactured articles | 94–96 | 3 |
| XXI — Works of art, collectors' pieces and antiques | 97 | 1 |

### 3.2 Source-page basis

`source_page` is the printed page on which the chapter heading appears. It is
taken from `cet_chapter_notes.source_page_start`, which was populated from the
`CET 2022 VERSION updated June 2025` extraction already loaded in the database.
Each `source_reference` quotes the parent section heading and the chapter
heading, for example:

```text
CET 2022, Section XV - BASE METALS AND ARTICLES OF BASE METAL; Chapter 72 - Iron and Steel (printed page 367)
```

The original CET PDF is **not stored in this repository**, so this review did
not re-open the PDF. It validates the extracted chapter rows against the live
section/chapter titles, the unique section codes, the printed page order, and
the Section XV note text. Owner confirmation of the page references is part of
the approval gate.

### 3.3 Chapter 77 decision (explicit, not inferred)

Live row:

```text
chapter_code: 77
chapter_title: (Reserved for possible future use in the Harmonized System)
source_page: 407
chapter_notes: null
tariff rows: 0
```

**Decision proposed for approval:** keep Chapter 77 in **Section XV** and keep
its chapter record. It is a reserved HS chapter with no tariff lines; it sits
between Chapters 76 and 78 in the printed Section XV sequence (pages 364–421),
and Section XV notes refer to "Chapters 72 to 76 and 78 to 82", which brackets
the reserved chapter. The CSV row carries a `REVIEWED DECISION` flag in
`source_reference`.

This is recorded explicitly so that no later process silently drops the
chapter, assigns it to another section, or treats it as an extraction error.
It does not create any tariff or note data.

---

## 4. Migration-by-migration review

### Summary

| # | Migration | Classification | Existing row values changed? | Rollback |
|---|---|---|---|---|
| 0001 | Create `cet_schema_migrations` | **Essential** (audit infrastructure) | No — new table only | Drop tracking table |
| 0002 | Add `cet_chapter_notes.section_code VARCHAR(10)` | **Essential** | No — new nullable column | Drop the column |
| 0003 | Load reviewed chapter→section mapping | **Essential** | Yes — derived `section_code` on 97 chapter rows only | Set `section_code = NULL` |
| 0004 | Add `fk_chapter_section` + index | **Essential** (integrity + lookups) | No | Drop constraint and index |
| 0005 | Add `cet_tariffs.chapter_code VARCHAR(2)` | **Essential** | No — new nullable column | Drop the column |
| 0006 | Backfill `chapter_code` from validated HS codes | **Essential** | Yes — derived `chapter_code` on 5,966 tariff rows only | Set `chapter_code = NULL` |
| 0007 | Add `fk_tariff_chapter` + index | **Essential** (integrity + lookups) | No | Drop constraint and index |
| 0008 | Enforce subheading-note ownership | **Optional** (hardening) | No | Drop check constraint |
| 0009 | Core search / schedule / normalized-code indexes | **Essential for production performance** | No | Drop three indexes |
| 0010 | `pg_trgm` + trigram index | **Optional** | No | Drop trigram index (keep extension) |

No migration drops a table or column from the forward path. The runner also
rejects `TRUNCATE`, `DELETE FROM`, and destructive `ALTER TABLE ... DROP COLUMN`
in forward migrations.

### 0001 — Create migration tracking table

- **Change:** creates `cet_schema_migrations(version, description, checksum,
  applied_at, applied_by)`.
- **Why:** without it, applied migrations cannot be identified reliably and
  checksums cannot be compared. Every later migration writes one row here.
- **Existing records:** none. New table only.
- **Preflight:** blocks if a table of that name already exists with unexpected
  columns.
- **Postflight:** blocks if the table is missing.
- **Rollback:** `DROP TABLE IF EXISTS cet_schema_migrations`. This discards
  bookkeeping only; it does not touch tariff or note data. Roll it back last.
- **Classification:** essential.

### 0002 — Add `cet_chapter_notes.section_code`

- **Change:** adds nullable `VARCHAR(10)` column.
- **Why:** the chapter→section relationship has no storage today. `VARCHAR(10)`
  matches the existing `cet_section_notes.section_code` width (Roman numerals up
  to `XXI`).
- **Existing records:** no existing column or value changes. All 97 rows read
  `NULL` until 0003.
- **Preflight:** blocks if the column already exists with a different type or
  length.
- **Postflight:** blocks if the column is missing.
- **Rollback:** `ALTER TABLE cet_chapter_notes DROP COLUMN IF EXISTS section_code`.
  This removes derived mapping values, not source text. Roll back after 0004 and
  0003.
- **Classification:** essential.

### 0003 — Load the reviewed chapter→section mapping

- **Change:** `UPDATE cet_chapter_notes SET section_code = staging.section_code`
  for all matching chapters.
- **Why:** populates the new relationship from the reviewed 97-row mapping.
- **Existing records:** changes **only** the new derived `section_code` column
  on the 97 chapter rows. Titles, notes, page ranges and creation timestamps are
  untouched.
- **Dependency:** requires `chapter_section_mapping_staging` to be created and
  loaded from the CSV before the preflight runs. No migration creates that
  table; the staging sequence does.
- **Preflight blocks:** chapter missing from staging; staging section code not
  present in `cet_section_notes`; duplicate staging chapter; missing
  `source_page` or `source_reference`.
- **Postflight blocks:** an applied section code that differs from staging, or a
  chapter with no staging row.
- **Rollback:** `UPDATE cet_chapter_notes SET section_code = NULL`. Derived
  values only. If other writers have since populated the column, review before
  rolling back.
- **Classification:** essential.

### 0004 — Add `fk_chapter_section` and its index

- **Change:** adds `FOREIGN KEY (section_code) REFERENCES
  cet_section_notes(section_code) NOT VALID`, validates it, and creates
  `idx_chapter_section_code`.
- **Why:** guarantees that every mapped section really exists; the index makes
  chapter filtering by section bounded.
- **Existing records:** no value changes. Validation reads the 97 mapped rows.
- **Preflight blocks:** unmapped chapter, orphan section reference, or duplicate
  section code in `cet_section_notes`. Live data has none of these, and the
  parent `UNIQUE (section_code)` constraint exists.
- **Postflight blocks:** missing FK, unvalidated FK, or missing index.
- **Rollback:** drop `fk_chapter_section` and `idx_chapter_section_code`. Roll
  back before 0003/0002.
- **Classification:** essential.

### 0005 — Add `cet_tariffs.chapter_code`

- **Change:** adds nullable `VARCHAR(2)` column to `cet_tariffs`.
- **Why:** tariff→chapter retrieval and chapter-filtered tariff lists have no
  stored relationship today.
- **Existing records:** no existing column changes. All 5,966 rows read `NULL`
  until 0006.
- **Preflight:** blocks if the column already exists with a different type or
  length.
- **Postflight:** blocks if the column is missing.
- **Rollback:** `ALTER TABLE cet_tariffs DROP COLUMN IF EXISTS chapter_code`.
  Roll back after 0007 and 0006.
- **Classification:** essential.

### 0006 — Backfill `chapter_code` from validated HS codes

- **Change:** derives the first two digits of the normalized HS code, joins to
  `cet_chapter_notes`, and fills `chapter_code` only where it is still `NULL`.
- **Why:** makes the chapter relationship usable without a regex join on every
  read.
- **Existing records:** changes **only** the new derived `chapter_code` column.
  `hs_code`, `description`, `quantity`, `rate`, `source_page`,
  `extraction_phase`, `heading` and `schedule_type` are untouched.
- **Preflight blocks:** malformed HS code (normalized value does not start with
  two digits) or a derived chapter with no chapter record. Live data has zero of
  each.
- **Postflight blocks:** any resolvable tariff row left without a chapter code.
- **Rollback:** `UPDATE cet_tariffs SET chapter_code = NULL WHERE chapter_code IS
  NOT NULL`. Derived values only.
- **Classification:** essential.

### 0007 — Add `fk_tariff_chapter` and its index

- **Change:** adds `FOREIGN KEY (chapter_code) REFERENCES
  cet_chapter_notes(chapter_code) NOT VALID`, validates it, and creates
  `idx_tariffs_chapter_code`.
- **Why:** guarantees every tariff chapter reference exists and keeps
  chapter-filtered listing fast.
- **Existing records:** no value changes. Validation reads the 5,966 backfilled
  rows.
- **Preflight blocks:** orphan chapter reference or duplicate chapter code. Live
  data has neither, and `UNIQUE (chapter_code)` exists.
- **Postflight blocks:** missing FK, unvalidated FK, or missing index.
- **Rollback:** drop `fk_tariff_chapter` and `idx_tariffs_chapter_code`. Roll
  back before 0006/0005.
- **Classification:** essential.

### 0008 — Enforce subheading-note ownership

- **Change:** adds `CHECK` constraint `chk_subheading_note_owner` requiring
  exactly one of `chapter_code` / `section_code` to be non-null, `NOT VALID` then
  validated.
- **Why:** converts an existing convention into a database guarantee.
- **Existing records:** no value changes. Live data has zero invalid rows.
- **Preflight blocks:** any note with zero owners or two owners.
- **Postflight blocks:** missing or unvalidated constraint.
- **Rollback:** drop `chk_subheading_note_owner`.
- **Classification:** optional. The API already behaves correctly; this is
  defense in depth.

### 0009 — Core search, schedule and normalized-code indexes

- **Change:** creates three ordinary indexes:
  - GIN FTS on `to_tsvector('simple', COALESCE(description, ''))`,
  - expression index on `regexp_replace(hs_code, '[^0-9]', '', 'g')`,
  - B-tree on `schedule_type`.
- **Why:** matches the query shapes actually used by `search.repository.ts`.
  No extension is required.
- **Existing records:** no value changes. Index build reads the table.
- **Preflight blocks:** only if `cet_tariffs` exceeds 500,000 estimated rows,
  because the build is non-concurrent.
- **Postflight blocks:** any missing index.
- **Rollback:** drop the three indexes. No table data touched.
- **Classification:** essential for production performance; the API remains
  functionally correct without it.

### 0010 — Optional trigram indexes

- **Change:** `CREATE EXTENSION IF NOT EXISTS pg_trgm` and a GIN trigram index
  on `description`.
- **Why:** improves partial and typo-tolerant matching. The current API does not
  depend on it.
- **Existing records:** no value changes.
- **Preflight blocks:** `pg_trgm` not available on the server, or table large
  enough to need a build review.
- **Postflight blocks:** extension missing or index missing.
- **Rollback:** drop `idx_tariffs_description_trgm`. The shared extension is
  intentionally retained because dropping it could affect other users of the
  database.
- **Classification:** optional. Keep it separate from 0009 so a missing
  `CREATE EXTENSION` privilege cannot block the core work.

---

## 5. Dependency and ordering

Forward:

```text
0001 → 0002 → 0003 → 0004
              0005 → 0006 → 0007
0008 (independent)
0009 (independent)
0010 (optional, independent)
```

Staging load must happen after the branch exists and before the 0003 preflight.

Rollback must run in reverse dependency order:

```text
0010 → 0009 → 0008 → 0007 → 0006 → 0005 → 0004 → 0003 → 0002 → 0001
```

`0003` and `0006` rollback scripts clear derived values; `0002` and `0005` drop
derived columns. None of them delete rows or rewrite source text.

---

## 6. Neon branch staging sequence

### 6.1 Prepare the branch and confirm the target

1. Create a Neon branch from the current production branch (copy-on-write).
2. Point a **separate** environment at that branch. Do not reuse the production
   connection string.
3. Confirm the endpoint before any write:

```sql
SELECT current_database(),
       current_user,
       inet_server_addr() AS server_addr,
       current_setting('neon.branch_id', true) AS branch_id;
```

Record the branch endpoint and branch id in the change record. If the endpoint
is not the branch, stop.

### 6.2 Capture the baseline

```bash
npm run db:check
npm run db:migrate -- --status      # expect 10 pending
```

Capture row counts and content fingerprints so later steps can prove that
source data did not change:

```sql
SELECT 'cet_tariffs' AS table_name, COUNT(*) FROM cet_tariffs
UNION ALL SELECT 'cet_chapter_notes', COUNT(*) FROM cet_chapter_notes
UNION ALL SELECT 'cet_section_notes', COUNT(*) FROM cet_section_notes
UNION ALL SELECT 'cet_subheading_notes', COUNT(*) FROM cet_subheading_notes;

SELECT md5(string_agg(t.id || ':' || t.hs_code || ':' || t.description || ':'
                      || COALESCE(t.quantity, '') || ':' || COALESCE(t.rate, '') || ':'
                      || COALESCE(t.source_page::text, '') || ':' || COALESCE(t.extraction_phase::text, '') || ':'
                      || COALESCE(t.heading, '') || ':' || COALESCE(t.schedule_type, ''), '|' ORDER BY t.id)) AS tariff_fingerprint
  FROM cet_tariffs t;

SELECT md5(string_agg(c.chapter_code || ':' || c.chapter_title || ':'
                      || COALESCE(c.chapter_notes, '') || ':'
                      || COALESCE(c.source_page_start::text, '') || ':' || COALESCE(c.source_page_end::text, ''), '|' ORDER BY c.chapter_code)) AS chapter_fingerprint
  FROM cet_chapter_notes c;
```

Save the output with the branch name.

### 6.3 Create and load the staging table

Run from `backend/`:

```sql
DROP TABLE IF EXISTS chapter_section_mapping_staging;

CREATE TABLE chapter_section_mapping_staging (
  chapter_code     VARCHAR(2)  PRIMARY KEY,
  section_code     VARCHAR(10) NOT NULL,
  source_page      INTEGER     NOT NULL,
  source_reference TEXT        NOT NULL
);
```

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\copy chapter_section_mapping_staging FROM 'migrations/data/chapter_section_mapping.csv' WITH (FORMAT csv, HEADER true)"
```

If `psql` is unavailable, load the same four columns with any client that
honours CSV quoting; the header names must match exactly.

### 6.4 Verify the staging load before preflight

```sql
-- 97 rows, 97 distinct chapters, 21 distinct sections
SELECT COUNT(*) AS rows,
       COUNT(DISTINCT chapter_code) AS chapters,
       COUNT(DISTINCT section_code) AS sections
  FROM chapter_section_mapping_staging;

-- every live chapter is present exactly once
SELECT c.chapter_code
  FROM cet_chapter_notes c
  LEFT JOIN chapter_section_mapping_staging m USING (chapter_code)
 WHERE m.chapter_code IS NULL;

-- every staged section exists
SELECT m.section_code
  FROM chapter_section_mapping_staging m
  LEFT JOIN cet_section_notes s USING (section_code)
 WHERE s.section_code IS NULL;

-- no row missing its evidence
SELECT chapter_code
  FROM chapter_section_mapping_staging
 WHERE source_page IS NULL OR btrim(source_reference) = '';

-- Chapter 77 must be present, mapped to XV, and explicitly flagged
SELECT chapter_code, section_code
  FROM chapter_section_mapping_staging
 WHERE chapter_code = '77'
   AND (section_code <> 'XV' OR source_reference NOT LIKE '%REVIEWED DECISION%');
```

All four checks must return either the expected count or zero rows.

### 6.5 Preflight

`npm run db:migrate` (the global dry run) has a known ordering limitation on a
schema where the earlier migrations are still pending: the `0004` preflight
references `cet_chapter_notes.section_code`, and the `0007` preflight references
`cet_tariffs.chapter_code`. Those columns do not exist until `0002`/`0005` are
applied, so the global dry run stops with a column-not-found error even though
the migrations themselves are correct.

Use one of these instead:

- Run the individual preflight files that do not depend on pending columns:
  `0001`, `0002` (fails cleanly only if the column is wrong), `0003` (after
  staging), `0005`, `0006`, `0008`, `0009`, `0010`.
- Accept that `0004` and `0007` preflights are exercised by the apply runner
  immediately after their prerequisite migrations commit, inside the same
  ordered run.

A `--through <version>` / `--only <version>` option would remove this limitation
but is **not implemented** in this review; it is a proposed follow-up.

### 6.6 Apply on the branch

```bash
# PowerShell
$env:ALLOW_MIGRATE = "true"
npm run db:migrate -- --apply
```

The runner applies each pending migration in its own transaction:

1. run preflight; abort on any blocking row,
2. run forward SQL,
3. run postflight; roll back that migration on any anomaly,
4. record version and checksum in `cet_schema_migrations`.

If any step fails, the branch retains the last good state. Do not force it.

### 6.7 Verify the branch after apply

```sql
-- counts unchanged
SELECT 'cet_tariffs', COUNT(*) FROM cet_tariffs
UNION ALL SELECT 'cet_chapter_notes', COUNT(*) FROM cet_chapter_notes
UNION ALL SELECT 'cet_section_notes', COUNT(*) FROM cet_section_notes
UNION ALL SELECT 'cet_subheading_notes', COUNT(*) FROM cet_subheading_notes;

-- mapping complete and exact
SELECT COUNT(*) FILTER (WHERE section_code IS NULL) AS unmapped_chapters
  FROM cet_chapter_notes;

SELECT c.chapter_code, c.section_code, m.section_code AS expected
  FROM cet_chapter_notes c
  JOIN chapter_section_mapping_staging m USING (chapter_code)
 WHERE c.section_code IS DISTINCT FROM m.section_code;

-- tariff links complete
SELECT COUNT(*) FILTER (WHERE chapter_code IS NULL) AS unlinked_tariffs
  FROM cet_tariffs;

SELECT t.chapter_code, COUNT(*)
  FROM cet_tariffs t
 GROUP BY t.chapter_code
 ORDER BY t.chapter_code;

-- constraints validated
SELECT conname, convalidated
  FROM pg_constraint
 WHERE conname IN ('fk_chapter_section', 'fk_tariff_chapter', 'chk_subheading_note_owner');

-- expected indexes present
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN ('idx_chapter_section_code', 'idx_tariffs_chapter_code',
                     'idx_tariffs_description_fts', 'idx_tariffs_hs_code_normalized',
                     'idx_tariffs_schedule_type', 'idx_tariffs_description_trgm')
 ORDER BY indexname;
```

Re-run the baseline fingerprints from 6.2 and compare. The tariff fingerprint
and chapter fingerprint must be **identical**; only the new derived columns
change.

### 6.8 Rollback drill on the branch

Run in reverse order, verifying after each step:

```bash
$env:ALLOW_MIGRATE = "true"
npm run db:migrate -- --down 0010 --confirm-rollback
npm run db:migrate -- --down 0009 --confirm-rollback
npm run db:migrate -- --down 0008 --confirm-rollback
npm run db:migrate -- --down 0007 --confirm-rollback
npm run db:migrate -- --down 0006 --confirm-rollback
npm run db:migrate -- --down 0005 --confirm-rollback
npm run db:migrate -- --down 0004 --confirm-rollback
npm run db:migrate -- --down 0003 --confirm-rollback
npm run db:migrate -- --down 0002 --confirm-rollback
npm run db:migrate -- --down 0001 --confirm-rollback
```

Confirm counts and fingerprints are still the baseline. Then either delete the
branch or re-apply for a final rehearsal.

### 6.9 Search-plan comparison

Before/after `0009` (and optionally `0010`), capture:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, hs_code, description
  FROM cet_tariffs
 WHERE to_tsvector('simple', COALESCE(description, ''))
       @@ websearch_to_tsquery('simple', 'steel');

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, hs_code, description
  FROM cet_tariffs
 WHERE regexp_replace(hs_code, '[^0-9]', '', 'g') = '7208';
```

Attach the plans to the approval record.

---

## 7. Production gate (not executed)

Production remains untouched until all of the following are true:

- [ ] This mapping, including the Chapter 77 decision, is approved.
- [ ] `chapter_section_mapping.csv` is committed and its checksum recorded.
- [ ] The Neon branch run and the rollback drill both pass.
- [ ] Baseline counts and fingerprints match after the branch run.
- [ ] Query plans for 0009 (and the 0010 decision) are reviewed.
- [ ] A named approver and the target production branch are recorded.
- [ ] A restore point / PITR snapshot exists and the migration window is agreed.
- [ ] `--status`, `--apply`, and rollback commands are rehearsed on the branch
      with the same connection settings that production will use.

---

## 8. Findings and open decisions

1. **Chapter 77** is reserved, has no tariff lines, and is retained under
   Section XV. This is an explicit decision recorded in the CSV, not an
   inference; it needs owner approval.
2. **Source PDF not in the repository.** Page references come from the
   extraction already stored in `cet_chapter_notes`. If the owner requires
   page-by-page re-verification against the PDF, that must be done before
   production approval.
3. **Global dry-run limitation.** The preflights for 0004/0007 reference columns
   created by earlier pending migrations, so a single all-pending dry run on a
   fresh branch cannot complete. Apply-time preflights and branch execution are
   safe; a `--through` option is a proposed follow-up.
4. **0010 is optional.** `pg_trgm` is available but not installed. It also needs
   the `CREATE EXTENSION` privilege on the target database.
5. **0008 is optional.** It hardens an already-clean dataset.
6. **No `NOT NULL` is proposed** on either relationship column in this review.
   The specification requires owner confirmation first, including Chapter 77.
