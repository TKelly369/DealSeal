import { Router } from "express";
import { z } from "zod";
import { BillableEventType, SubscriptionTier } from "@prisma/client";
import { DEFAULT_PRICE_BOOK } from "@dealseal/shared";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { previewCharges, recordUsage } from "../services/pricing-engine.js";
import { prisma } from "../lib/prisma.js";
import { ensureStripeCustomer, getStripe } from "../services/billing-service.js";
import { HttpError } from "../lib/http-error.js";
import {
  createCheckoutSessionForOrg,
  getBillingSubscriptionView,
} from "../services/billing-execution.js";
import {
  generateInvoiceDraftForPeriod,
  listInvoices,
} from "../services/invoice-draft-service.js";
import { recordAudit } from "../services/audit-service.js";
import { getOrgDealEntitlements } from "../services/entitlements-service.js";

const previewBody = z.object({
  lines: z
    .array(
      z.object({
        eventType: z.nativeEnum(BillableEventType),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export function createBillingRouter(env: Env): Router {
  const r = Router();
  const auth = createAuthMiddleware(env);

  r.post(
    "/preview",
    auth,
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = previewBody.parse(req.body);
      const preview = await previewCharges(prisma, orgId, body.lines);
      res.json(preview);
    }),
  );

  r.post(
    "/portal-session",
    auth,
    asyncHandler(async (req, res) => {
      const stripe = getStripe(env);
      if (!stripe) {
        throw new HttpError(501, "Stripe not configured", "STRIPE_DISABLED");
      }
      const orgId = req.auth!.orgId;
      const customerId = await ensureStripeCustomer(stripe, orgId);
      const appUrl = env.APP_PUBLIC_URL ?? "http://localhost:3000";
      const origin =
        typeof req.headers.origin === "string" && req.headers.origin.trim().length > 0
          ? req.headers.origin
          : appUrl;
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/billing`,
      });
      res.json({ url: session.url });
    }),
  );

  r.get(
    "/usage",
    auth,
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const since = z.coerce.date().optional().parse(req.query.since);
      const events = await prisma.usageEvent.findMany({
        where: {
          orgId,
          ...(since ? { recordedAt: { gte: since } } : {}),
        },
        orderBy: { recordedAt: "desc" },
        take: 500,
      });
      res.json({ items: events });
    }),
  );

  r.get(
    "/events",
    auth,
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const since = z.coerce.date().optional().parse(req.query.since);
      const take = z.coerce.number().int().min(1).max(500).default(200).parse(req.query.limit);
      const eventType = z.nativeEnum(BillableEventType).optional().parse(req.query.eventType);
      const events = await prisma.usageEvent.findMany({
        where: {
          orgId,
          ...(since ? { recordedAt: { gte: since } } : {}),
          ...(eventType ? { eventType } : {}),
        },
        orderBy: { recordedAt: "desc" },
        take,
      });
      res.json({ items: events, next: null });
    }),
  );

  r.get(
    "/plans",
    auth,
    asyncHandler(async (_req, res) => {
      res.json({ plans: DEFAULT_PRICE_BOOK });
    }),
  );

  r.post(
    "/tenant-plan",
    auth,
    requireRoles("ADMIN", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const body = z.object({ tier: z.nativeEnum(SubscriptionTier) }).parse(req.body);
      const sub = await prisma.billingSubscription.upsert({
        where: { orgId },
        create: { orgId, tier: body.tier, status: "active" },
        update: { tier: body.tier },
      });
      await recordUsage(prisma, {
        orgId,
        eventType: "SUBSCRIPTION_PLAN_ASSIGNED",
        quantity: 1,
        idempotencyKey: `plan:${orgId}:${sub.tier}`,
        metadata: { tier: body.tier },
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        eventType: "TENANT_PLAN_CHANGE",
        action: "TENANT_PLAN_CHANGE",
        entityType: "BillingSubscription",
        entityId: sub.id,
        resource: "BillingSubscription",
        resourceId: sub.id,
        payload: { tier: body.tier },
      });
      res.json({ subscription: sub });
    }),
  );

  r.get(
    "/invoices",
    auth,
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const items = await listInvoices(prisma, orgId);
      res.json({ items });
    }),
  );

  r.get(
    "/subscription",
    auth,
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const v = await getBillingSubscriptionView(orgId);
      res.json(v);
    }),
  );

  r.get(
    "/entitlements",
    auth,
    asyncHandler(async (req, res) => {
      const e = await getOrgDealEntitlements(req.auth!.orgId);
      res.json(e);
    }),
  );

  r.post(
    "/checkout-session",
    auth,
    requireRoles("ADMIN", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const out = await createCheckoutSessionForOrg(
        env,
        orgId,
        z
          .object({ successPath: z.string().optional(), cancelPath: z.string().optional() })
          .parse(req.body ?? {}),
      );
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        action: "BILLING_CHECKOUT",
        resource: "BillingSubscription",
        resourceId: orgId,
        payload: { sessionId: out.id },
      });
      res.json(out);
    }),
  );

  r.post(
    "/invoices/draft",
    auth,
    requireRoles("ADMIN", "FINANCE_MANAGER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const d = await generateInvoiceDraftForPeriod(prisma, orgId);
      res.status(201).json(d);
    }),
  );

  return r;
}
