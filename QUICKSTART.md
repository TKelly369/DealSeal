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

## Next.js workspace seed (dealer / lender / admin logins)

The marketing site links to `/dealer/dashboard`, `/lender/dashboard`, and `/admin`. Those routes use the Next.js Prisma schema and the scaffold accounts on `/login`. After `DATABASE_URL` points at the same database the web app uses, run:

```bash
npm run seed:web-billing
```

This creates `workspace-main`, `ws-lender-demo`, users such as `dealer.admin@dealseal1.com` / `dealseal123`, and demo deals so post-login flows (including session identity) do not fail on missing database rows.

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
