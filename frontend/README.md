# CET Tanzania Frontend

Vue 3 + TypeScript + Vite application for the CET Tanzania Import Cost
Calculator. The dashboard shell, tariff explorer, import-cost calculator,
calculation results dashboard and calculation history are implemented.

## Screens

| Route                                | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `/dashboard`                         | Workspace overview                                         |
| `/tariffs`                           | Tariff Explorer search, detail drawer and context         |
| `/tariffs?intent=calculator&q=<code>`| Explorer in selection mode; returns a chosen tariff record |
| `/calculator`                        | Import-cost form with tariff resolution and review step    |
| `/calculator/result/:calculationId`  | Calculation results dashboard for one backend calculation  |
| `/history`                          | Client-side index of calculations created in this browser |

The calculator keeps its draft and explicitly selected tariff in
`sessionStorage`, so a detour through the Tariff Explorer never discards form
entries. Multiple tariff records for one HS code are always listed in full and
must be chosen explicitly.

## Requirements

- Node.js 22 or newer
- The backend running locally on port 3000 (see `../backend/README.md`)

## Local setup

```powershell
# Terminal 1 — backend
cd ../backend
npm install
npm run dev

# Terminal 2 — frontend
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open <http://localhost:5173>.

## Environment

| Variable            | Purpose                                        | Local default                 |
| ------------------- | ---------------------------------------------- | ----------------------------- |
| `VITE_API_BASE_URL` | Base URL of the versioned backend API          | `http://localhost:3000/api/v1` |

Never hardcode a production URL. Set `VITE_API_BASE_URL` at build time for each
deployment environment. `.env.local` is ignored by Git; only `.env.example` is
committed.

## Scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the Vite development server            |
| `npm run typecheck` | Run `vue-tsc` without emitting output        |
| `npm run build`     | Type-check and create the production bundle  |
| `npm run preview`   | Serve the production bundle locally          |

## Boundaries

- All monetary, valuation and tax calculations are performed by the backend.
- No Tanzanian tax rate or duty formula is implemented in this application.
- The interface must show unresolved status and null totals exactly as returned
  by the API; it must not estimate a substitute value.
