# Implementation Report — Phases 1–6

Date: 2026-11-10
Scope: initial release, as defined by `01_CET_Project_Introduction...` and
`02_CET_Backend_Architecture...`.
Database state: **no migration applied, no existing table altered.** The four
project tables were not touched.

## Summary

| Phase | Status | Notes |
|---|---|---|
| 1 — Backend foundation | Complete | Env validation, pool, request IDs, logging, validation, error handling, envelope, security, graceful shutdown, health endpoints, unit tests |
| 2 — Tariff retrieval | Complete | By id and normalized HS code; duplicates returned, never auto-selected |
| 3 — Classification context | Complete with documented gaps | Chapter via validated HS derivation; section and verified FKs gated on M2 |
| 4 — Description search | Complete | Ranked FTS + partial fallback; index-backed once M2 is approved |
| 5 — Calculation foundation | Complete | Contracts + rate classifier; every amount step returns `unsupported` |
| 6 — Documentation and testing | Complete | OpenAPI generated from Zod validators, 108 tests, README, M2 proposal |

## Launch readiness — 2026-11-17

- Exposed Neon credential rotated in place (`ALTER ROLE neondb_owner`); the new
  connection string is stored only in git-ignored `backend/.env`.
- Environment verified: `DATABASE_SSL=true`, `DATABASE_SSL_VERIFY=true`,
  `ALLOW_MIGRATE=false`, `sslmode` stripped, `channel_binding=require` retained.
- Tests: **12 files / 108 tests passed**, including all 16 live-database tests
  against the production data.
- `npm run typecheck` and `npm run build` pass; `dist/server.js` is produced and
  imports `pg`.
- API smoke test: **14/14 checks passed** (health, readiness, search, exact HS
  duplicates, tariff details, chapter, section, notes, subheading notes,
  calculation contract, OpenAPI).
- Database unchanged: 5,966 / 97 / 21 / 76 rows; no `section_code`, no
  `chapter_code`, no `cet_schema_migrations`, only `plpgsql` installed; source
  fingerprints identical before and after.
- Local environment note: this workstation blocks outbound TCP 5432, so the live
  tests and smoke test were executed over Neon's HTTPS driver using a temporary
  test-only pool import; the committed source and final build use `pg`. The
  deployment host must allow outbound 5432.
- Deployment instructions: `docs/DEPLOYMENT.md`.

## Files created

### Configuration and shared infrastructure
- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- `.env.example`, `README.md`, `.gitignore` (repository root)
- `src/config/env.ts`, `constants.ts`, `database.ts`, `logger.ts`, `schema-capabilities.ts`
- `src/middleware/request-id.ts`, `request-logger.ts`, `validate-request.ts`, `not-found.ts`, `error-handler.ts`
- `src/shared/errors/app-error.ts`
- `src/shared/http/response.ts`, `pagination.ts`, `code-params.ts`
- `src/shared/sql/tariff-projection.ts`
- `src/shared/utils/hs-code.ts`, `codes.ts`
- `src/routes/index.ts`, `src/app.ts`, `src/server.ts`

### Modules
- `src/modules/health/` — `health.service.ts`, `health.routes.ts`
- `src/modules/tariffs/` — `tariff.types.ts`, `tariff.repository.ts`, `tariff.service.ts`, `tariff.schemas.ts`, `tariff.controller.ts`, `tariff.routes.ts`
- `src/modules/sections/` — `section.types.ts`, `section.repository.ts`, `section.service.ts`, `section.schemas.ts`, `section.controller.ts`, `section.routes.ts`
- `src/modules/chapters/` — `chapter.types.ts`, `chapter.repository.ts`, `chapter.service.ts`, `chapter.schemas.ts`, `chapter.controller.ts`, `chapter.routes.ts`
- `src/modules/notes/` — `note.types.ts`, `note.repository.ts`, `note.service.ts`, `note.schemas.ts`, `note.controller.ts`, `note.routes.ts`
- `src/modules/search/` — `search.repository.ts`, `search.service.ts`, `search.schemas.ts`, `search.controller.ts`, `search.routes.ts`
- `src/modules/calculations/` — `rate-parser.service.ts`, `rules-registry.ts`, `valuation.service.ts`, `duty.service.ts`, `tax.service.ts`, `calculation.service.ts`, `calculation.schemas.ts`, `calculation.controller.ts`, `calculation.routes.ts`

### Documentation, migrations and tooling
- `src/docs/openapi.ts`
- `scripts/migrate.ts` (guarded runner), `scripts/db-check.ts` (read-only inspection)
- `migrations/0001…0010` — 40 scripts (preflight/up/postflight/down)
- `migrations/data/chapter_section_mapping.template.csv`
- `migrations/data/chapter_section_mapping.csv` (97 reviewed rows, pending approval)
- `docs/migrations/M2-proposal.md`, `docs/migrations/database-readiness-review.md`, `docs/IMPLEMENTATION-REPORT.md`

## Endpoints delivered

| Method | Path | State |
|---|---|---|
| GET | `/health/live`, `/health/ready`, `/health` | Working |
| GET | `/api/v1/search` | Working (DB required) |
| GET | `/api/v1/tariffs/:id` | Working |
| GET | `/api/v1/tariffs/hs/:code` | Working, returns all duplicate matches |
| GET | `/api/v1/tariffs/:id/notes` | Working, 4 bounded queries |
| GET | `/api/v1/sections`, `/sections/:code` | Working; chapter membership gated on M2 |
| GET | `/api/v1/chapters`, `/chapters/:code`, `/chapters/:code/tariffs` | Working |
| GET | `/api/v1/subheading-notes` | Working with filters + ownership |
| POST | `/api/v1/calculations/import-cost` | Contract only; `unsupported`/`needs_review` |
| GET | `/api/v1/openapi.json`, `/api/v1/docs` | Working |

## Tests

```
Test Files  12 passed (12)
Tests       108 passed (108)
```

Passing without a database: HS-code normalization, rate classification
(including `SI`, compound, free, missing), pagination bounds, environment
validation (secrets never echoed), error envelope and validation details,
security headers, request-ID handling, oversized/malformed bodies, OpenAPI
shape, chapter/section code validation, calculation non-computation, migration
discovery and destructive-statement guards, search placeholder/bind invariants,
and central error-handler containment.

Live-database tests (16) cover baseline counts, exact retrieval fidelity,
duplicate-code ambiguity, cross-schedule duplicates, SI cross-reference, context
shape, pagination, ownership, search metadata, chapter-filtered search,
`schedule_type` filtering and the unsupported calculation state. They run when
`DATABASE_URL` is set and skip otherwise.

## Verification performed

- `npm run typecheck` — clean.
- `npm test` — 108 passed, 0 failed (live database configured).
- `npm run build` — emits `dist/` with `dist/server.js`.
- Compiled server smoke test: `/health/live` 200, `/health/ready` 503 without a
  database, `/api/v1/openapi.json` 200 (13 paths), unknown route 404,
  `/api/v1/tariffs/1` 503 with no credentials configured.

## Post-release fix — search returned HTTP 503

**Symptom:** `GET /api/v1/search?q=tea&pageSize=5` returned `503` with
`DATABASE_ERROR`; the live integration test `performs description search with
match metadata` failed.

**Root cause:** in `search.repository.ts`, a chapter placeholder (`$3`) was
always bound, but the chapter predicate was only emitted when `chapter_code` was
supplied. With no chapter filter, PostgreSQL received three bind values for a
statement that referenced two, and rejected it:

```
SQLSTATE 08P01
bind message supplies 3 parameters, but prepared statement "" requires 2
routine: exec_bind_message
```

No extension was involved: `to_tsvector` and `websearch_to_tsquery` are core
PostgreSQL, and `regexp_replace` is core as well. Zero installed extensions was
not the cause.

**Fix:**

- Replaced the hand-numbered SQL with an exported pure `buildSearchQuery()`
  that appends each optional filter and its placeholder together, so a value is
  bound only when its predicate is present.
- Added unit tests asserting placeholder/bind symmetry for the no-filter,
  chapter-only, schedule-only and all-filter cases.
- Added an optional `schedule_type` search filter and preserved the distinction
  between `MAIN_TARIFF` and `SENSITIVE_ITEMS` in retrieval, search metadata and
  calculation candidates.
- `extraction_phase` is typed and returned as an integer (matching the live
  column) instead of text.
- `/tariffs/:id/notes` now cross-references `SENSITIVE_ITEMS` rows when a
  `MAIN_TARIFF` rate is `SI`, returning `sensitiveItemsReference` plus a
  `SENSITIVE_ITEMS_ENTRY_NOT_FOUND` warning when no counterpart exists.
- TLS is configured explicitly (`DATABASE_SSL_VERIFY`, `DATABASE_SSL_CA_PATH`);
  `sslmode` is stripped so the pg v9 `require` semantics change cannot silently
  weaken verification.

## Database dependencies (not applied)

1. `cet_chapter_notes.section_code` + reviewed 97-row mapping + FK/index.
2. `cet_tariffs.chapter_code` + backfill + FK/index.
3. Subheading-note ownership `CHECK`.
4. `0009` — core search/schedule indexes (full-text, normalized HS code,
   `schedule_type`); no extension.
5. `0010` (optional) — `pg_trgm` extension + trigram index.
6. `cet_schema_migrations` bookkeeping table.

All are staged in `migrations/` with preflight, postflight and rollback scripts.
Full proposal: `docs/migrations/M2-proposal.md`. Per-migration review, mapping
and the Neon-branch runbook: `docs/migrations/database-readiness-review.md`.

## Behaviour without those migrations

- Chapter context is derived from the normalized HS code and marked
  `chapterSource: "derived_from_hs_code"`.
- Section context is `null` with `SECTION_MAPPING_NOT_VERIFIED`; `contextComplete`
  is `false`.
- `/chapters?section_code=` returns `422 UNSUPPORTED_OPERATION` explaining the
  pending mapping instead of returning an unfiltered list.
- Search is correct but not yet index-backed; it will use the proposed GIN
  indexes once applied.
- No response anywhere fabricates a section, rate, quantity or classification.

## Outstanding issues

1. **`pg_trgm` is available but not installed** on the live database (only
   `plpgsql` is installed). This is not a functional blocker — search is
   core-only — but optional migration 0010 needs the extension to be approved
   and the `CREATE EXTENSION` privilege on the target branch.
2. **CET 2022 PDF is not in the project.** The 97-row mapping was built from
   the chapter/section metadata already extracted into the live database, and
   every row carries a printed-page reference and a quoted section/chapter
   heading. Chapter 77 is explicitly recorded under Section XV as reserved.
   Re-verification against the PDF remains an owner approval step.
3. **Generated `hs_code_normalized` column** was intentionally not proposed yet —
   awaiting evidence. An expression index delivers the same performance.
4. **Swagger UI** is served from a devDependency-free package and works, but a
   production CSP policy for `/docs` should be reviewed before public exposure.
5. Express 5's async error propagation is relied upon; there is no
   `express-async-errors` shim (not needed on v5).

## Exact next step

1. Keep `backend/.env` (or `.env.local`) local and git-ignored; run
   `npm run db:check` to attach the live inspection to the M2 record.
2. `npm test` with `DATABASE_URL` set → 108 passing (16 live).
3. Review `docs/migrations/database-readiness-review.md` and the finalized
   `migrations/data/chapter_section_mapping.csv` (Chapter 77 flagged); approve
   or amend the mapping and the migration classification.
4. After approval: apply on a Neon branch with
   `ALLOW_MIGRATE=true npm run db:migrate -- --apply`, capture
   `EXPLAIN (ANALYZE, BUFFERS)` before/after for `/search` and exact-code
   lookup, then repeat on production. Apply 0010 only if `pg_trgm` is
   acceptable to the database owner.
