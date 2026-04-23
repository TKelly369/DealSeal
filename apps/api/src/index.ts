import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getCorsOriginOption, loadEnv } from "./config/env.js";
import { setLogLevelFromEnv } from "./lib/logger.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createStripeWebhookHandler } from "./routes/billing-webhook.js";
import { createWebhooksPublicHandler } from "./routes/webhooks-routes.js";
import { prisma } from "./lib/prisma.js";
import { getQueueConnection } from "./queue/connection.js";
import { logger } from "./lib/logger.js";

const env = loadEnv();
setLogLevelFromEnv(env);

const app = express();

app.use(helmet());
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

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "dealseal-api", time: new Date().toISOString() });
});

app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    logger.error("ready_check_db", { err: String(e) });
    res.status(503).json({ ready: false, reason: "database" });
    return;
  }
  const q = getQueueConnection();
  if (q) {
    try {
      await q.ping();
    } catch (e) {
      logger.error("ready_check_redis", { err: String(e) });
      res.status(503).json({ ready: false, reason: "redis" });
      return;
    }
  }
  res.json({ ready: true, db: true, redis: q ? "ok" : "skipped" });
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

app.listen(env.PORT, () => {
  logger.info("api_listen", { port: env.PORT, env: env.NODE_ENV });
});
