import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { DEFAULT_PRICE_BOOK } from "@dealseal/shared";
import { SubscriptionTier } from "@prisma/client";

const SEALED = ["LOCKED", "POST_FUNDING_PENDING", "COMPLETED", "GREEN_STAGE_2"] as const;

/**
 * Recompute and persist a snapshot; also returned for GET dashboard without save (when period matches).
 */
export async function recomputeOrgAnalyticsSnapshot(
  orgId: string,
  from: Date,
  to: Date,
): Promise<{
  id?: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, unknown>;
}> {
  const [txState, openDisc, discTotal, evalRuns, lockLogs, pkgJobs] = await Promise.all([
    prisma.transaction.groupBy({ by: ["state"], where: { orgId }, _count: { _all: true } }),
    prisma.discrepancy.count({
      where: { transaction: { orgId }, status: { in: ["OPEN", "ASSIGNED"] } },
    }),
    prisma.discrepancy.count({ where: { transaction: { orgId } } }),
    prisma.lenderRuleEvaluation.count({ where: { orgId, evaluatedAt: { gte: from, lt: to } } }),
    prisma.stateTransitionLog.count({ where: { toState: "LOCKED", transaction: { orgId } } }),
    prisma.packageJob.count({
      where: { transaction: { orgId }, createdAt: { gte: from, lt: to } },
    }),
  ]);

  const byState: Record<string, number> = {};
  for (const s of txState) byState[s.state] = s._count._all;
  const sealed = await prisma.transaction.count({
    where: { orgId, state: { in: [...SEALED] } },
  });
  const ruleFailApprox = await prisma.lenderRuleEvaluation.count({
    where: {
      orgId,
      lineOutcome: "FAIL",
      evaluatedAt: { gte: from, lt: to },
    },
  });

  const sub = await prisma.billingSubscription.findUnique({ where: { orgId } });
  const tier: SubscriptionTier = sub?.tier ?? "STARTER";
  const book = DEFAULT_PRICE_BOOK.subscription;
  const included =
    tier === "STARTER"
      ? book.STARTER.includedDeals
      : tier === "PROFESSIONAL"
        ? book.PROFESSIONAL.includedDeals
        : book.ENTERPRISE.includedDeals;
  const sealedMtd = await prisma.usageEvent.count({
    where: {
      orgId,
      eventType: "DEAL_SEALED",
      recordedAt: { gte: from, lt: to },
    },
  });
  const overageDeals = Math.max(0, sealedMtd - included);

  const metrics: Record<string, unknown> = {
    version: 1,
    byState,
    openDiscrepancies: openDisc,
    discrepancyTotal: discTotal,
    sealedDeals: sealed,
    lenderEvaluationsInWindow: evalRuns,
    packageJobsInWindow: pkgJobs,
    lockEventCount: lockLogs,
    ruleFailureLinesInWindow: ruleFailApprox,
    timeToLockAvgSeconds: null,
    billable: {
      tier,
      includedDeals: included,
      sealedInPeriod: sealedMtd,
      overageDeals,
    },
  };

  const row = await prisma.analyticsSnapshot.create({
    data: {
      orgId,
      periodStart: from,
      periodEnd: to,
      metricsJson: metrics as Prisma.InputJsonValue,
    },
  });
  return { id: row.id, periodStart: from.toISOString(), periodEnd: to.toISOString(), metrics };
}

export async function getLatestDashboard(
  orgId: string,
): Promise<{
  lastSnapshot: unknown;
  currentPeriod: { periodStart: string; periodEnd: string; metrics: Record<string, unknown> };
}> {
  const last = await prisma.analyticsSnapshot.findFirst({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  if (last) {
    return {
      lastSnapshot: {
        at: last.createdAt.toISOString(),
        periodStart: last.periodStart,
        periodEnd: last.periodEnd,
        metrics: last.metricsJson,
      },
      currentPeriod: {
        periodStart: last.periodStart.toISOString(),
        periodEnd: last.periodEnd.toISOString(),
        metrics: last.metricsJson as Record<string, unknown>,
      },
    };
  }
  const fresh = await recomputeOrgAnalyticsSnapshot(orgId, from, to);
  return {
    lastSnapshot: null,
    currentPeriod: {
      periodStart: fresh.periodStart,
      periodEnd: fresh.periodEnd,
      metrics: fresh.metrics,
    },
  };
}

export async function requireAdvancedAnalyticsTier(orgId: string): Promise<void> {
  const sub = await prisma.billingSubscription.findUnique({ where: { orgId } });
  const tier: SubscriptionTier = sub?.tier ?? "STARTER";
  if (tier === "STARTER") {
    throw new HttpError(402, "Advanced analytics requires a paid plan", "TIER", {
      required: "PROFESSIONAL",
    });
  }
}
