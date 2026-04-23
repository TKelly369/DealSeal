# DealSeal Quickstart

## Install

```bash
npm install
```

## Configure env files

```bash
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
```

Minimum required:
- `apps/api/.env`: `DATABASE_URL`, `JWT_SECRET`
- `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`

## Seed demo data

```bash
npm run db:generate -w @dealseal/api
npm run db:push -w @dealseal/api
npm run db:seed -w @dealseal/api
```

## Run locally

Backend:

```bash
npm run dev -w @dealseal/api
```

Frontend:

```bash
npm run dev -w @dealseal/web
```

## Build

```bash
npm run build
```

## Open local demo

- App: `http://localhost:3000` (or `3001` if `3000` is occupied)
- API health: `http://localhost:4000/health`
- API demo payload: `http://localhost:4000/demo`
