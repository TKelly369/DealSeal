import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env.js";
import { createAuthMiddleware, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../util/async-handler.js";
import { prisma } from "../lib/prisma.js";
import { recordUsage } from "../services/pricing-engine.js";
import {
  getLatestDashboard,
  recomputeOrgAnalyticsSnapshot,
  requireAdvancedAnalyticsTier,
} from "../services/analytics-aggregate-service.js";
import { recordAudit } from "../services/audit-service.js";

export function createAnalyticsRouter(_env: Env): Router {
  const r = Router();
  r.use(createAuthMiddleware(_env));
  r.use(
    requireRoles(
      "ADMIN",
      "FINANCE_MANAGER",
      "COMPLIANCE_OFFICER",
      "DEALER_USER",
      "AUDITOR",
    ),
  );

  r.get(
    "/dashboard",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const dash = await getLatestDashboard(orgId);
      await recordUsage(prisma, {
        orgId,
        eventType: "ANALYTICS_DASHBOARD",
        quantity: 1,
        idempotencyKey: `dash-month:${orgId}:${new Date().getMonth()}`,
        metadata: { path: "dashboard" },
      }).catch(() => {});
      res.json(dash);
    }),
  );

  r.get(
    "/reports",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      await requireAdvancedAnalyticsTier(orgId);
      const from = z.coerce.date().optional().parse(req.query.from);
      const to = z.coerce.date().optional().parse(req.query.to);
      const d = new Date();
      const fromD = from ?? new Date(d.getFullYear(), d.getMonth(), 1);
      const toD = to ?? new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const fresh = await recomputeOrgAnalyticsSnapshot(orgId, fromD, toD);
      const list = await prisma.analyticsSnapshot.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 24,
      });
      res.json({ current: fresh, history: list });
    }),
  );

  r.get(
    "/export",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      await requireAdvancedAnalyticsTier(orgId);
      const format = z.enum(["json", "csv"]).default("json").parse(req.query.format);
      const dash = await getLatestDashboard(orgId);
      const payload = JSON.stringify(dash.currentPeriod.metrics, null, 0);
      await recordUsage(prisma, {
        orgId,
        eventType: "ANALYTICS_REPORT",
        quantity: 1,
        idempotencyKey: `an-export:${orgId}:${Date.now()}`,
        metadata: { format },
      });
      await recordAudit({
        orgId,
        actorUserId: req.auth!.sub,
        eventType: "ANALYTICS_EXPORT",
        action: "ANALYTICS_EXPORT",
        resource: "AnalyticsSnapshot",
        resourceId: orgId,
        payload: { format },
      });
      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.send(
          JSON.stringify(
            { exportedAt: new Date().toISOString(), orgId, metrics: dash.currentPeriod.metrics },
            null,
            2,
          ),
        );
        return;
      }
      res.setHeader("Content-Type", "text/csv");
      res.send(`key,value\nraw,"${payload.replaceAll('"', '""')}"\n`);
    }),
  );

  r.get(
    "/summary",
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      const [byState, sealed, usage] = await Promise.all([
        prisma.transaction.groupBy({
          by: ["state"],
          where: { orgId },
          _count: { _all: true },
        }),
        prisma.transaction.count({
          where: {
            orgId,
            state: { in: ["LOCKED", "COMPLETED", "GREEN_STAGE_2", "POST_FUNDING_PENDING"] },
          },
        }),
        prisma.usageEvent.aggregate({
          where: { orgId },
          _sum: { amountUsd: true },
        }),
      ]);
      res.json({
        transactionsByState: byState.map((s) => ({
          state: s.state,
          count: s._count._all,
        })),
        sealedDeals: sealed,
        usageTotalUsd: usage._sum.amountUsd?.toString() ?? "0",
      });
    }),
  );

  r.post(
    "/report-export",
    requireRoles("ADMIN", "FINANCE_MANAGER", "COMPLIANCE_OFFICER"),
    asyncHandler(async (req, res) => {
      const orgId = req.auth!.orgId;
      await recordUsage(prisma, {
        orgId,
        eventType: "ANALYTICS_REPORT",
        quantity: 1,
        idempotencyKey: `an-report:${orgId}:${Date.now()}`,
        metadata: { source: "analytics" },
      });
      res.json({ ok: true, billable: "ANALYTICS_REPORT" });
    }),
  );

  return r;
}
