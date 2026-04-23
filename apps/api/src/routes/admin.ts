import { Router } from "express";
import { z } from "zod";
import { BillableEventType, HoldScope } from "@prisma/client";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { recordAudit } from "../services/audit-service.js";
import { createApiKeyForOrg } from "../services/api-key-service.js";

const holdBody = z.object({
  scope: z.nativeEnum(HoldScope),
  transactionId: z.string().uuid().optional(),
  reason: z.string().min(3),
});

const pricingBody = z.object({
  eventType: z.nativeEnum(BillableEventType),
  unitAmountUsd: z.number().positive(),
});

export function createAdminRouter(env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(env));
  r.use(requireRoles("ADMIN"));

  r.post(
    "/holds",
    asyncHandler(async (req, res) => {
      const body = holdBody.parse(req.body);
      const orgId = req.auth!.orgId;
      const hold = await prisma.hold.create({
        data: {
          scope: body.scope,
          orgId: body.scope === "ORGANIZATION" ? orgId : undefined,
          transactionId: body.transactionId,
          reason: body.reason,
          placedByUserId: req.auth!.sub,
        },
      });
      if (body.transactionId) {
        await prisma.transaction.updateMany({
          where: { id: body.transactionId, orgId },
          data: { state: "HOLD" },
        });
      }
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "HOLD_PLACE",
        resource: "Hold",
        resourceId: hold.id,
        payload: body,
      });
      res.status(201).json(hold);
    }),
  );

  r.post(
    "/holds/:id/release",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const hold = await prisma.hold.findFirst({
        where: { id: req.params.id },
      });
      if (!hold || (hold.orgId && hold.orgId !== orgId)) {
        res.status(404).json({ code: "NOT_FOUND", message: "Not found" });
        return;
      }
      await prisma.hold.update({
        where: { id: hold.id },
        data: { active: false, releasedAt: new Date() },
      });
      if (hold.transactionId) {
        await prisma.transaction.updateMany({
          where: { id: hold.transactionId, orgId, state: "HOLD" },
          data: { state: "DRAFT" },
        });
      }
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "HOLD_RELEASE",
        resource: "Hold",
        resourceId: hold.id,
      });
      res.json({ ok: true });
    }),
  );

  r.post(
    "/pricing-rules",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = pricingBody.parse(req.body);
      const rule = await prisma.pricingRule.create({
        data: {
          orgId,
          eventType: body.eventType,
          unitAmountUsd: body.unitAmountUsd,
        },
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        eventType: "PRICING_RULE_UPSERT",
        action: "PRICING_RULE_UPSERT",
        entityType: "PricingRule",
        entityId: rule.id,
        resource: "PricingRule",
        resourceId: rule.id,
      });
      res.status(201).json(rule);
    }),
  );

  r.get(
    "/lenders",
    asyncHandler(async (_req, res) => {
      const items = await prisma.lender.findMany({ orderBy: { code: "asc" } });
      res.json({ items });
    }),
  );

  r.get(
    "/lender-programs",
    asyncHandler(async (req, res) => {
      const lenderId = z.string().uuid().optional().parse(req.query.lenderId);
      const items = await prisma.lenderProgram.findMany({
        where: { ...(lenderId ? { lenderId } : {}) },
        orderBy: [{ key: "asc" }],
        include: { lender: { select: { code: true, name: true } } },
      });
      res.json({ items });
    }),
  );

  r.patch(
    "/lender-programs/:id",
    asyncHandler(async (req, res) => {
      const body = z
        .object({ active: z.boolean().optional(), name: z.string().min(1).optional() })
        .parse(req.body);
      const data: { active?: boolean; name?: string } = {};
      if (body.active !== undefined) data.active = body.active;
      if (body.name) data.name = body.name;
      const p = await prisma.lenderProgram.update({
        where: { id: req.params.id },
        data,
      });
      res.json(p);
    }),
  );

  r.get(
    "/state-transitions",
    asyncHandler(async (req, res) => {
      const transactionId = z.string().uuid().parse(req.query.transactionId);
      const orgId = req.auth!.orgId;
      const tx = await prisma.transaction.findFirst({ where: { id: transactionId, orgId } });
      if (!tx) {
        res.status(404).json({ code: "NOT_FOUND" });
        return;
      }
      const rows = await prisma.stateTransitionLog.findMany({
        where: { transactionId },
        orderBy: { createdAt: "asc" },
        take: 200,
      });
      res.json({ items: rows });
    }),
  );

  r.get(
    "/overrides",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const items = await prisma.overrideRecord.findMany({
        where: {
          transaction: { orgId: orgId },
          ...(transactionId ? { transactionId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      res.json({ items });
    }),
  );

  r.get(
    "/usage-events",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const take = z.coerce.number().int().min(1).max(500).default(200).parse(req.query.limit);
      const items = await prisma.usageEvent.findMany({
        where: { orgId },
        orderBy: { recordedAt: "desc" },
        take,
      });
      res.json({ items });
    }),
  );

  r.get(
    "/authority/execution",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const items = await prisma.executionVerification.findMany({
        where: {
          transaction: { orgId, ...(transactionId ? { id: transactionId } : {}) },
        },
        orderBy: { verifiedAt: "desc" },
        take: 200,
      });
      res.json({ items });
    }),
  );

  r.get(
    "/authority/executed-contracts",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const items = await prisma.executedContract.findMany({
        where: {
          transaction: { orgId, ...(transactionId ? { id: transactionId } : {}) },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { document: { select: { type: true, id: true } } },
      });
      res.json({ items });
    }),
  );

  r.get(
    "/authority/embodiments",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const items = await prisma.authoritativeEmbodiment.findMany({
        where: { transaction: { orgId, ...(transactionId ? { id: transactionId } : {}) } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      res.json({ items });
    }),
  );

  r.get(
    "/authority/post-funding",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const items = await prisma.postFundingItem.findMany({
        where: { transaction: { orgId, ...(transactionId ? { id: transactionId } : {}) } },
        orderBy: { updatedAt: "desc" },
        take: 300,
      });
      res.json({ items });
    }),
  );

  r.get(
    "/authority/packages",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const transactionId = z.string().uuid().optional().parse(req.query.transactionId);
      const items = await prisma.packageManifest.findMany({
        where: { transaction: { orgId, ...(transactionId ? { id: transactionId } : {}) } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { verification: true, packageJob: { select: { id: true, status: true, packageKind: true, certified: true } } },
      });
      res.json({ items });
    }),
  );

  r.get(
    "/api-keys",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const items = await prisma.apiKey.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          active: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      res.json({ items });
    }),
  );

  r.post(
    "/api-keys",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = z
        .object({ name: z.string().min(1), scopes: z.array(z.string()).optional() })
        .parse(req.body);
      const out = await createApiKeyForOrg({
        orgId,
        name: body.name,
        createdByUserId: req.auth!.sub,
        scopes: body.scopes,
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "API_KEY_CREATE",
        resource: "ApiKey",
        resourceId: out.id,
        payload: { name: body.name },
      });
      res.status(201).json({ id: out.id, keyPrefix: out.keyPrefix, secret: out.displayOnce });
    }),
  );

  r.post(
    "/api-keys/:id/revoke",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const id = z.string().uuid().parse(req.params.id);
      const n = await prisma.apiKey.updateMany({ where: { id, orgId }, data: { active: false } });
      if (n.count === 0) {
        res.status(404).json({ code: "NOT_FOUND" });
        return;
      }
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "API_KEY_REVOKE",
        resource: "ApiKey",
        resourceId: id,
      });
      res.json({ ok: true });
    }),
  );

  return r;
}
