# Deployment Guide — CET Tariff Backend MVP

**Scope:** deploy the existing read-only API. This guide does **not** apply
database migrations and does not change the production Neon schema.

## 1. Preconditions

- Node.js 22 or newer (tested on Node 24).
- A Neon PostgreSQL database with the four CET tables already loaded.
- The rotated `DATABASE_URL` from `backend/.env` (never commit it).
- A host that allows outbound PostgreSQL TCP 5432 (Render, Railway, Fly.io,
  Heroku, or a normal VM). Do not use a platform that blocks outbound 5432 or
  only supports short-lived serverless functions.

## 2. Build and run locally

```bash
cd backend
npm ci
npm run typecheck
npm run build
npm start
```

The last command runs `node dist/server.js`. The server binds to `0.0.0.0` on
`PORT` (default `3000`).

Do **not** run `npm run db:migrate` in production. `ALLOW_MIGRATE` must remain
`false`.

## 3. Required environment

Set these in the hosting provider's secret/environment panel:

```text
NODE_ENV=production
PORT=<provided by the host; Render sets this automatically>
DATABASE_URL=<rotated Neon pooled connection string>
DATABASE_SSL=true
DATABASE_SSL_VERIFY=true
ALLOW_MIGRATE=false
LOG_LEVEL=info
API_BASE_PATH=/api/v1
CORS_ORIGINS=<your frontend origin, or * for a public read-only launch>
```

Optional only when the host cannot verify Neon's public certificate chain:

```text
DATABASE_SSL_CA_PATH=/path/to/neon-root.pem
```

Do not set `DATABASE_SSL_VERIFY=false` unless the database owner accepts the
risk. `sslmode` in the URL is stripped by the app; the explicit TLS settings
above are authoritative.

## 4. Render example (persistent Node process)

1. Create a **Web Service** from the repository.
2. Root directory: `backend`.
3. Runtime: Node 22+ (Node 24 is fine).
4. Build command: `npm ci && npm run build`.
5. Start command: `npm start`.
6. Health check path: `/health/ready`.
7. Add the environment variables from section 3. Put `DATABASE_URL` in the
   secret field, not in the repository.
8. Deploy. Do not add a release/pre-deploy command that runs migrations.

Railway/Fly/Heroku use the same build/start commands and the same environment
variables. On Fly, expose the internal port via `PORT` and set the health check
to `/health/ready`.

## 5. Post-deploy verification

Replace `BASE` with the public HTTPS origin.

```bash
curl -fsS "$BASE/health/live"
curl -fsS "$BASE/health/ready"
curl -fsS "$BASE/api/v1/search?q=steel&pageSize=5"
curl -fsS "$BASE/api/v1/tariffs/hs/04011000"
curl -fsS "$BASE/api/v1/tariffs/1"
curl -fsS "$BASE/api/v1/chapters/72"
curl -fsS "$BASE/api/v1/sections/XV"
curl -fsS "$BASE/api/v1/tariffs/1/notes"
curl -fsS "$BASE/api/v1/subheading-notes?chapter_code=72&pageSize=5"
curl -fsS -X POST "$BASE/api/v1/calculations/import-cost" \
  -H 'content-type: application/json' \
  -d '{"hsCode":"01012100","customsValue":1000,"currency":"KES"}'
```

Expected:

- `/health/ready` returns `200` with `checks.database.connected: true`.
- Exact HS `04011000` returns two matches, one `MAIN_TARIFF` and one
  `SENSITIVE_ITEMS`, with `meta.ambiguous: true`.
- `/sections/XV` returns the section but `chapters: null` and
  `contextComplete: false` (the section mapping is intentionally not applied).
- The calculation endpoint returns `unsupported` or `needs_review`, with
  `totals: null` and no invented amounts.

## 6. Rollback

Redeploy the previous build. No database migration was applied, so there is no
schema rollback to perform. Do not run `db:migrate --down`; the tracking table
does not exist.

## 7. Known deployment limitations

- Chapter-to-section membership is not deployed. Section and chapter records are
  readable, but section context for a tariff is `null` and
  `/chapters?section_code=` returns `422`.
- Search indexes (0009/0010) are not applied. Search is correct but scans the
  5,966-row table.
- Import-cost calculations are a contract only: `unsupported`/`needs_review`.
- Swagger UI at `/api/v1/docs` may need a CSP exception in production because
  Helmet's default CSP applies when `NODE_ENV=production`.
- The API is read-only and unauthenticated. Add authentication/rate-limit
  tuning before exposing sensitive infrastructure.
