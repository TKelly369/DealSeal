# DealSeal™

Production-oriented SaaS for **transaction authority**, full deal lifecycle, documents, execution/lock, packages, post-funding, **billing**, integrations, and analytics. **Node.js 20+** monorepo (`apps/api` Express + Prisma, `apps/web` Next.js 15, `packages/shared`).

## Quickstart (Investor Demo)

1. **Setup environment**:
   ```bash
   copy .env.example apps\api\.env
   copy apps\web\.env.example apps\web\.env.local
   # Edit .env files with DATABASE_URL, JWT_SECRET, etc.
   ```

2. **Install and seed**:
   ```bash
   npm install
   cd apps/api
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   cd ..
   ```

3. **Run demo**:
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:3002 (or 3000)
   - Backend: http://localhost:4000/health

## Local run (required)

1. **PostgreSQL 14+** and **Redis 7+** (optional but needed for workers/BullMQ).

2. **Environment file for the API** (copy and edit):

   ```bash
   copy .env.example apps\api\.env
   # or: cp .env.example apps/api/.env
   ```

   Set at minimum: `DATABASE_URL`, `JWT_SECRET` (16+ characters), and optionally `REDIS_URL`.

3. **Web** public API URL (copy):

   ```bash
   copy apps\web\.env.example apps\web\.env.local
   ```

   Set `NEXT_PUBLIC_API_URL=http://localhost:4000` (or your API URL). For **dealseal1.com** deployment use `https://api.dealseal1.com`.

4. **Install and sync schema**:

   ```bash
   npm install
   cd apps/api
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   cd ../..
   ```

5. **Start everything** (API + web):

   ```bash
   npm run dev
   ```

   - **App:** [http://localhost:3000](http://localhost:3000) — investor demo landing (or `3001` if `3000` is in use).
   - **Dashboard:** `/dashboard` (auth required).
   - **API:** [http://localhost:4000/health](http://localhost:4000/health)
   - **API demo payload:** [http://localhost:4000/demo](http://localhost:4000/demo)

6. **Production-style run** (after `npm run build`):

   ```bash
   npm start
   ```

7. **Worker** (queues — requires Redis): `npm run worker`

## Seed / demo logins

After `npx prisma db seed` (from `apps/api` or `npm run db:seed` from root):

| User | Password | Role |
|------|----------|------|
| `admin@demo.dealseal` | `Auditor-demo-1!` | ADMIN (demo org) |
| `dealer@demo.dealseal` | `Auditor-demo-1!` | DEALER_USER |
| `auditor@demo.dealseal` | `Auditor-demo-1!` | AUDITOR (read-only) |
| `compliance@demo.dealseal` | `Auditor-demo-1!` | COMPLIANCE_OFFICER |

Org slug: **`demo-dealer`**. Seed also prints **transaction UUIDs** and a **partner API key** in the console.

**Register a new org** at `/register` (creates `JWT` session; no email verification in dev).

## Auth (implemented)

- **API:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (Bearer JWT), `POST /auth/logout` (auditable; client clears `localStorage` `dealseal_token`).
- **Web:** `/login`, `/register`, `SessionGate` client guard, logout in sidebar.

> **Not NextAuth** — session is **JWT in `localStorage`**; `NEXTAUTH_URL` / `NEXTAUTH_SECRET` in `.env.example` are reserved if you add Next.js Auth later.

## Production Deployment

### Frontend (Vercel)
1. Deploy `apps/web` to Vercel
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL=https://your-railway-api-url.up.railway.app`
   - `NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app`

### Backend (Railway)
1. Deploy `apps/api` to Railway
2. Set environment variables (copy from `.env.example`):
   - `DATABASE_URL=postgresql://...` (Railway Postgres)
   - `REDIS_URL=redis://...` (Railway Redis, optional)
   - `JWT_SECRET=...` (strong secret)
   - `CORS_ORIGIN=https://your-vercel-app.vercel.app`
   - `APP_PUBLIC_URL=https://your-vercel-app.vercel.app`
   - Other secrets as needed

### Domain Setup
- Point `dealseal1.com` to Vercel frontend
- Set `CORS_ORIGIN=https://dealseal1.com,https://app.dealseal1.com` on backend

## Local run (required)

| Variable | Where | Purpose |
|----------|--------|--------|
| `DATABASE_URL` | API | PostgreSQL |
| `JWT_SECRET` | API | HMAC for JWT |
| `REDIS_URL` | API | Queues, `/ready` |
| `CORS_ORIGIN` | API | Comma list for browser origins |
| `S3_*` or AWS-equivalent | API | Object storage (see `docs/ARCHITECTURE.md`) |
| `STRIPE_*` | API | Billing |
| `NEXT_PUBLIC_API_URL` | Web | API base (browser) |
| `NEXT_PUBLIC_APP_URL` | Web | Public app URL (optional) |

## Docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — routes, boundaries, workers.

## Remaining gaps (optional)

- **Stripe** metered sync from internal `UsageEvent` to Stripe usage records (if you use Stripe Usage Billing).
- **Email** verification and password reset flows.
- **NextAuth** or **httpOnly cookies** for stricter session handling than `localStorage` JWT.
