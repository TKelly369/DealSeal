import crypto from "crypto";
import type { DocumentType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { DealLifecycleStatusSchema, GreenStageDocTypeSchema } from "@/lib/services/deal-workflow.zod";
import type { GeneratedDocumentType } from "@/generated/prisma";
import { AutopublishService } from "@/lib/services/autopublish.service";
import { validateUCCArticle9 } from "@/lib/services/compliance.service";
import { SecondaryMarketService } from "@/lib/services/secondary-market.service";
import { NotificationService } from "@/lib/services/notification.service";

function legacyTypeFor(dt: DocumentType): GeneratedDocumentType {
  switch (dt) {
    case "PROCESS_DISCLOSURE":
    case "INSURANCE":
    case "UCSP_STATE_DISCLOSURE":
      return "DISCLOSURE";
    case "DEALER_UPLOAD":
    case "UCSP_BUYERS_ORDER":
      return "BUYERS_ORDER";
    case "RISC_UNSIGNED":
    case "RISC_LENDER_FINAL":
    case "RISC_SIGNED":
      return "CONTRACT";
    case "BMV_LIEN_CERT":
    case "BUYER_PACKAGE":
    case "UCSP_ASSIGNMENT":
    case "UCSP_TITLE_APPLICATION":
    case "UCSP_CLOSING_MANIFEST":
      return "FUNDING_PACKET";
    default:
      return "DISCLOSURE";
  }
}

async function nextDocVersion(dealId: string, documentType: DocumentType): Promise<number> {
  const agg = await prisma.generatedDocument.aggregate({
    where: { dealId, documentType },
    _max: { version: true },
  });
  return (agg._max.version ?? 0) + 1;
}

async function logCustody(
  tx: Prisma.TransactionClient,
  args: {
    dealId: string;
    documentId?: string | null;
    eventType: Prisma.DocumentCustodyEventCreateInput["eventType"];
    actorUserId: string;
    actorRole: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.documentCustodyEvent.create({
    data: {
      dealId: args.dealId,
      documentId: args.documentId ?? null,
      eventType: args.eventType,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      metadata: args.metadata ?? {},
    },
  });
}

function assertStatus(current: string, expected: string, action: string) {
  const parsed = DealLifecycleStatusSchema.safeParse(current);
  if (!parsed.success) throw new Error("Invalid deal status.");
  if (current !== expected) {
    throw new Error(`${action} is not allowed while deal is in ${current}. Expected ${expected}.`);
  }
}

export const DealWorkflowService = {
  async getDealForActor(dealId: string, actorWorkspaceId: string, side: "dealer" | "lender") {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        generatedDocuments: { orderBy: { createdAt: "asc" } },
        custodyEvents: { orderBy: { timestamp: "asc" } },
        authoritativeContract: true,
        vehicle: true,
        parties: true,
        financials: true,
        amendments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!deal) return null;
    if (side === "dealer" && deal.dealerId !== actorWorkspaceId) return null;
    if (side === "lender" && deal.lenderId !== actorWorkspaceId) return null;
    return deal;
  },

  async acknowledgeDisclosure(dealId: string, userId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new Error("Deal not found.");
      assertStatus(deal.status, "DISCLOSURE_REQUIRED", "Disclosure acknowledgment");

      const version = await nextDocVersion(dealId, "PROCESS_DISCLOSURE");
      const fileUrl = `/mock-uploads/process-disclosure-${dealId}.pdf`;
      const doc = await tx.generatedDocument.create({
        data: {
          dealId,
          authoritativeContractId: null,
          type: legacyTypeFor("PROCESS_DISCLOSURE"),
          documentType: "PROCESS_DISCLOSURE",
          fileUrl,
          version,
          valuesSnapshot: { title: "DealSeal Governing Process Disclosure", generatedAt: new Date().toISOString() },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "GENERATED",
        actorUserId: userId,
        actorRole,
        metadata: { documentType: "PROCESS_DISCLOSURE", fileUrl },
      });

      return tx.deal.update({
        where: { id: dealId },
        data: { status: "GREEN_STAGE" },
      });
    });
  },

  async uploadGreenStageDoc(
    dealId: string,
    input: { fileName: string; docType: string },
    userId: string,
    actorRole: string,
  ) {
    const docType = GreenStageDocTypeSchema.parse(input.docType);
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new Error("Deal not found.");
      assertStatus(deal.status, "GREEN_STAGE", "Green-stage document upload");

      const version = await nextDocVersion(dealId, docType);
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.pdf";
      const fileUrl = `/mock-uploads/${dealId}/${docType.toLowerCase()}-v${version}-${safeName}`;

      const doc = await tx.generatedDocument.create({
        data: {
          dealId,
          authoritativeContractId: null,
          type: legacyTypeFor(docType),
          documentType: docType,
          fileUrl,
          version,
          valuesSnapshot: { originalFileName: input.fileName },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "UPLOADED",
        actorUserId: userId,
        actorRole,
        metadata: { documentType: docType, fileUrl },
      });

      return doc;
    });
  },

  async submitUnsignedRISC(dealId: string, input: { fileName: string }, userId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new Error("Deal not found.");
      assertStatus(deal.status, "GREEN_STAGE", "Unsigned RISC submission");

      const version = await nextDocVersion(dealId, "RISC_UNSIGNED");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "risc-unsigned.pdf";
      const fileUrl = `/mock-uploads/${dealId}/risc-unsigned-v${version}-${safeName}`;

      const doc = await tx.generatedDocument.create({
        data: {
          dealId,
          authoritativeContractId: null,
          type: legacyTypeFor("RISC_UNSIGNED"),
          documentType: "RISC_UNSIGNED",
          fileUrl,
          version,
          valuesSnapshot: { originalFileName: input.fileName },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "UPLOADED",
        actorUserId: userId,
        actorRole,
        metadata: { documentType: "RISC_UNSIGNED", fileUrl },
      });

      await tx.deal.update({
        where: { id: dealId },
        data: { status: "RISC_UNSIGNED_REVIEW" },
      });

      return doc;
    });
  },

  async lenderApproveAndSendFinalRISC(
    dealId: string,
    input: { fileName: string },
    userId: string,
    actorRole: string,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new Error("Deal not found.");
      assertStatus(deal.status, "RISC_UNSIGNED_REVIEW", "Lender final RISC");

      const version = await nextDocVersion(dealId, "RISC_LENDER_FINAL");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "risc-lender-final.pdf";
      const fileUrl = `/mock-uploads/${dealId}/risc-lender-final-v${version}-${safeName}`;

      const doc = await tx.generatedDocument.create({
        data: {
          dealId,
          authoritativeContractId: null,
          type: legacyTypeFor("RISC_LENDER_FINAL"),
          documentType: "RISC_LENDER_FINAL",
          fileUrl,
          version,
          valuesSnapshot: {
            originalFileName: input.fileName,
            securityAgreementPresent: true,
            securityAgreementSummary: "Retail installment security interest in the described vehicle collateral.",
          },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "UPLOADED",
        actorUserId: userId,
        actorRole,
        metadata: { documentType: "RISC_LENDER_FINAL", fileUrl },
      });

      await tx.deal.update({
        where: { id: dealId },
        data: { status: "RISC_LENDER_FINAL" },
      });

      return { doc, dealerId: deal.dealerId, lenderId: deal.lenderId };
    });

    await NotificationService.createNotification({
      workspaceId: result.dealerId,
      dealId,
      type: "LENDER_RISC_FINALIZED",
      title: "Final contract ready",
      message: "Your lender posted the final RISC. Print, explain, and collect signatures.",
    });
    await NotificationService.createNotification({
      workspaceId: result.lenderId,
      dealId,
      type: "LENDER_RISC_FINALIZED",
      title: "Final RISC sent to dealer",
      message: "Dealer has been notified that the final RISC is ready for signatures.",
    });

    return result.doc;
  },

  async uploadSignedRISCAndLock(dealId: string, input: { fileName: string }, userId: string, actorRole: string) {
    const ucc = await validateUCCArticle9(dealId);
    if (!ucc.compliant) {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { dealerId: true, lenderId: true },
      });
      if (deal) {
        const msg = `Post-sign lock blocked: ${ucc.reasons.join(" ")}`.trim();
        await Promise.all([
          NotificationService.createNotification({
            workspaceId: deal.dealerId,
            dealId,
            type: "COMPLIANCE_BLOCKER",
            title: "Deal lock blocked",
            message: msg,
          }),
          NotificationService.createNotification({
            workspaceId: deal.lenderId,
            dealId,
            type: "COMPLIANCE_BLOCKER",
            title: "Deal lock blocked",
            message: msg,
          }),
        ]);
      }
      throw new Error(
        `UCC validation failed: ${ucc.reasons.join(" ")}`.trim() ||
          "Collateral and contract package must match the deal file before lock.",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { vehicle: true, parties: true, financials: true },
      });
      if (!deal) throw new Error("Deal not found.");
      assertStatus(deal.status, "RISC_LENDER_FINAL", "Signed RISC / authoritative lock");

      const buyer = deal.parties.find((p) => p.role === "BUYER");
      if (!deal.vehicle || !buyer) throw new Error("Deal is missing vehicle or buyer.");

      const uccCollateralDescription = {
        vin: deal.vehicle.vin.trim().toUpperCase(),
        year: deal.vehicle.year,
        make: deal.vehicle.make,
        model: deal.vehicle.model,
      };
      const uccDebtorName = `${buyer.firstName} ${buyer.lastName}`.replace(/\s+/g, " ").trim();

      const version = await nextDocVersion(dealId, "RISC_SIGNED");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "risc-signed.pdf";
      const fileUrl = `/mock-uploads/${dealId}/risc-signed-v${version}-${safeName}`;

      const hashInput = JSON.stringify({
        dealId,
        fileUrl,
        lockedAt: new Date().toISOString(),
        riscFile: input.fileName,
      });
      const contentHash = crypto.createHash("sha256").update(hashInput).digest("hex");

      const authoritative = await tx.authoritativeContract.upsert({
        where: { dealId },
        create: {
          dealId,
          version: 1,
          contentHash,
          governingLaw: deal.state,
          signatureStatus: "EXECUTED_RISC",
          isTransferableRecord: true,
          uccCollateralDescription,
          uccDebtorName,
        },
        update: {
          version: { increment: 1 },
          contentHash,
          signatureStatus: "EXECUTED_RISC",
          isTransferableRecord: true,
          uccCollateralDescription,
          uccDebtorName,
        },
      });

      const doc = await tx.generatedDocument.create({
        data: {
          dealId,
          authoritativeContractId: authoritative.id,
          type: legacyTypeFor("RISC_SIGNED"),
          documentType: "RISC_SIGNED",
          fileUrl,
          version,
          isAuthoritative: true,
          authoritativeContractHash: contentHash,
          valuesSnapshot: {
            originalFileName: input.fileName,
            authoritativeHash: contentHash,
          },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "LOCKED",
        actorUserId: userId,
        actorRole,
        metadata: { documentType: "RISC_SIGNED", contentHash, fileUrl },
      });

      await tx.deal.update({
        where: { id: dealId },
        data: { status: "AUTHORITATIVE_LOCK" },
      });

      return { doc, contentHash };
    });

    await SecondaryMarketService.assignContractToLender(dealId);
    await SecondaryMarketService.classifyLoanForSale(dealId);

    const postLockDeal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { dealerId: true, lenderId: true },
    });
    if (postLockDeal) {
      await Promise.all([
        NotificationService.createNotification({
          workspaceId: postLockDeal.lenderId,
          dealId,
          type: "DEAL_AUTHORITATIVE_LOCKED",
          title: "Deal locked",
          message: "A signed RISC has been locked and is ready for post-lock package processing.",
        }),
        NotificationService.createNotification({
          workspaceId: postLockDeal.dealerId,
          dealId,
          type: "DEAL_AUTHORITATIVE_LOCKED",
          title: "Deal locked",
          message: "Your signed contract is locked. DealSeal is generating your closing package.",
        }),
      ]);
    }

    await AutopublishService.generateUniformClosingPackage(dealId, userId, actorRole);
    return result;
  },

  async generateBMVCertification(_dealId: string, _userId: string, _actorRole: string) {
    throw new Error(
      "BMV lien certification is generated automatically as part of the Uniform Closing Package after authoritative lock.",
    );
  },

  async generateBuyerPackage(_dealId: string, _userId: string, _actorRole: string) {
    throw new Error(
      "Closing packages are produced by the Uniform Closing Package (see UCSP_CLOSING_MANIFEST after lock).",
    );
  },
};
