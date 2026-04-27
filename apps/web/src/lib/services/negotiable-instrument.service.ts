import { Prisma, InstrumentTransferType, NegotiableInstrumentType } from "@/generated/prisma";
import { prisma } from "@/lib/db";

function toJsonValue(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

export const NegotiableInstrumentService = {
  async ensureNegotiableInstrument(dealId: string, payToOrderOf: string) {
    return prisma.negotiableInstrument.upsert({
      where: { dealId },
      create: {
        dealId,
        instrumentType: NegotiableInstrumentType.RISC_AS_NOTE,
        payToOrderOf: payToOrderOf.trim(),
        isElectronicNote: true,
        eNoteControlLocation: "DealSeal eVault",
      },
      update: {
        payToOrderOf: payToOrderOf.trim(),
        eNoteControlLocation: "DealSeal eVault",
      },
    });
  },

  async validateHDCRequirements(dealId: string): Promise<{ isHDCQualified: boolean; defects: string[] }> {
    const defects: string[] = [];
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        negotiableInstrument: true,
        contractTransactionEvents: true,
        complianceChecks: true,
      },
    });
    if (!deal?.negotiableInstrument) {
      defects.push("Negotiable instrument record is missing.");
      return { isHDCQualified: false, defects };
    }
    const ni = deal.negotiableInstrument;
    if (!ni.payToOrderOf || ni.payToOrderOf.trim().length < 2) {
      defects.push("Instrument is not properly payable to an identified party.");
    }
    if (ni.isElectronicNote && !ni.eNoteControlLocation) {
      defects.push("eNote control location is missing.");
    }
    if (deal.contractTransactionEvents.length === 0) {
      defects.push("No value transfer event exists for this instrument.");
    }
    const hasBlocker = deal.complianceChecks.some((c) => c.status === "BLOCKED");
    if (hasBlocker) {
      defects.push("Known compliance blockers may signal defenses/claims.");
    }
    return { isHDCQualified: defects.length === 0, defects };
  },

  async endorseAndTransferInstrument(dealId: string, toEntityId: string, withRecourse: boolean, fromEntityId?: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { negotiableInstrument: true },
    });
    if (!deal?.negotiableInstrument) throw new Error("Negotiable instrument not found.");

    const latestTransfer = await prisma.instrumentTransferEvent.findFirst({
      where: { dealId },
      orderBy: { transferDate: "desc" },
    });
    const from = fromEntityId ?? latestTransfer?.toEntityId ?? deal.dealerId;
    const transferType = withRecourse
      ? InstrumentTransferType.ENDORSEMENT
      : InstrumentTransferType.SALE_WITHOUT_RECOURSE;
    const endorsementLanguage = `Pay to the order of ${toEntityId}${
      withRecourse ? "" : " WITHOUT RECOURSE"
    }.`;

    return prisma.instrumentTransferEvent.create({
      data: {
        dealId,
        instrumentId: deal.negotiableInstrument.id,
        fromEntityId: from,
        toEntityId,
        transferType,
        endorsementLanguage,
      },
    });
  },

  async generateTransferWarrantyCertificate(dealId: string, poolId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { authoritativeContract: true, loanPool: true },
    });
    if (!deal?.authoritativeContract) throw new Error("Authoritative contract is required.");

    const agg = await prisma.generatedDocument.aggregate({
      where: { dealId, documentType: null, type: "FUNDING_PACKET" },
      _max: { version: true },
    });
    const version = (agg._max.version ?? 0) + 1;
    return prisma.generatedDocument.create({
      data: {
        dealId,
        authoritativeContractId: deal.authoritativeContract.id,
        type: "FUNDING_PACKET",
        documentType: null,
        fileUrl: `/mock-uploads/${dealId}/transfer-warranty-certificate-v${version}.pdf`,
        version,
        isAuthoritative: true,
        authoritativeContractHash: deal.authoritativeContract.contentHash,
        valuesSnapshot: toJsonValue({
          certificateType: "UCC_3_416_TRANSFER_WARRANTY",
          poolId,
          warranties: [
            "Seller has good title.",
            "Instrument is authentic and enforceable.",
            "Seller has no knowledge of insolvency or borrower defenses.",
          ],
        }),
      },
    });
  },
};

