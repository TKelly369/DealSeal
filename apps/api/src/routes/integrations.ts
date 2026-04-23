import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { recordAudit } from "../services/audit-service.js";
import {
  getLenderStatusForTransaction,
  runCreditPull,
  runIdentityVerify,
  runLenderSubmitDeal,
} from "../services/integration-runners.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

const submitBody = z.object({
  transactionId: z.string().uuid(),
  configId: z.string().uuid(),
  payload: z.record(z.unknown()).optional(),
});

const creditBody = z.object({
  transactionId: z.string().uuid(),
  configId: z.string().uuid(),
  pullType: z.enum(["SOFT", "HARD"]),
  subject: z.record(z.unknown()).optional(),
});

const identityBody = z.object({
  transactionId: z.string().uuid(),
  configId: z.string().uuid(),
  piiRef: z.string().min(1),
});

export function createIntegrationsRouter(env: Env): Router {
  const r = Router();
  const auth = createAuthMiddleware(env);
  const limit = createRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: Math.min(120, env.RATE_LIMIT_MAX),
    prefix: "integrations",
  });

  r.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    return limit(req, res, next);
  });
  r.use(auth);
  r.use(requireRoles("ADMIN", "DEALER_USER", "COMPLIANCE_OFFICER", "FINANCE_MANAGER"));

  r.post(
    "/lender/submit-deal",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = submitBody.parse(req.body);
      const out = await runLenderSubmitDeal({
        orgId,
        configId: body.configId,
        transactionId: body.transactionId,
        payloadJson: body.payload ?? {},
        actorUserId: req.auth!.sub,
      });
      res.status(201).json(out);
    }),
  );

  r.get(
    "/lender/status/:transactionId",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().parse(req.params.transactionId);
      const s = await getLenderStatusForTransaction(orgId, transactionId);
      res.json(s);
    }),
  );

  r.post(
    "/credit/pull",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = creditBody.parse(req.body);
      const out = await runCreditPull({
        orgId,
        configId: body.configId,
        transactionId: body.transactionId,
        pullType: body.pullType,
        subjectJson: body.subject ?? {},
      });
      await recordAudit({
        orgId,
        transactionId: body.transactionId,
        actorUserId: req.auth!.sub,
        eventType: "INTEGRATION_CREDIT_PULL",
        action: "INTEGRATION_CREDIT_PULL",
        resource: "IntegrationLog",
        resourceId: out.logId,
        entityType: "IntegrationLog",
        entityId: out.logId,
        payload: { pullType: body.pullType },
      });
      res.status(201).json(out);
    }),
  );

  r.post(
    "/identity/verify",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = identityBody.parse(req.body);
      const out = await runIdentityVerify({
        orgId,
        configId: body.configId,
        transactionId: body.transactionId,
        piiRef: body.piiRef,
      });
      await recordAudit({
        orgId,
        transactionId: body.transactionId,
        actorUserId: req.auth!.sub,
        eventType: "INTEGRATION_IDENTITY",
        action: "INTEGRATION_IDENTITY",
        resource: "IntegrationLog",
        resourceId: out.logId,
        entityType: "IntegrationLog",
        entityId: out.logId,
        payload: { status: out.status },
      });
      res.status(201).json(out);
    }),
  );

  r.get(
    "/providers",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER"),
    asyncHandler(async (_req, res) => {
      const { prisma } = await import("../lib/prisma.js");
      const items = await prisma.integrationProvider.findMany({ where: { active: true } });
      res.json({ items });
    }),
  );

  r.get(
    "/configs",
    requireRoles("ADMIN", "COMPLIANCE_OFFICER", "DEALER_USER", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const { prisma } = await import("../lib/prisma.js");
      const items = await prisma.integrationConfig.findMany({
        where: { orgId },
        include: { provider: { select: { id: true, key: true, name: true, category: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json({ items });
    }),
  );

  return r;
}
