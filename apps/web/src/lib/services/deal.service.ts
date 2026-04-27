import { prisma } from "@/lib/db";

export const DealService = {
  async listDealsForDealer(dealerId: string) {
    return prisma.deal.findMany({
      where: { dealerId },
      include: { lender: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });
  },

  async listDealsForLender(lenderId: string) {
    return prisma.deal.findMany({
      where: { lenderId },
      include: { dealer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });
  },

  async submitToLender(_dealId: string) {
    throw new Error("Legacy lender submit is disabled. Use the deal lifecycle workflow and lender intake.");
  },
};
