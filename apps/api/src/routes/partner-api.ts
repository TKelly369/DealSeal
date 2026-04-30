import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { asyncHandler } from "../util/async-handler.js";
import { partnerApiKeyAuth } from "../middleware/partner-auth.js";
import { assertApiScope, recordApiUsage } from "../services/api-key-service.js";
import { prisma } from "../lib/prisma.js";
import { getLenderStatusForTransaction } from "../services/integration-runners.js";
import { recordAudit } from "../services/audit-service.js";
import { HttpError } from "../lib/http-error.js";

function withPartnerUsage() {
  return (req: Request, res: Response, next: NextFunction) => {
    const t0 = Date.now();
    res.on("finish", () => {
      const p = req.partnerAuth;
      if (!p) return;
      void recordApiUsage({
        orgId: p.orgId,
        apiKeyId: p.apiKeyId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - t0,
      });
      void recordAudit({
        orgId: p.orgId,
        actorUserId: null,
        actorRole: "PARTNER_API",
        authMethod: "API_KEY",
        eventType: "API_PARTNER_CALL",
        action: "API_PARTNER_CALL",
        resource: "ApiUsage",
        resourceId: p.apiKeyId,
        payload: { method: req.method, path: req.path, status: res.statusCode },
      }).catch(() => {});
    });
    next();
  };
}

export function createPartnerApiRouter(env: Env): Router {
  const r = Router();
  const pAuth = partnerApiKeyAuth(env);
  r.use(pAuth);
  r.use(withPartnerUsage());

  r.get(
    "/transactions",
    asyncHandler(async (req, res) => {
      if (!req.partnerAuth) throw new HttpError(401, "API key", "API_KEY");
      assertApiScope(req.partnerAuth.scopes, "read:transactions");
      const orgId = req.partnerAuth.orgId;
      const take = z.coerce.number().int().min(1).max(100).default(25).parse(req.query.limit);
      const state = z.string().optional().parse(req.query.state);
      const items = await prisma.transaction.findMany({
        where: { orgId, ...(state ? { state: state as never } : {}) },
        take,
        orderBy: { createdAt: "desc" },
        select: { id: true, publicId: true, state: true, createdAt: true },
      });
      res.json({ items });
    }),
  );

  r.get(
    "/transactions/:id",
    asyncHandler(async (req, res) => {
      if (!req.partnerAuth) throw new HttpError(401, "API key", "API_KEY");
      assertApiScope(req.partnerAuth.scopes, "read:transactions");
      const orgId = req.partnerAuth.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const t = await prisma.transaction.findFirst({
        where: { id, orgId },
        include: { governingAgreement: { select: { id: true } } },
      });
      if (!t) throw new HttpError(404, "Not found", "NOT_FOUND");
      res.json({ transaction: t });
    }),
  );

  r.get(
    "/packages/:id",
    asyncHandler(async (req, res) => {
      if (!req.partnerAuth) throw new HttpError(401, "API key", "API_KEY");
      assertApiScope(req.partnerAuth.scopes, "read:packages");
      const orgId = req.partnerAuth.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const job = await prisma.packageJob.findFirst({
        where: { id, transaction: { orgId } },
        include: { transaction: { select: { id: true, publicId: true, state: true } } },
      });
      if (!job) throw new HttpError(404, "Not found", "NOT_FOUND");
      res.json({ packageJob: job });
    }),
  );

  r.get(
    "/status/:transactionId",
    asyncHandler(async (req, res) => {
      if (!req.partnerAuth) throw new HttpError(401, "API key", "API_KEY");
      assertApiScope(req.partnerAuth.scopes, "read:status");
      const orgId = req.partnerAuth.orgId;
      const transactionId = z.string().uuid().parse(req.params.transactionId);
      const t = await prisma.transaction.findFirst({
        where: { id: transactionId, orgId },
        select: { id: true, publicId: true, state: true, createdAt: true, updatedAt: true },
      });
      if (!t) throw new HttpError(404, "Not found", "NOT_FOUND");
      const lender = await getLenderStatusForTransaction(orgId, transactionId);
      res.json({ transaction: t, lender: lender });
    }),
  );

  return r;
}
