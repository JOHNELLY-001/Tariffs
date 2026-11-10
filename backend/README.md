# CET Tariff Information & Import Cost System — Backend

TypeScript + Express 5 modular-monolith REST API over the East African Community
Common External Tariff dataset (CET 2022, updated June 2025), backed by Neon
PostgreSQL.

The service is a **tariff information and classification-context tool**. It is
not a customs authority decision and not a substitute for an official
classification ruling.

## What it does

- Exact tariff retrieval by database id and by normalized HS code.
- Chapter, section and subheading-note context for a tariff line.
- Bounded description/keyword search with explicit match metadata.
- Section, chapter and note browsing.
- An import-cost **contract** that reports `unsupported`/`needs_review` instead
  of inventing duty, levy or VAT amounts.

## What it deliberately does not do

- No AI, embeddings, vector store or LLM calls.
- No duty/VAT/levy/valuation formula.
- No data editing through the API.
- No silent resolution of duplicate HS codes, `SI` rates, or missing values.

## Requirements

- Node.js 22 or newer (developed on 24).
- npm.
- A Neon PostgreSQL database containing the four CET tables.

## Setup

```bash
cd backend
npm install
cp .env.example .env.local     # PowerShell: Copy-Item .env.example .env.local
# edit .env.local and set DATABASE_URL (never commit this file)
npm run dev
```

The process fails fast if configuration is invalid. `.env.local` is git-ignored;
only `.env.example` is committed.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string. Required in production; the API returns `503` until it is set. |
| `DATABASE_SSL` | TLS for the database connection (default `true`). |
| `DATABASE_POOL_MAX`, `DATABASE_CONNECTION_TIMEOUT_MS`, `DATABASE_IDLE_TIMEOUT_MS`, `DATABASE_STATEMENT_TIMEOUT_MS` | Pool and statement limits. |
| `DATABASE_URL_READONLY` | Read-only connection used only by inspection scripts. |
| `API_BASE_PATH` | Versioned base path (default `/api/v1`). |
| `LOG_LEVEL` | Pino level; `silent` disables logging. |
| `BODY_LIMIT` | Maximum JSON body size. |
| `REQUEST_TIMEOUT_MS`, `SHUTDOWN_TIMEOUT_MS` | HTTP request bound and graceful-shutdown budget. |
| `CORS_ORIGINS` | Comma-separated origins or `*`. |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | Rate limiting. |
| `ALLOW_MIGRATE` | Second switch for data-changing migration commands. |

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Watch-mode development server. |
| `npm run build` | Compile to `dist/`. |
| `npm start` | Run the compiled server. |
| `npm run typecheck` | Type-check without emitting. |
| `npm test` | Unit + API tests (integration tests run when `DATABASE_URL` is set). |
| `npm run db:check` | Read-only live schema, constraint, index and row-count inspection. |
| `npm run db:migrate -- --status` | Show pending/applied migrations and checksum status. |
| `npm run db:migrate` | Dry run: preflight queries only, in a read-only transaction. |
| `ALLOW_MIGRATE=true npm run db:migrate -- --apply` | Apply reviewed migrations. |

## API

Base path: `/api/v1` (interactive reference at `/api/v1/docs`, raw contract at
`/api/v1/openapi.json`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/live` | Liveness; never touches the database. |
| GET | `/health/ready` | Readiness; verifies database connectivity. |
| GET | `/search?q=&chapter_code=` | Ranked search with `matchType` and `relevance`. |
| GET | `/tariffs/:id` | Tariff line by database id. |
| GET | `/tariffs/hs/:code` | Exact HS-code lookup; all duplicates returned. |
| GET | `/tariffs/:id/notes` | Chapter, section and subheading-note context. |
| GET | `/sections` | Paginated sections. |
| GET | `/sections/:code` | Section detail; `chapters` is `null` until mapping is verified. |
| GET | `/chapters?section_code=` | Paginated chapters. |
| GET | `/chapters/:code` | Chapter detail with notes and section summary. |
| GET | `/chapters/:code/tariffs` | Paginated tariff lines in a chapter. |
| GET | `/subheading-notes` | Filter by `chapter_code`, `section_code`, `reference`. |
| POST | `/calculations/import-cost` | Calculation contract; `unsupported`/`needs_review` only. |

### Response envelope

```json
{ "success": true, "data": {}, "meta": { "requestId": "..." } }
```

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }, "meta": { "requestId": "..." } }
```

Statuses used: 200, 400, 404, 413 (body limit), 422, 429, 500, 503 (database
unavailable). Internal errors never expose SQL, stack traces or credentials.

### Interpretation rules enforced by the API

- A search hit or code match is a **candidate tariff line**, not a legal
  classification.
- `rate` is returned verbatim. `rateAnalysis` is a **derived** classification
  (`percentage`, `specific`, `compound`, `sensitive_item`, `free`, `unknown`).
- `SI` is Sensitive Items treatment; it is never parsed as a number.
- Duplicate HS codes return every match with `meta.ambiguous: true`; none is
  selected automatically.
- Missing rates, quantities and notes stay `null` and are reported in
  `warnings`.
- Relationships that depend on unapplied migrations are reported as
  incomplete (`contextComplete: false`), never guessed.

## Database and migrations

The four tables (`cet_tariffs`, `cet_section_notes`, `cet_chapter_notes`,
`cet_subheading_notes`) hold existing project data. The backend never drops,
truncates, recreates or bulk-overwrites them.

Migration files live in `migrations/` as `.preflight.sql`, `.up.sql`,
`.postflight.sql` and `.down.sql` triplets. The runner:

1. Refuses to apply anything unless `ALLOW_MIGRATE=true` **and** `--apply`.
2. Runs the preflight in a read-only transaction; any returned row aborts.
3. Applies the forward SQL in a transaction.
4. Runs the postflight anomaly check; any returned row rolls the migration back.
5. Records version + SHA-256 checksum in `cet_schema_migrations`.
6. Statically rejects `TRUNCATE`, `DELETE FROM`, `DROP TABLE` and
   `DROP COLUMN` on protected tables in forward scripts.

The proposal and its approval gates are documented in
[`docs/migrations/M2-proposal.md`](docs/migrations/M2-proposal.md). No migration
has been applied to any database.

## Project layout

```
src/
  app.ts, server.ts
  config/        env, database pool, logger, constants, schema capability probe
  routes/        versioned API assembly
  middleware/    request id, logging, validation, 404, error handling
  modules/       search, tariffs, sections, chapters, notes, calculations, health
  shared/        errors, http envelope/pagination, SQL projections, HS-code utils
  docs/          OpenAPI document
migrations/      preflight/up/postflight/down scripts + mapping template
scripts/         guarded migration runner, read-only schema inspection
tests/           unit, API and (conditional) live-database integration tests
```

## Testing

```bash
npm test
```

78 tests run without a database (unit + API). Eleven integration tests cover the
live dataset and are skipped unless `DATABASE_URL` is set. Point that at a Neon
branch or a dedicated test database — never production.

## Deployment notes

- Run behind TLS; set `CORS_ORIGINS` explicitly in production.
- Provide `DATABASE_URL` via the platform secret store, not a committed file.
- Use the Neon pooled endpoint and keep the pool conservative per instance.
- Readiness (`/health/ready`) returns `503` when the database is unreachable —
  wire it to your orchestrator's readiness gate.
- Migrations must be reviewed and applied deliberately, never on boot.
