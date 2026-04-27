import crypto from "crypto";
import { Prisma, AmendmentReason, AmendmentStatus, ContractTransactionEventType } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { AutopublishService } from "@/lib/services/autopublish.service";
import { NotificationService } from "@/lib/services/notification.service";

type AmendmentInput = {
  reason: AmendmentReason;
  amendedFields: Record<string, unknown>;
};

function mergeConsummatedData(
  current: Prisma.JsonValue | null,
  amendedFields: Record<string, unknown>,
): Prisma.InputJsonValue {
  const existing = (current && typeof current === "object" ? current : {}) as Record<string, unknown>;
  return {
    ...existing,
    amendmentOverlay: {
      ...(typeof existing.amendmentOverlay === "object" && existing.amendmentOverlay
        ? (existing.amendmentOverlay as Record<string, unknown>)
        : {}),
      ...amendedFields,
      appliedAt: new Date().toISOString(),
    },
  };
}

export const AmendmentService = {
  async requestAmendment(dealId: string, amendmentData: AmendmentInput, userId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { authoritativeContract: true },
    });
    if (!deal || !deal.authoritativeContract) throw new Error("Deal or authoritative contract not found.");
    if (deal.status !== "AUTHORITATIVE_LOCK" && deal.status !== "CLOSING_PACKAGE_READY") {
      throw new Error("Amendments are allowed only after authoritative lock.");
    }

    const amendment = await prisma.amendment.create({
      data: {
        dealId,
        parentAuthoritativeContractId: deal.authoritativeContract.id,
        reason: amendmentData.reason,
        amendedFields: amendmentData.amendedFields as Prisma.InputJsonValue,
        requestingUserId: userId,
        status: AmendmentStatus.PENDING_LENDER_APPROVAL,
      },
    });

    await NotificationService.createNotification({
      workspaceId: deal.lenderId,
      dealId,
      type: "AMENDMENT_REQUESTED",
      title: "Dealer requested amendment",
      message: "A post-lock amendment request is pending lender approval.",
    });

    return amendment;
  },

  async rejectAmendment(amendmentId: string, userId: string) {
    const amendment = await prisma.amendment.findUnique({
      where: { id: amendmentId },
      include: { deal: true },
    });
    if (!amendment) throw new Error("Amendment not found.");
    if (amendment.status !== AmendmentStatus.PENDING_LENDER_APPROVAL) throw new Error("Amendment is not pending.");

    await prisma.amendment.update({
      where: { id: amendmentId },
      data: {
        status: AmendmentStatus.REJECTED,
        approvingUserId: userId,
      },
    });
    await NotificationService.createNotification({
      workspaceId: amendment.deal.dealerId,
      dealId: amendment.dealId,
      type: "AMENDMENT_REJECTED",
      title: "Amendment rejected",
      message: "Your lender rejected the amendment request.",
    });
  },

  async approveAmendment(amendmentId: string, userId: string, actorRole: string) {
    const now = new Date();
    const amendment = await prisma.amendment.findUnique({
      where: { id: amendmentId },
      include: {
        deal: {
          include: {
            authoritativeContract: true,
            vehicle: true,
            financials: true,
          },
        },
      },
    });
    if (!amendment || !amendment.deal.authoritativeContract) throw new Error("Amendment or parent contract not found.");
    if (amendment.status !== AmendmentStatus.PENDING_LENDER_APPROVAL) throw new Error("Amendment is not pending.");

    const amendedFields = (amendment.amendedFields ?? {}) as Record<string, unknown>;
    const parentHash = amendment.deal.authoritativeContract.contentHash;
    const newHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          dealId: amendment.dealId,
          amendmentId,
          parentHash,
          amendedFields,
          approvedAt: now.toISOString(),
        }),
      )
      .digest("hex");

    await prisma.$transaction(async (tx) => {
      await tx.amendment.update({
        where: { id: amendmentId },
        data: {
          status: AmendmentStatus.APPROVED,
          approvingUserId: userId,
          approvedAt: now,
        },
      });

      if (amendedFields.vehicle && amendment.deal.vehicle) {
        const vehicle = amendedFields.vehicle as Record<string, unknown>;
        await tx.vehicle.update({
          where: { dealId: amendment.dealId },
          data: {
            vin: typeof vehicle.vin === "string" ? vehicle.vin : amendment.deal.vehicle.vin,
            year: typeof vehicle.year === "number" ? vehicle.year : amendment.deal.vehicle.year,
            make: typeof vehicle.make === "string" ? vehicle.make : amendment.deal.vehicle.make,
            model: typeof vehicle.model === "string" ? vehicle.model : amendment.deal.vehicle.model,
          },
        });
      }

      if (amendedFields.financials && amendment.deal.financials) {
        const financials = amendedFields.financials as Record<string, unknown>;
        await tx.dealFinancials.update({
          where: { dealId: amendment.dealId },
          data: {
            amountFinanced:
              typeof financials.amountFinanced === "number"
                ? financials.amountFinanced.toFixed(2)
                : amendment.deal.financials.amountFinanced,
            totalSalePrice:
              typeof financials.totalSalePrice === "number"
                ? financials.totalSalePrice.toFixed(2)
                : amendment.deal.financials.totalSalePrice,
          },
        });
      }

      await tx.deal.update({
        where: { id: amendment.dealId },
        data: {
          consummatedData: mergeConsummatedData(amendment.deal.consummatedData as Prisma.JsonValue | null, amendedFields),
          status: "AUTHORITATIVE_LOCK",
        },
      });

      await tx.authoritativeContract.update({
        where: { id: amendment.parentAuthoritativeContractId },
        data: {
          version: { increment: 1 },
          contentHash: newHash,
          signatureStatus: "EXECUTED_RISC_AMENDED",
        },
      });

      const amendmentDoc = await tx.generatedDocument.create({
        data: {
          dealId: amendment.dealId,
          authoritativeContractId: amendment.parentAuthoritativeContractId,
          amendmentId: amendment.id,
          type: "CONTRACT",
          documentType: null,
          fileUrl: `/mock-uploads/${amendment.dealId}/amendment-${amendment.id}.pdf`,
          version: 1,
          isAuthoritative: true,
          authoritativeContractHash: newHash,
          valuesSnapshot: {
            amendmentId: amendment.id,
            parentAuthoritativeContractId: amendment.parentAuthoritativeContractId,
            parentHash,
            replacementHash: newHash,
            amendedFields: amendedFields as Prisma.InputJsonValue,
          },
        },
      });

      await tx.contractTransactionEvent.create({
        data: {
          dealId: amendment.dealId,
          eventType: ContractTransactionEventType.AMENDMENT_APPROVED,
          fromEntityId: amendment.deal.dealerId,
          toEntityId: amendment.deal.lenderId,
          auditHash: crypto
            .createHash("sha256")
            .update(`${amendment.dealId}|${amendment.id}|amendment-approved|${now.toISOString()}`)
            .digest("hex"),
        },
      });

      await tx.documentCustodyEvent.create({
        data: {
          dealId: amendment.dealId,
          documentId: amendmentDoc.id,
          eventType: "GENERATED",
          actorUserId: userId,
          actorRole,
          metadata: {
            amendmentId: amendment.id,
            parentHash,
            replacementHash: newHash,
          },
        },
      });
    });

    await AutopublishService.generateUniformClosingPackage(amendment.dealId, userId, actorRole);
    await NotificationService.createNotification({
      workspaceId: amendment.deal.dealerId,
      dealId: amendment.dealId,
      type: "AMENDMENT_APPROVED",
      title: "Amendment approved",
      message: "Your lender approved the amendment and regenerated the closing package.",
    });
    await NotificationService.createNotification({
      workspaceId: amendment.deal.lenderId,
      dealId: amendment.dealId,
      type: "AMENDMENT_APPROVED",
      title: "Amendment approved",
      message: "The amended authoritative package has been regenerated.",
    });
  },
};

