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
| 6 — Documentation and testing | Complete | OpenAPI generated from Zod validators, 78 tests, README, M2 proposal |

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
- `migrations/0001…0009` — 36 scripts (preflight/up/postflight/down)
- `migrations/data/chapter_section_mapping.template.csv`
- `docs/migrations/M2-proposal.md`, `docs/IMPLEMENTATION-REPORT.md`

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
Test Files  9 passed | 1 skipped (10)
Tests       78 passed | 11 skipped (89)
```

Passing without a database: HS-code normalization, rate classification
(including `SI`, compound, free, missing), pagination bounds, environment
validation (secrets never echoed), error envelope and validation details,
security headers, request-ID handling, oversized/malformed bodies, OpenAPI
shape, chapter/section code validation, calculation non-computation, migration
discovery and destructive-statement guards.

Skipped until `DATABASE_URL` is set: 11 live-database tests covering baseline
counts, exact retrieval fidelity, duplicate-code ambiguity, context shape,
pagination, ownership, search metadata and the unsupported calculation state.

## Verification performed

- `npm run typecheck` — clean.
- `npm test` — 78 passed, 11 skipped, 0 failed.
- `npm run build` — emits `dist/` with `dist/server.js`.
- Compiled server smoke test: `/health/live` 200, `/health/ready` 503 without a
  database, `/api/v1/openapi.json` 200 (13 paths), unknown route 404,
  `/api/v1/tariffs/1` 503 with no credentials configured.

## Database dependencies (not applied)

1. `cet_chapter_notes.section_code` + reviewed 97-row mapping + FK/index.
2. `cet_tariffs.chapter_code` + backfill + FK/index.
3. Subheading-note ownership `CHECK`.
4. Search indexes (`pg_trgm`, GIN FTS, trigram, normalized HS-code expression).
5. `cet_schema_migrations` bookkeeping table.

All are staged in `migrations/` with preflight, postflight and rollback scripts.
Full proposal: `docs/migrations/M2-proposal.md`.

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

1. **No credentials were provided**, so live schema, row counts, HS-code
   duplicates, rate-string forms and code formats remain unverified. These block
   M2 approval, not the implementation.
2. **CET 2022 PDF is not in the project.** The authoritative 97-row
   chapter→section mapping (with source pages) cannot be produced without it;
   Chapter 77 needs an explicit decision.
3. **Generated `hs_code_normalized` column** was intentionally not proposed yet —
   awaiting evidence. An expression index delivers the same performance.
4. **Swagger UI** is served from a devDependency-free package and works, but a
   production CSP policy for `/docs` should be reviewed before public exposure.
5. Express 5's async error propagation is relied upon; there is no
   `express-async-errors` shim (not needed on v5).

## Exact next step

1. Add `backend/.env.local` with `DATABASE_URL` (read-only role is sufficient for
   inspection) and run `npm run db:check` → attach the output to the M2 record.
2. Set `DATABASE_URL` and run `npm test` to enable the 11 integration tests.
3. Review `docs/migrations/M2-proposal.md`; supply the 97-row mapping CSV from
   the CET PDF (Chapter 77 flagged) and approve or amend the proposal.
4. After approval: apply on a Neon branch with
   `ALLOW_MIGRATE=true npm run db:migrate -- --apply`, capture
   `EXPLAIN (ANALYZE, BUFFERS)` before/after for `/search` and exact-code
   lookup, then repeat on production.
