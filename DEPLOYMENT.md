# DealSeal Deployment (dealseal1.com)

This is the minimum path to first live deployment while preserving the current runtime shape.

Use these templates as your starting point:
- `apps/api/.env.production.example`
- `apps/web/.env.production.example`

## Recommended hosting shape

- **Web (`apps/web`)**: deploy as a Next.js app (Vercel, Netlify, or any Node host).
- **API (`apps/api`)**: deploy as a Node/Express service (Render, Railway, Fly.io, ECS, etc.).
- **Database**: managed Postgres (Supabase is already compatible).
- **Optional queue runtime**: run API worker process separately when Redis-backed jobs are needed.

## Vercel frontend setup (`app.dealseal1.com` / `dealseal1.com`)

1. In Vercel, create a new project from this repo.
2. Set **Root Directory** to `apps/web`.
3. Build command: `npm run build -w @dealseal/shared && npm run build -w @dealseal/web`
4. Install command: `npm install`
5. Output: default Next.js output.
6. Add env vars:
   - `NEXT_PUBLIC_API_URL=https://api.dealseal1.com`
   - `NEXT_PUBLIC_APP_URL=https://app.dealseal1.com`
   - Optional: `API_INTERNAL_URL` (private API URL for server-side fetches, e.g. in Docker) — if unset, server uses `NEXT_PUBLIC_API_URL`
7. Add domains in Vercel project:
   - `app.dealseal1.com`
   - `dealseal1.com` (optional apex to app)

## Railway backend setup (`api.dealseal1.com`)

1. In Railway, create a new service from this repo.
2. Service path / root: repo root (workspace-aware commands below).
3. Build command:
   - `npm install && npm run build -w @dealseal/shared && npm run build -w @dealseal/api`
4. Start command:
   - `npm run start -w @dealseal/api`
5. Add env vars:
   - Required: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`
   - Recommended: `APP_PUBLIC_URL`, `VERIFICATION_PUBLIC_BASE_URL` (public web origin; certified QR = `{base}/verify/{governingRecordId}`. If unset, falls back to `APP_PUBLIC_URL` — set both to the **same** user-facing app URL as the Next app, e.g. `https://app.dealseal1.com`)
   - `REDIS_URL`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX`
   - Optional integrations: `S3_*`, `STRIPE_*`
   - Optional: `API_INTERNAL_URL` (other services calling the API internally; Next.js may use the web env name for server fetches)
6. Expose custom domain:
   - `api.dealseal1.com`

## 1) Required environment variables

### API (`apps/api`)
- `NODE_ENV=production`
- `PORT` (e.g. `4000`)
- `DATABASE_URL` (Supabase/Postgres connection string)
- `JWT_SECRET` (16+ chars)
- `CORS_ORIGIN=https://app.dealseal1.com,https://dealseal1.com`

Optional but recommended:
- `REDIS_URL` (required for workers/queues)
- `APP_PUBLIC_URL=https://app.dealseal1.com`
- `VERIFICATION_PUBLIC_BASE_URL=https://app.dealseal1.com` (match the deployed Next.js origin; QR and verification page links)
- `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, optional `S3_ENDPOINT`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CHECKOUT_PRICE_ID`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX`

### Web (`apps/web`)
- `NEXT_PUBLIC_API_URL=https://api.dealseal1.com`
- `NEXT_PUBLIC_APP_URL=https://app.dealseal1.com`
- Optional: `API_INTERNAL_URL` (server components / route handlers calling the API on a private URL)

## 2) Build and start commands

From repo root:

```bash
npm install
npm run build
```

Start API:

```bash
npm run start -w @dealseal/api
```

Start web:

```bash
npm run start -w @dealseal/web
```

Optional worker (if using queues):

```bash
npm run worker -w @dealseal/api
```

## 3) Database / Prisma steps

**Production / CI:** apply tracked migrations (preferred):

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
```

**Local dev** (or greenfield with no existing data): you may use push instead of migrate:

```bash
npm run db:generate -w @dealseal/api
npm run db:push -w @dealseal/api
```

**Deal-Scan backfill** (create governing records for locked deals that predate the feature, if needed):

```bash
npm run backfill:governing-records
```

For demo data (optional in prod, useful in staging):

```bash
npm run db:seed -w @dealseal/api
```

## 4) Domain notes for dealseal1.com

- App domain: `https://app.dealseal1.com`
- API domain: `https://api.dealseal1.com`
- Configure API CORS with both app + apex site:
  - `CORS_ORIGIN=https://app.dealseal1.com,https://dealseal1.com`
- Stripe webhook URL (if enabled):
  - `https://api.dealseal1.com/billing/webhook`

## 5) Namecheap DNS records (exact)

Create these records in Namecheap Advanced DNS:

1. **Root frontend**
   - Type: `A`
   - Host: `@`
   - Value: (use the IP Vercel gives for apex, currently `76.76.21.21`)
   - What it does: points `dealseal1.com` to your frontend host.

2. **App subdomain frontend**
   - Type: `CNAME`
   - Host: `app`
   - Value: `cname.vercel-dns.com`
   - What it does: points `app.dealseal1.com` to Vercel-managed frontend routing.

3. **API subdomain backend**
   - Type: `CNAME`
   - Host: `api`
   - Value: your Railway provided target (example: `your-service.up.railway.app`)
   - What it does: points `api.dealseal1.com` to your Railway API service.

## 6) Post-deploy smoke checks

- `GET https://api.dealseal1.com/health`
- `GET https://api.dealseal1.com/api/health` (same liveness; path alias for API-prefix routing)
- `GET https://api.dealseal1.com/ready`
- `GET https://api.dealseal1.com/demo` (if demo data exists)
- Open `https://app.dealseal1.com` and confirm investor landing renders.

Recommended browser/API checks:
- `https://dealseal1.com` loads frontend (or redirects to `app.` if you choose that)
- frontend network requests go to `https://api.dealseal1.com`
- login/register/dashboard flows still work

**Deal-Scan / verification QR (smoke):** set `VERIFICATION_PUBLIC_BASE_URL` on the API to the public web app origin, generate a certified render, confirm the PDF QR decodes to `https://app.dealseal1.com/verify/{governingRecordId}` (or your `NEXT_PUBLIC_APP_URL` host), and open that page; JSON details remain at `GET https://api.dealseal1.com/api/verify/{id}`.
