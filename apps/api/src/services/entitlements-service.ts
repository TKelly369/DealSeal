import { DEFAULT_PRICE_BOOK } from "@dealseal/shared";
import { prisma } from "../lib/prisma.js";

function monthWindow(d: Date): { from: Date; to: Date } {
  return {
    from: new Date(d.getFullYear(), d.getMonth(), 1),
    to: new Date(d.getFullYear(), d.getMonth() + 1, 1),
  };
}

/**
 * Subscription included deals per calendar month vs usage (DEAL_SEALED) this month.
 */
export async function getOrgDealEntitlements(
  orgId: string,
): Promise<{
  tier: string;
  includedInPeriod: number;
  sealedInPeriod: number;
  overage: number;
  periodFrom: string;
  periodTo: string;
}> {
  const { from, to } = monthWindow(new Date());
  const [sub, sealed] = await Promise.all([
    prisma.billingSubscription.findUnique({ where: { orgId } }),
    prisma.usageEvent.count({
      where: {
        orgId,
        eventType: "DEAL_SEALED",
        recordedAt: { gte: from, lt: to },
      },
    }),
  ]);
  const tier = (sub?.tier ?? "STARTER") as keyof typeof DEFAULT_PRICE_BOOK.subscription;
  const included = DEFAULT_PRICE_BOOK.subscription[tier]?.includedDeals ?? 20;
  return {
    tier,
    includedInPeriod: included,
    sealedInPeriod: sealed,
    overage: Math.max(0, sealed - included),
    periodFrom: from.toISOString(),
    periodTo: to.toISOString(),
  };
}
