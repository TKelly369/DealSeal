import { prisma } from "@/lib/db";

export class BillingLimitExceeded extends Error {
  constructor(message = "Upgrade to Pro to create more deals this month.") {
    super(message);
    this.name = "BillingLimitExceeded";
  }
}

export const BillingGateService = {
  async checkDealLimit(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!workspace) throw new Error("Workspace not found.");

    const sub = workspace.subscriptions[0] ?? null;
    const limit = sub?.status === "ACTIVE" ? 100 : 5;
    if (workspace.dealCountCurrentPeriod >= limit) {
      throw new BillingLimitExceeded();
    }
    return { limit, used: workspace.dealCountCurrentPeriod };
  },
};

