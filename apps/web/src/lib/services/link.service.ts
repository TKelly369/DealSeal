import { DealerLenderLinkStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export const DealerLenderLinkService = {
  async requestAccess(dealerId: string, lenderId: string, requestedBy?: string) {
    return prisma.dealerLenderLink.upsert({
      where: { dealerId_lenderId: { dealerId, lenderId } },
      update: {
        status: DealerLenderLinkStatus.PENDING,
        requestedBy: requestedBy ?? null,
        approvedBy: null,
      },
      create: {
        dealerId,
        lenderId,
        status: DealerLenderLinkStatus.PENDING,
        approvedStates: [],
        allowedDealTypes: [],
        requestedBy: requestedBy ?? null,
      },
    });
  },

  async approveAccess(linkId: string, adminId: string) {
    return prisma.dealerLenderLink.update({
      where: { id: linkId },
      data: {
        status: DealerLenderLinkStatus.APPROVED,
        approvedBy: adminId,
        effectiveDate: new Date(),
      },
    });
  },

  async getActiveLinksForDealer(dealerId: string) {
    return prisma.dealerLenderLink.findMany({
      where: {
        dealerId,
        status: DealerLenderLinkStatus.APPROVED,
      },
      include: {
        lender: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async getPendingAccessRequestsForDealer(dealerId: string) {
    return prisma.dealerLenderLink.findMany({
      where: {
        dealerId,
        status: DealerLenderLinkStatus.PENDING,
      },
      include: {
        lender: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  /** All lender relationships for the dealer (approved, pending, suspended, etc.). */
  async getDealerLenderNetwork(dealerId: string) {
    return prisma.dealerLenderLink.findMany({
      where: { dealerId },
      include: {
        lender: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },
};
