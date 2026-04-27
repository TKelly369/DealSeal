import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getCorsOriginOption, loadEnv } from "./config/env.js";
import { getVerificationPublicBaseUrl } from "./config/urls.js";
import { setLogLevelFromEnv } from "./lib/logger.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { registerRoutes } from "./routes/index.js";
import { createVerifyApiRouter } from "./routes/verify-public.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createStripeWebhookHandler } from "./routes/billing-webhook.js";
import { createWebhooksPublicHandler } from "./routes/webhooks-routes.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { checkLivenessWithDatabase, checkReadiness, SERVICE_ID } from "./lib/runtime-health.js";

const env = loadEnv();
setLogLevelFromEnv(env);

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: env.NODE_ENV === "production"
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    referrerPolicy: { policy: "no-referrer" },
  }),
);
app.use(
  cors({ origin: getCorsOriginOption(env), credentials: true }),
);
app.post(
  "/billing/webhook",
  express.raw({ type: "application/json" }),
  createStripeWebhookHandler(env),
);
app.post(
  "/billing/webhooks/stripe",
  express.raw({ type: "application/json" }),
  createStripeWebhookHandler(env),
);
app.post("/webhooks/inbound", express.raw({ type: "application/json" }), createWebhooksPublicHandler());

app.use(requestLoggerMiddleware());
app.use(express.json({ limit: "2mb" }));

app.use("/api/verify", createVerifyApiRouter(env));

app.get("/health", async (_req, res) => {
  const h = await checkLivenessWithDatabase();
  if (h.ok) {
    res.json({ ok: true, service: SERVICE_ID, time: h.time, database: true });
  } else {
    logger.error("health_check_db", { code: h.code });
    res.status(503).json({ ok: false, service: SERVICE_ID, time: h.time, database: false, code: h.code });
  }
});
app.get("/api/health", async (_req, res) => {
  const h = await checkLivenessWithDatabase();
  if (h.ok) {
    res.json({ ok: true, service: SERVICE_ID, time: h.time, database: true });
  } else {
    logger.error("api_health_check_db", { code: h.code });
    res.status(503).json({ ok: false, service: SERVICE_ID, time: h.time, database: false, code: h.code });
  }
});

app.get("/ready", async (_req, res) => {
  const r = await checkReadiness();
  if (r.ok) {
    res.json({ ok: true, service: SERVICE_ID, time: r.time, database: true, redis: r.redis });
    return;
  }
  logger.error("ready_check", { code: r.code, redis: r.redis });
  res
    .status(503)
    .json({ ok: false, service: SERVICE_ID, time: r.time, database: r.database, redis: r.redis, code: r.code });
});
app.get("/api/ready", async (_req, res) => {
  const r = await checkReadiness();
  if (r.ok) {
    res.json({ ok: true, service: SERVICE_ID, time: r.time, database: true, redis: r.redis });
    return;
  }
  logger.error("api_ready_check", { code: r.code, redis: r.redis });
  res
    .status(503)
    .json({ ok: false, service: SERVICE_ID, time: r.time, database: r.database, redis: r.redis, code: r.code });
});

app.get("/demo", async (_req, res) => {
  try {
    const org = await prisma.organization.findFirst({
      where: { slug: "demo-dealer" },
      select: { id: true, name: true, slug: true },
    });
    if (!org) {
      res.status(404).json({
        ok: false,
        message: "Demo org not found. Run the seed script first.",
      });
      return;
    }

    const [transactionsByState, auditCount, latestTransactions] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["state"],
        where: { orgId: org.id },
        _count: { _all: true },
      }),
      prisma.auditEvent.count({ where: { organizationId: org.id } }),
      prisma.transaction.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          publicId: true,
          state: true,
          createdAt: true,
          buyer: { select: { legalName: true } },
          financials: { select: { amountFinanced: true, termMonths: true } },
        },
      }),
    ]);

    res.json({
      ok: true,
      organization: org,
      metrics: {
        transactions: transactionsByState.reduce((sum, item) => sum + item._count._all, 0),
        auditEvents: auditCount,
        states: transactionsByState.map((item) => ({ state: item.state, count: item._count._all })),
      },
      latestTransactions: latestTransactions.map((tx) => ({
        id: tx.id,
        publicId: tx.publicId,
        state: tx.state,
        buyerName: tx.buyer?.legalName ?? "Unknown buyer",
        amountFinanced: tx.financials?.amountFinanced?.toString() ?? "0",
        termMonths: tx.financials?.termMonths ?? null,
        createdAt: tx.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    logger.error("demo_route_failed", { err: String(e) });
    res.status(500).json({ ok: false, message: "Failed to load demo data." });
  }
});

registerRoutes(app, env);

app.use(errorHandler);

const verifyBase = getVerificationPublicBaseUrl(env);

void (async function start() {
  if (env.NODE_ENV === "production") {
    try {
      await prisma.$connect();
    } catch (e) {
      logger.error("database_startup_connect_failed", { err: String(e) });
      process.exit(1);
    }
  }
  // eslint-disable-next-line no-console -- deploy visibility: env + verification base for QR
  console.log(
    JSON.stringify({
      event: "api_starting",
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      verificationPublicBaseUrl: verifyBase,
    }),
  );
  app.listen(env.PORT, () => {
    logger.info("api_listen", { port: env.PORT, env: env.NODE_ENV, verificationPublicBaseUrl: verifyBase });
  });
})().catch((e) => {
  logger.error("api_start_failed", { err: String(e) });
  process.exit(1);
});
