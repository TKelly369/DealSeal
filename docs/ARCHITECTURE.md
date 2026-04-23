# DealSeal™ — System Architecture

## Logical architecture

- **Presentation:** Next.js (App Router), role-gated UI shells, dark-first theme, responsive layout.
- **API tier:** Node.js + TypeScript, Express, modular routers per domain, Zod validation, JWT auth.
- **Domain services:** transaction authority, state machine, rules/compliance evaluation hooks, document versioning, discrepancy and override workflows, completion protocol, package jobs, billing/pricing engine, audit append-only writer, hold enforcement.
- **Data:** PostgreSQL + Prisma; strict relational integrity; one `GoverningAgreement` per `Transaction` (`transactionId` unique).
- **Objects:** S3-compatible storage (MinIO in Docker) for immutable document blobs; `DocumentVersion` stores content hash and storage key — no overwrite of sealed blobs.
- **Async:** Redis + BullMQ dependency present for workers (package generation, OCR pipeline); queue processors are a deploy-time extension.
- **Observability:** `AuditEvent` for security-sensitive actions; `StateTransitionLog` for lifecycle; `UsageEvent` for monetization.

## Deployment topology

- `docker-compose.yml` provisions Postgres, MinIO, Redis, `api`, `web`.
- Scale API horizontally behind a load balancer; use managed Postgres and object storage in production.
- Run `prisma migrate deploy` before API start in CI/CD.

## Local bootstrap

1. Install Node 20+ and npm at the machine level (PATH), then from repo root: `npm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`, `JWT_SECRET` (≥16 chars), optional Stripe keys.
3. Start Postgres (or `docker compose up postgres -d`), then: `cd apps/api && npx prisma migrate dev` (or `npx prisma db push` for a throwaway DB). New enum values and `Lender*` / completion columns require a fresh migration from the current `schema.prisma` — do **not** assume an old DB matches without migrating.
4. Set `REDIS_URL` (e.g. `redis://localhost:6379`) for BullMQ package workers and async document validation.
5. Dev API + web: `npm run dev` from repo root (API `:4000`, web `:3000`). Workers: `npm run worker` (separate process).
6. Set `NEXT_PUBLIC_API_URL` for the web app if the API is not on localhost:4000.

## State machine (enforcement)

States align with `TransactionState` in Prisma, including “traffic light” names (**`RED`**, **`YELLOW`**, **`GREEN_STAGE_1`**, **`GREEN_STAGE_2`**, **`EXECUTED_PENDING_VERIFICATION`**) plus legacy values (**`APPROVED`**, **`EXECUTED`**, **`CONDITIONAL`**, **`INVALID`**, etc.) for backward compatibility. The canonical allow-list lives in **`state-transition-config.ts`**; **`state-engine.ts:transitionTransaction`** enforces it, `StateTransitionLog` is append-only, and **`assertNoActiveHold` / `state-guards.ts`** apply org/tx holds, governing-agreement requirements, open discrepancies, and **open blocker `CompletionTask`** rows before **`LOCKED`**. **`transaction-material-state.ts`** can demote **`GREEN_STAGE_1` / `APPROVED` → `YELLOW`**, then **`YELLOW` / `CONDITIONAL` → `DRAFT`**, on material data edits. **`onDealStateSettled` / `state-hooks.ts`** after **`LOCKED`**: completion rebuild + `DEAL_SEALED` usage. Same transition shape is available as **`POST /state/transactions/:id/transition`** and **`POST /transactions/:id/state/transition`**.

## Lender orchestration (programs + evaluation)

- Catalog: `Lender`, `LenderProgram`, `LenderProgramRule` (links to `Rule` rows with JSON `conditionExpression`), `LenderDocumentRequirement`.
- Runtime: **`lender-evaluation-service.ts`** builds a `runId`, persists **`LenderRuleEvaluation`** (pass/fail/warn + `isOverrideable`), and sets `Transaction.selectedLenderProgramId`.
- APIs: `GET/POST /transactions/:id/lender-evaluation*`, `PATCH /transactions/:id/selected-lender-program`; admin lists in **`/admin/lenders`**, **`/admin/lender-programs`**, **`PATCH /admin/lender-programs/:id`**.

## Completion protocol (deterministic)

- **`rebuildCompletionProtocol`** (and legacy **`materializeCompletionTasks`**) assembles `CompletionTask` rows from state, discrepancies, post-funding, lender run output, and document gaps; full rebuild is lexicographic by key. Blockers are honored by **`getTransitionBlockReason`** for **`LOCKED`**.
- APIs: `GET/POST /transactions/:id/completion-protocol*`, **`PATCH /completion-tasks/:id`**.

## Internal billing (usage + drafts)

- **`recordUsage` / `pricing-engine.ts`**: resolves unit price from `PricingRule` (org) or `DEFAULT_PRICE_BOOK` (`@dealseal/shared`).
- Triggers: **`LOCKED`** (seal), **package** creation, **`POST /analytics/report-export`**, plan changes via **`POST /billing/tenant-plan`** (also **`UsageEvent`**: `SUBSCRIPTION_PLAN_ASSIGNED`), etc.
- **`generateInvoiceDraftForPeriod`**: drafts **`Invoice` + `InvoiceLine`** from MTD `UsageEvent`.
- APIs: `GET /billing/usage|events|plans|invoices`, `POST /billing/tenant-plan`, `POST /billing/invoices/draft` (and existing preview/portal).

## Security

- RBAC via JWT claims + `requireRoles`.
- Holds supersede progression (`assertNoActiveHold`).
- Admin actions audited; overrides require justification + decision trail.

## Module → implementation map

| Module | Code location |
|--------|----------------|
| Transaction Authority Engine | `routes/transactions.ts`, `GoverningAgreement`, `TransactionAuthorityFile` |
| Buyer / Vehicle / Financials | `PATCH /transactions/:id/{buyer,vehicle,financials}`, append-only `*Version` tables, `transaction-patch-service.ts` |
| Lender Rule Engine | `routes/rules.ts`, `Rule`, `RuleEvaluation` |
| Compliance Validation | discrepancy + rule evaluation hooks |
| Document Authority | `routes/documents.ts`, `Document`, `DocumentVersion`, `DocumentUploadIntent`, presigned S3 flow, `document-upload-service.ts` |
| State Machine Controller | `services/state-engine.ts`, `routes/state.ts`, `routes/approvals.ts` |
| Discrepancy Detection | `Discrepancy`, rule FAIL path |
| Override Management | `routes/overrides.ts`, `OverrideRecord` |
| Completion Protocol | `services/completion-protocol.ts` |
| Package Generation | `routes/packages.ts`, `PackageJob`, `GeneratedPackage` (`generated_packages`), BullMQ `workers/package.worker.ts` |
| Post-Funding | `PostFundingItem` |
| Hold / Dispute | `routes/admin.ts`, `Hold`, `services/hold-service.ts` |
| Retention / Purge | `RetentionPolicy`, `PurgeJob` (workflow stubs) |
| Admin Control | `routes/admin.ts` |
| Analytics | `routes/analytics.ts` |
| Audit timeline (read) | `routes/audit.ts`, `audit-query-service.ts` (merged timeline), `audit-read-service.ts` (detail + search + normalized entries) |
| Monetization / Billing | `services/pricing-engine.ts`, `routes/billing.ts`, `UsageEvent`, Stripe webhook |

## REST API surface

Base URL: `/` on API host (default `:4000`).

### Auth — `/auth`

| Method | Path | Description |
|--------|------|----------------|
| POST | `/auth/register` | Create org, admin user, starter subscription |
| POST | `/auth/login` | JWT issuance |

### Transactions — `/transactions`

| Method | Path | Description |
|--------|------|----------------|
| GET | `/transactions` | List transactions for org |
| POST | `/transactions` | Create TAF root + governing agreement + authority file |
| GET | `/transactions/:id` | Transaction detail graph |
| PATCH | `/transactions/:id/buyer` | Upsert buyer + append `BuyerProfileVersion` + audit + rule re-eval |
| PATCH | `/transactions/:id/vehicle` | Upsert vehicle + append `VehicleRecordVersion` + audit + rule re-eval |
| PATCH | `/transactions/:id/financials` | Upsert financials + append `DealFinancialsVersion` + audit + rule re-eval |
| GET | `/transactions/:id/buyer/versions` | Descending buyer version history (diff, actor metadata on rows) |
| GET | `/transactions/:id/vehicle/versions` | Vehicle version history |
| GET | `/transactions/:id/financials/versions` | Financials version history |
| GET | `/transactions/:id/state` | Current state, recent `StateTransitionLog` tails, `selectedLenderProgramId` |
| GET | `/transactions/:id/state/allowed-transitions` | Per-target `allowed` + `code` / `message` when blocked |
| POST | `/transactions/:id/state/transition` | Same as `POST /state/.../transition` + post-`LOCKED` hooks |
| GET | `/transactions/:id/lender-evaluation` | Latest `LenderRuleEvaluation` run |
| POST | `/transactions/:id/lender-evaluation/run` | Run program evaluation + **rebuild** completion |
| PATCH | `/transactions/:id/selected-lender-program` | Set `selectedLenderProgramId` |
| GET | `/transactions/:id/completion-protocol` | Tasks, blocker count |
| POST | `/transactions/:id/completion-protocol/rebuild` | Deterministic task rebuild |

PATCH bodies support **`expectedVersion`** (optimistic concurrency on the current profile row), optional **`reason`**, and domain fields. **`transaction-patch-service.ts`** diffs before/after into `diffJson`, sets `materialChange` via **`transaction-material-classifier.ts`**, may **demote** transaction state via **`transaction-material-state.ts`** when a material edit invalidates prior approval, emits **`recordAudit`**, and calls **`runFullRuleReevaluation`**.

**Material vs non-material (summary):** buyer identity fields (legal name, DOB, identifiers) are material; address-only edits are not. Vehicle **VIN / year / make / model** changes are material; trim / mileage / unstructured `rawJson` tweaks are not. Financials **amount, lender, term, APR, payment** changes are material; cosmetic JSON-only changes are not.

### Documents — `/documents`

| Method | Path | Description |
|--------|------|----------------|
| POST | `/documents` | Create document stub + suggested storage key |
| POST | `/documents/upload-intent` | Presigned PUT to staging key; creates `DocumentUploadIntent`; audited |
| POST | `/documents/:documentId/finalize-upload` | Same as finalize (alias) |
| POST | `/documents/:documentId/finalize` | Verify staging object key, size/checksum where available, duplicate SHA and immutability guards, copy to permanent key, append `DocumentVersion` (lineage, `authoritative`, `derivedRenderKey`), enqueue validation worker or inline validation; audited |
| POST | `/documents/:documentId/reprocess` | Re-queue validation for a version; hold/state guards; audited |
| POST | `/documents/:documentId/versions?transactionId=` | Register immutable version metadata (non-presigned path) |

**S3 / MinIO:** configure bucket + endpoint in `apps/api` env (see `apps/api/.env.example`). Flow: **intent** → client **PUT** to presigned URL → **finalize** with declared SHA-256 → server moves object and records version.

### Rules — `/rules`

| Method | Path | Description |
|--------|------|----------------|
| GET | `/rules` | Active rules |
| POST | `/rules` | Create rule (admin/compliance) |
| POST | `/rules/:ruleDbId/evaluations` | Attach evaluation; FAIL may open discrepancy |

### Approvals — `/approvals`

| Method | Path | Description |
|--------|------|----------------|
| POST | `/approvals/transactions/:id/approve` | Transition to `APPROVED` |

### Overrides — `/overrides`

| Method | Path | Description |
|--------|------|----------------|
| POST | `/overrides` | Create override request |
| POST | `/overrides/:id/decide` | Approve/reject override |

### State — `/state`

| Method | Path | Description |
|--------|------|----------------|
| POST | `/state/transactions/:id/transition` | Rule-gated transition; `LOCKED` seals deal + usage |

### Packages — `/packages`

| Method | Path | Description |
|--------|------|----------------|
| GET | `/packages/templates` | Active `PackageTemplate` keys (includes **AUDITOR** for read-only discovery) |
| POST | `/packages/jobs` | `package-request-service`: validate template, create `PackageJob`, usage metering, audit, enqueue BullMQ `package-job` |

Worker (`package.worker.ts`): deterministic document selection, manifest generation, `GeneratedPackage` rows, `outputKeys` / `manifestStorageKey` / `bundleSha256`, status progression, audit on success.

### Audit — `/audit` (read-only; **AUDITOR** / **ADMIN** / **COMPLIANCE_OFFICER**)

| Method | Path | Description |
|--------|------|----------------|
| GET | `/audit/transactions/:transactionId` | Transaction graph + version rows |
| GET | `/audit/transactions/:transactionId/timeline` | Merged timeline (`types`, `limit`, `cursor`); **`normalized=true`** → `entries` for UI |
| GET | `/audit/documents/:documentId` | Document + versions + audit trail |
| GET | `/audit/packages/:packageJobId` | Job + `generatedPackages` |
| GET | `/audit/search` | Filters: `transactionId`, `eventTypes` (comma), `actorUserId`, `entityType`, `entityId`, `from`, `to`, pagination `cursor` |

### Billing — `/billing`

| Method | Path | Description |
|--------|------|----------------|
| POST | `/billing/preview` | Real-time charge preview |
| POST | `/billing/portal-session` | Stripe customer portal |
| GET | `/billing/usage` | Usage events |
| POST | `/billing/webhook` | Stripe webhook (raw body) |

### Admin — `/admin` (ADMIN only)

| Method | Path | Description |
|--------|------|----------------|
| POST | `/admin/holds` | Place org/tx hold |
| POST | `/admin/holds/:id/release` | Release hold |
| POST | `/admin/pricing-rules` | Org-specific unit pricing |
| GET | `/admin/api-keys` | List API keys (prefixes only) |
| POST | `/admin/api-keys` | Create key; returns full secret once |
| POST | `/admin/api-keys/:id/revoke` | Deactivate key |

### Analytics — `/analytics`

| Method | Path | Description |
|--------|------|----------------|
| GET | `/analytics/summary` | Counts, sealed deals, usage totals |
| GET | `/analytics/dashboard` | Current-period metrics + `ANALYTICS_DASHBOARD` (metered) |
| GET | `/analytics/reports` | Recompute + history (PRO+; `402` on STARTER) |
| GET | `/analytics/export?format=…` | JSON/CSV body (PRO+; bills `ANALYTICS_REPORT`) |
| POST | `/analytics/report-export` | One-off report usage event |

### Health

| Method | Path | Description |
|--------|------|----------------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness (DB; Redis if `REDIS_URL` set) |

## External integrations & partner API

- **Adapters (DB)**: `integration_providers` (catalog), `integration_configs` (per org + provider), `integration_logs` (request/response metadata). Lender / credit / identity runs are implemented in **`integration-runners.ts`** (mock first), with **audit** on submit paths and optional **outbound** POST via **`webhook-dispatcher.ts`** when `configJson.outboundUrl` is set.
- **HTTP (JWT)**: `POST /integrations/lender/submit-deal`, `GET /integrations/lender/status/:transactionId`, `POST /integrations/credit/pull`, `POST /integrations/identity/verify`, `GET /integrations/providers`, `GET /integrations/configs`. Rate-limited for mutating methods.
- **Webhooks**: `POST /webhooks/inbound` (raw JSON, HMAC with `X-DealSeal-Signature` and `IntegrationConfig.inboundSecret`); `POST /webhooks/outbound/test` (auth) exercises outbound delivery.
- **Partner API (API key)**: `X-API-Key` on **`/api/*`** — `GET /api/transactions`, `GET /api/transactions/:id`, `GET /api/packages/:id`, `GET /api/status/:transactionId`. Keys are `dsk_…` (hashed at rest), **scoped** (`assertApiScope`), per-key **rate limit**, **usage** rows + `API_CALL` billable event + audit. **RBAC** is org-scoped by the key’s `orgId` (not JWT).

## Billing (Stripe) & entitlements

- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_CHECKOUT_PRICE_ID`, `APP_PUBLIC_URL` (Checkout return URLs). Webhooks: **`/billing/webhook`** and **`/billing/webhooks/stripe`** (same handler) for `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` / `deleted`, `checkout.session.completed`.
- **API**: `GET /billing/subscription` (includes **entitlements** — included vs sealed vs overage for the month), `GET /billing/entitlements`, `POST /billing/checkout-session` (admin/finance), existing portal + usage + invoices.
- **Internal usage** still flows through **`recordUsage`** / `UsageEvent` (e.g. `DEAL_SEALED`, `CERTIFIED_PACKAGE`, `API_CALL`); Checkout links **`BillingSubscription`** to Stripe `stripeSubId` / `stripeCustomerId`.

## Analytics

- **Snapshots** in `analytics_snapshots`; **`recomputeOrgAnalyticsSnapshot`** + **`getLatestDashboard`**. **Advanced** reports/export require **PRO+** via **`requireAdvancedAnalyticsTier`**. **GET** `/analytics/dashboard`, `/analytics/reports`, `/analytics/export?format=json|csv` (export bills `ANALYTICS_REPORT` when applicable).

## Environment (high level)

- **Core**: `DATABASE_URL`, `JWT_SECRET` (min 16 chars), `PORT`, `LOG_LEVEL`.
- **Storage**: `S3_*` — optional; used where document/package paths are already wired.
- **Rate limits**: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `API_RATE_LIMIT_MAX` (partner keys).

## Frontend routes (Next.js)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Operational overview |
| `/workspace` | Hub; open `/workspace/[transactionId]` for wired PATCH / docs / packages / audit |
| `/documents` | Document panel |
| `/discrepancies` | Discrepancy triage |
| `/approvals` | Approval UX |
| `/packages` | Package builder |
| `/audit` | Audit explorer (wired to `/audit/*` APIs) |
| `/billing` | Billing dashboard |
| `/analytics` | Analytics (dashboard + paid exports) |
| `/integrations` | Integration configs + API key admin |
| `/admin` | Admin console |

## Data invariants (non-negotiable)

1. One governing agreement per transaction — `GoverningAgreement.transactionId` unique.
2. Authoritative financial/buyer/vehicle rows versioned; executed contracts immutable at document version layer (`isImmutable` + state guards).
3. No silent overwrites of `AuditEvent` / `StateTransitionLog` / accepted `DocumentVersion` storage keys.
4. Holds block mutations that call `assertNoActiveHold`.

## Version & audit storage (Prisma)

- **`buyer_profile_versions`**, **`vehicle_versions`**, **`financial_versions`**: append-only snapshots with `fromVersion`, `sourceState`, `materialChange`, `changeReason`, `diffJson`, and monotonic `version` per parent entity.
- **`DocumentVersion`**: content addressing (`sha256`), storage keys, `authoritative`, `derivedRenderKey`, `parentVersionId` lineage, `isImmutable`.
- **`AuditEvent`**: indexed `eventType`, `entityType`, `entityId`, optional `transactionId`, `payloadJson`, `createdAt` — written only via **`recordAudit`** (append-only).
- **`package_jobs`** + **`generated_packages`** + **`package_templates`**: job lifecycle, deterministic outputs, template catalog per org.

## Async workers

- **Redis** (`REDIS_URL`) required for BullMQ queues used by API enqueue paths and `npm run worker` (`apps/api/src/workers/bootstrap.ts`).
- **Document validation** queue (or inline fallback) updates ingest status and emits audit when complete.
- **Package** queue processes `package-job` payloads as described above.

## Frontend integration (`apps/web`)

- **`/workspace/[transactionId]`** (`WorkspaceClient.tsx`): PATCH buyer/vehicle/financials with `expectedVersion`, version history lists, document stub + upload intent + finalize, package job request with templates from **`GET /packages/templates`**, normalized audit timeline from **`GET /audit/.../timeline?normalized=true`**.
- **Authority slice (same page)**: lock status, execution submit/verify, authoritative embodiment list/generate, certified package request, post-funding list/rebuild, final clearance view/complete — all call the matching `/transactions/:id/*` APIs.
- **`/audit`**: **`AuditExplorer`** client calls the read-only audit endpoints above (JWT in `localStorage` as `dealseal_token`).
- **`NEXT_PUBLIC_API_URL`**: set when the API is not at `http://localhost:4000`.

## Authority layer — execution, lock, embodiment, packages, post-funding, Green Stage 2

### Source instrument vs authoritative embodiment

- **`executed_contracts`**: links an **EXECUTED_CONTRACT** `Document` + `DocumentVersion` to the deal, records governing candidate reference, SHA-256, upload/verify actors, and workflow status (`PENDING_VERIFICATION` → `VERIFIED` / `REJECTED`). Only mutates status fields; append-only for authority history (supersede by creating new rows and clearing `authoritative` flags).
- **`execution_verifications`**: stores compared fields, mismatch JSON, result, method, and timestamp — **OPEN** `Discrepancy` with code `EXECUTION_MISMATCH` on FAIL, often with transition to `DISCREPANCY_RESTRICTED` when allowed by the state engine.
- **`authoritative_embodiments`**: operational JSON (or other format) copy of the **same** governing agreement, stored in S3, one **active** row per transaction (older rows deactivated on regenerate). Not a new deal.
- **Lock** (`LOCKED`): `GoverningAgreement.lockedAt` + `executedVersion`, executed `DocumentVersion.isImmutable = true`, `activateLockSideEffects` runs from **`onDealStateSettled`** for any path that reaches `LOCKED` (state transition or `POST /transactions/:id/lock`).

### Lock enforcement

- Core deal facts (buyer/vehicle/financials) remain gated by **`canPatchDealData`** / **`loadTxOrThrow`** in **`transaction-patch-service`**. **`assertCoreDealDataMutable`** (`lock-guard.ts`) blocks **`PATCH /transactions/:id/selected-lender-program`** when the transaction is in a sealed path.
- **`getTransitionBlockReason`**: `LOCKED` requires at least one `ExecutedContract` in **`VERIFIED`**. Existing blocker `CompletionTask` gating is unchanged. **`POST_FUNDING_PENDING` → `GREEN_STAGE_2`** (and **`COMPLETED` → `GREEN_STAGE_2`**) is blocked if any **blocker** `PostFundingItem` is still `PENDING` or `IN_PROGRESS`.
- **Final clearance** (`getFinalClearanceView` / `completeFinalClearance`): needs post-funding window (`POST_FUNDING_PENDING` or `COMPLETED`, not yet `GREEN_STAGE_2`), no open discrepancies/holds, no blocker PFI, no **overdue** PFI; embodiment is **informational** in the condition list, not a hard gate.

### Certified packages and manifests

- **`package_jobs`**: add `packageKind` (`STANDARD` | `CERTIFIED` | …), `certified`, and `stateSnapshotJson` on enqueue.
- **`package_manifests`** + **`package_verifications`**: written by **`processPackageJob`** for certified/audit/authority packages — deterministic **document** ordering (`id` sort), `PackageManifest` includes digests, snapshot, and certification string; `PackageVerification` stores a second digest of the record.
- **APIs**: `POST /transactions/:id/packages/generate-certified`, `GET /packages/:jobId/manifest`, `GET /packages/:jobId/verification`.

### Post-funding

- **`post_funding_items`**: `title`, `severity`, `source`, `isBlocker`, `assigneeRole`, `completedByUserId` — `rebuildPostFundingObligations` seeds default lender-style items after lock; `PATCH /post-funding-obligations/:id` updates status.

### New env / jobs

- No new env vars. **Redis** + **worker** (`npm run worker`) remain required to complete package jobs and persist manifests. **S3/MinIO** for embodiment and package bodies.

### Database

- After pulling, run **`cd apps/api && npx prisma generate`** and **`npx prisma migrate dev`** (or **`db push`** for throwaway) so new models (`executed_contracts`, `execution_verifications`, `authoritative_embodiments`, `package_manifests`, `package_verifications`) and altered columns on `package_jobs` / `post_funding_items` exist.
