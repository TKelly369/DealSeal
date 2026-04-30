import crypto from "crypto";
import {
  ContractTransactionEventType,
  LoanPoolStatus,
  LoanPoolType,
  SecondaryMarketStatus,
} from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";
import { NegotiableInstrumentService } from "@/lib/services/negotiable-instrument.service";

function auditHash(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

export const SecondaryMarketService = {
  async classifyLoanForSale(dealId: string): Promise<{ grade: string; status: SecondaryMarketStatus }> {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { financials: true, parties: true },
    });
    if (!deal?.financials) throw new Error("Deal not found or missing financials.");

    const ltv = Number(deal.financials.ltv);
    const buyer = deal.parties.find((p) => p.role === "BUYER");
    const tier = (buyer?.creditTier ?? "").toUpperCase();
    const ageDays = (Date.now() - deal.createdAt.getTime()) / 86_400_000;

    let grade = "Subprime";
    if (ltv <= 0.95 && (tier === "A" || tier === "B" || tier === "PRIME") && ageDays < 120) {
      grade = "Prime";
    }

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        secondaryMarketGrade: grade,
        secondaryMarketStatus: SecondaryMarketStatus.AVAILABLE_FOR_SALE,
      },
    });
    await NotificationService.createNotification({
      workspaceId: deal.lenderId,
      dealId,
      type: "LOAN_CLASSIFIED_FOR_SALE",
      title: "Loan classified for sale",
      message: `Deal classified as ${grade}.`,
    });

    return { grade, status: SecondaryMarketStatus.AVAILABLE_FOR_SALE };
  },

  async assignContractToLender(dealId: string) {
    const existing = await prisma.contractTransactionEvent.findFirst({
      where: { dealId, eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER },
    });
    if (existing) return existing;

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { financials: true },
    });
    if (!deal) throw new Error("Deal not found.");

    const consideration = deal.financials ? Number(deal.financials.amountFinanced) : undefined;
    const hash = auditHash([dealId, deal.dealerId, deal.lenderId, new Date().toISOString()]);
    await NegotiableInstrumentService.ensureNegotiableInstrument(dealId, deal.lenderId);
    const instrumentTransfer = await NegotiableInstrumentService.endorseAndTransferInstrument(
      dealId,
      deal.lenderId,
      true,
      deal.dealerId,
    );

    return prisma.contractTransactionEvent.create({
      data: {
        dealId,
        eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER,
        fromEntityId: deal.dealerId,
        toEntityId: deal.lenderId,
        considerationAmount: Number.isFinite(consideration) ? consideration : undefined,
        auditHash: hash,
        instrumentTransferEventId: instrumentTransfer.id,
      },
    });
  },

  async addDealToPool(dealId: string, poolId: string) {
    const pool = await prisma.loanPool.findUnique({ where: { id: poolId } });
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!pool || !deal) throw new Error("Pool or deal not found.");
    if (deal.lenderId !== pool.lenderId) throw new Error("Deal does not belong to this lender.");
    if (
      pool.status === LoanPoolStatus.SOLD ||
      pool.status === LoanPoolStatus.ARCHIVED ||
      pool.status === LoanPoolStatus.TRANSFERRED ||
      pool.status === LoanPoolStatus.LOCKED
    ) {
      throw new Error("Pool is closed for new assets.");
    }
    if (deal.poolId) throw new Error("Deal is already assigned to a pool.");

    const eventType =
      pool.poolType === LoanPoolType.SECURITIZATION
        ? ContractTransactionEventType.LENDER_SALE_TO_TRUST
        : ContractTransactionEventType.POOL_TRANSFER;

    const hash = auditHash([dealId, poolId, eventType, new Date().toISOString()]);
    const hdc = await NegotiableInstrumentService.validateHDCRequirements(dealId);
    if (!hdc.isHDCQualified) {
      throw new Error(`HDC validation failed: ${hdc.defects.join(" ")}`);
    }

    const withRecourse = pool.recourseStatus === "WITH_RECOURSE";
    const instrumentTransfer = await NegotiableInstrumentService.endorseAndTransferInstrument(
      dealId,
      poolId,
      withRecourse,
      deal.lenderId,
    );
    await NegotiableInstrumentService.generateTransferWarrantyCertificate(dealId, poolId);

    await prisma.$transaction([
      prisma.deal.update({
        where: { id: dealId },
        data: {
          poolId,
          secondaryMarketStatus: SecondaryMarketStatus.SOLD,
        },
      }),
      prisma.contractTransactionEvent.create({
        data: {
          dealId,
          eventType,
          fromEntityId: deal.lenderId,
          toEntityId: poolId,
          auditHash: hash,
          instrumentTransferEventId: instrumentTransfer.id,
        },
      }),
    ]);
    await NotificationService.createNotification({
      workspaceId: deal.lenderId,
      dealId,
      type: "DEAL_POOLED",
      title: "Deal added to pool",
      message: `Deal moved into pool ${pool.poolName}.`,
    });
  },
};
