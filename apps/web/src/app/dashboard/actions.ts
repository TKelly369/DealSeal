"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type DashboardMetrics = {
  activeWorkflows: number;
  recentDocuments: number;
  usagePercent: number;
  compliancePassRate: number;
  totalDeals: number;
  activeLenderLinks: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const workspaceId = session.user.workspaceId;
  const [totalDeals, recentDocuments, activeLenderLinks, blockedChecks, totalChecks] = await Promise.all([
    prisma.deal.count({
      where: {
        OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }],
      },
    }),
    prisma.generatedDocument.count({
      where: {
        deal: { OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }] },
      },
    }),
    prisma.dealerLenderLink.count({
      where: {
        OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }],
        status: "APPROVED",
      },
    }),
    prisma.complianceCheck.count({
      where: {
        deal: { OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }] },
        status: "BLOCKED",
      },
    }),
    prisma.complianceCheck.count({
      where: {
        deal: { OR: [{ dealerId: workspaceId }, { lenderId: workspaceId }] },
      },
    }),
  ]);

  const compliancePassRate = totalChecks === 0 ? 100 : Number((((totalChecks - blockedChecks) / totalChecks) * 100).toFixed(1));
  const usagePercent = Math.min(99, Math.round((recentDocuments / 2000) * 100));

  return {
    activeWorkflows: totalDeals,
    recentDocuments,
    usagePercent,
    compliancePassRate,
    totalDeals,
    activeLenderLinks,
  };
}
