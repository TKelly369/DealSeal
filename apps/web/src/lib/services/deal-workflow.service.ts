import crypto from "crypto";
import type { DocumentType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { DealLifecycleStatusSchema, GreenStageDocTypeSchema } from "@/lib/services/deal-workflow.zod";
import type { GeneratedDocumentType } from "@/generated/prisma";
import { AutopublishService } from "@/lib/services/autopublish.service";
import { validateUCCArticle9 } from "@/lib/services/compliance.service";
import { SecondaryMarketService } from "@/lib/services/secondary-market.service";
import { NotificationService } from "@/lib/services/notification.service";
import { NegotiableInstrumentService } from "@/lib/services/negotiable-instrument.service";
import { WebhookService } from "@/lib/services/webhook.service";
import { DealAlertService } from "@/lib/services/deal-alert.service";

type DisclosureMetadataInput = {
  signerName: string;
  dateSigned: string;
  dealerRepresentative: string;
  dealershipName: string;
  stateProfile: string;
  fileName: string;
};

function legacyTypeFor(dt: DocumentType): GeneratedDocumentType {
  switch (dt) {
    case "INITIAL_DISCLOSURE_SIGNED":
    case "CHANGE_SUMMARY_DISCLOSURE":
    case "PROCESS_DISCLOSURE":
    case "INSURANCE":
    case "UCSP_STATE_DISCLOSURE":
      return "DISCLOSURE";
    case "DEALER_UPLOAD":
    case "CREDIT_REPORT_UPLOAD":
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

function captureMaterialTerms(deal: {
  id: string;
  state: string;
  lenderId: string;
  parties: Array<{ role: string; firstName: string; lastName: string; address: string }>;
  vehicle: { vin: string; year: number; make: string; model: string } | null;
  financials:
    | {
        totalSalePrice: unknown;
        taxes: unknown;
        fees: unknown;
        amountFinanced: unknown;
        gap: unknown;
        warranty: unknown;
      }
    | null;
}) {
  const buyer = deal.parties.find((p) => p.role === "BUYER");
  return {
    dealId: deal.id,
    contractState: deal.state,
    deliveryState: deal.state,
    lenderAssignee: deal.lenderId,
    buyerName: buyer ? `${buyer.firstName} ${buyer.lastName}`.trim() : null,
    buyerAddress: buyer?.address ?? null,
    collateralVin: deal.vehicle?.vin ?? null,
    vehicleLabel: deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : null,
    totalSalePrice: deal.financials ? Number(deal.financials.totalSalePrice) : null,
    taxes: deal.financials ? Number(deal.financials.taxes) : null,
    fees: deal.financials ? Number(deal.financials.fees) : null,
    amountFinanced: deal.financials ? Number(deal.financials.amountFinanced) : null,
    gap: deal.financials ? Number(deal.financials.gap) : null,
    warranty: deal.financials ? Number(deal.financials.warranty) : null,
  };
}

function buildChangeSummary(preliminary: Record<string, unknown>, finalTerms: Record<string, unknown>) {
  const fields = [
    "totalSalePrice",
    "taxes",
    "fees",
    "amountFinanced",
    "gap",
    "warranty",
    "collateralVin",
    "buyerName",
    "contractState",
    "deliveryState",
    "lenderAssignee",
  ];
  const changes = fields
    .map((field) => {
      const from = preliminary[field];
      const to = finalTerms[field];
      const changed = JSON.stringify(from ?? null) !== JSON.stringify(to ?? null);
      return {
        field,
        preliminary: from ?? null,
        final: to ?? null,
        changed,
        explanation: changed
          ? `Field changed from preliminary submission to lender-approved final package for ${field}.`
          : "No material change detected.",
      };
    })
    .filter((row) => row.changed);
  return { hasChanges: changes.length > 0, changes };
}

export const DealWorkflowService = {
  async getDealForActor(dealId: string, actorWorkspaceId: string, side: "dealer" | "lender") {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        generatedDocuments: { orderBy: { createdAt: "asc" } },
        custodyEvents: { orderBy: { timestamp: "asc" } },
        complianceChecks: { orderBy: { createdAt: "asc" } },
        negotiableInstrument: { select: { hdcStatus: true, hdcDefects: true } },
        authoritativeContract: true,
        dealerLenderLink: { select: { lenderRuleProfile: true, status: true } },
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

  async acknowledgeDisclosure(dealId: string, input: DisclosureMetadataInput, userId: string, actorRole: string) {
    const signerName = input.signerName.trim();
    const dateSigned = input.dateSigned.trim();
    const dealerRepresentative = input.dealerRepresentative.trim();
    if (!signerName || !dateSigned || !dealerRepresentative) {
      throw new Error("Signed Initial Disclosure requires signer name, date signed, and dealer representative.");
    }
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new Error("Deal not found.");
      assertStatus(deal.status, "DISCLOSURE_REQUIRED", "Disclosure acknowledgment");

      const version = await nextDocVersion(dealId, "INITIAL_DISCLOSURE_SIGNED");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "initial-disclosure-signed.pdf";
      const fileUrl = `/mock-uploads/${dealId}/initial-disclosure-signed-v${version}-${safeName}`;
      const signedAt = new Date(dateSigned);
      if (Number.isNaN(signedAt.getTime())) {
        throw new Error("Date signed is invalid.");
      }
      const disclosureHash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            dealId,
            signerName,
            dateSigned: signedAt.toISOString(),
            fileUrl,
            dealershipName: input.dealershipName,
            dealerRepresentative,
            stateProfile: input.stateProfile,
          }),
        )
        .digest("hex");
      const doc = await tx.generatedDocument.create({
        data: {
          dealId,
          authoritativeContractId: null,
          type: legacyTypeFor("INITIAL_DISCLOSURE_SIGNED"),
          documentType: "INITIAL_DISCLOSURE_SIGNED",
          fileUrl,
          version,
          valuesSnapshot: {
            title: "DealSeal Initial Disclosure",
            immutable: true,
            signerName,
            dateSigned: signedAt.toISOString(),
            uploadUserId: userId,
            dealershipName: input.dealershipName,
            dealerRepresentative,
            stateProfile: input.stateProfile,
            disclosureHash,
          },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "INITIAL_DISCLOSURE_ACCEPTED",
        actorUserId: userId,
        actorRole,
        metadata: {
          event: "INITIAL_DISCLOSURE_ACCEPTED",
          documentType: "INITIAL_DISCLOSURE_SIGNED",
          fileUrl,
          signerName,
          dateSigned: signedAt.toISOString(),
          disclosureHash,
          dealershipName: input.dealershipName,
          dealerRepresentative,
          stateProfile: input.stateProfile,
        },
      });

      return tx.deal.update({
        where: { id: dealId },
        data: {
          status: "AUTHORIZED_FOR_STRUCTURING",
          initialDisclosureAcceptedAt: new Date(),
          initialDisclosureHash: disclosureHash,
          initialDisclosureSignerName: signerName,
          dealerRepresentativeName: dealerRepresentative,
          governingStateProfile: {
            profileKey: `${deal.state}:${input.stateProfile}`.toLowerCase(),
            selectedAt: new Date().toISOString(),
            state: deal.state,
            dealershipName: input.dealershipName,
            stateProfile: input.stateProfile,
          } as Prisma.InputJsonValue,
        },
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
      if (deal.status !== "AUTHORIZED_FOR_STRUCTURING" && deal.status !== "GREEN_STAGE") {
        throw new Error(`Green-stage document upload is not allowed while deal is in ${deal.status}. Expected AUTHORIZED_FOR_STRUCTURING.`);
      }

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
          valuesSnapshot: {
            originalFileName: input.fileName,
            signatureState: "UNSIGNED",
            pricingState: "ESTIMATED_PRE_SIGNATURE",
            ...(docType === "CREDIT_REPORT_UPLOAD"
              ? { dealerUploadCategory: "CREDIT_REPORT", note: "Dealer-uploaded; DealSeal does not pull credit." }
              : {}),
          },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "UPLOADED",
        actorUserId: userId,
        actorRole,
        metadata: {
          documentType: docType,
          fileUrl,
          ...(docType === "CREDIT_REPORT_UPLOAD" ? { creditReportUpload: true } : {}),
        },
      });

      return doc;
    });
  },

  async submitUnsignedRISC(dealId: string, input: { fileName: string }, userId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: dealId } });
      if (!deal) throw new Error("Deal not found.");
      if (deal.status !== "AUTHORIZED_FOR_STRUCTURING" && deal.status !== "GREEN_STAGE") {
        throw new Error(`Unsigned RISC submission is not allowed while deal is in ${deal.status}. Expected AUTHORIZED_FOR_STRUCTURING.`);
      }

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
          valuesSnapshot: {
            originalFileName: input.fileName,
            signatureState: "UNSIGNED",
            pricingState: "ESTIMATED_PRE_SIGNATURE",
          },
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
        data: {
          status: "RISC_UNSIGNED_REVIEW",
          preliminarySubmittedTerms: captureMaterialTerms({
            id: deal.id,
            state: deal.state,
            lenderId: deal.lenderId,
            parties: await tx.dealParty.findMany({ where: { dealId } }),
            vehicle: await tx.vehicle.findUnique({ where: { dealId } }),
            financials: await tx.dealFinancials.findUnique({ where: { dealId } }),
          }) as Prisma.InputJsonValue,
        },
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
            signatureState: "UNSIGNED_AWAITING_EXECUTION",
            aiPackageReconciliation: "PENDING",
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
        data: {
          status: "RISC_LENDER_FINAL",
          lenderApprovedTerms: captureMaterialTerms({
            id: deal.id,
            state: deal.state,
            lenderId: deal.lenderId,
            parties: await tx.dealParty.findMany({ where: { dealId } }),
            vehicle: await tx.vehicle.findUnique({ where: { dealId } }),
            financials: await tx.dealFinancials.findUnique({ where: { dealId } }),
          }) as Prisma.InputJsonValue,
        },
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
    await Promise.all([
      WebhookService.dispatchEvent(result.dealerId, "LENDER_APPROVED", {
        dealId,
        lenderId: result.lenderId,
        status: "RISC_LENDER_FINAL",
      }),
      WebhookService.dispatchEvent(result.lenderId, "LENDER_APPROVED", {
        dealId,
        lenderId: result.lenderId,
        status: "RISC_LENDER_FINAL",
      }),
    ]);
    await DealAlertService.generatePreSignatureAlerts(dealId, userId, actorRole);

    return result.doc;
  },

  async uploadSignedRISCAndLock(dealId: string, input: { fileName: string }, userId: string, actorRole: string) {
    const unresolved = await prisma.dealAlert.count({
      where: { dealId, status: "OPEN" },
    });
    if (unresolved > 0) {
      throw new Error(
        `AI monitor flagged ${unresolved} alert(s). Clear them or override with a file note before locking the governing record.`,
      );
    }

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
      const authoritativeContractHash = crypto.createHash("sha256").update(hashInput).digest("hex");

      const authoritative = await tx.authoritativeContract.upsert({
        where: { dealId },
        create: {
          dealId,
          version: 1,
          authoritativeContractHash,
          governingLaw: deal.state,
          signatureStatus: "EXECUTED_RISC",
          isTransferableRecord: true,
          uccCollateralDescription,
          uccDebtorName,
        },
        update: {
          version: { increment: 1 },
          authoritativeContractHash,
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
          authoritativeContractHash,
          valuesSnapshot: {
            originalFileName: input.fileName,
            authoritativeHash: authoritativeContractHash,
          },
        },
      });

      await logCustody(tx, {
        dealId,
        documentId: doc.id,
        eventType: "LOCKED",
        actorUserId: userId,
        actorRole,
        metadata: { documentType: "RISC_SIGNED", authoritativeContractHash, fileUrl },
      });

      const prelim = (deal.preliminarySubmittedTerms as Record<string, unknown> | null) ?? {};
      const finalTerms = captureMaterialTerms({
        id: deal.id,
        state: deal.state,
        lenderId: deal.lenderId,
        parties: await tx.dealParty.findMany({ where: { dealId } }),
        vehicle: deal.vehicle,
        financials: deal.financials,
      }) as Record<string, unknown>;
      const changeSummary = buildChangeSummary(prelim, finalTerms);
      if (changeSummary.hasChanges) {
        const changeVersion = await nextDocVersion(dealId, "CHANGE_SUMMARY_DISCLOSURE");
        const changeSummaryHash = crypto
          .createHash("sha256")
          .update(JSON.stringify({ dealId, preliminary: prelim, finalTerms, changes: changeSummary.changes }))
          .digest("hex");
        const changeDoc = await tx.generatedDocument.create({
          data: {
            dealId,
            authoritativeContractId: authoritative.id,
            type: "DISCLOSURE",
            documentType: "CHANGE_SUMMARY_DISCLOSURE",
            fileUrl: `/mock-uploads/${dealId}/change-summary-disclosure-v${changeVersion}.json`,
            version: changeVersion,
            isAuthoritative: true,
            authoritativeContractHash,
            valuesSnapshot: {
              preliminary: prelim,
              finalTerms,
              changes: changeSummary.changes,
              acknowledgmentRequired: true,
              generatedAt: new Date().toISOString(),
              changeSummaryHash,
            } as Prisma.InputJsonValue,
          },
        });
        await logCustody(tx, {
          dealId,
          documentId: changeDoc.id,
          eventType: "CHANGE_SUMMARY_GENERATED",
          actorUserId: userId,
          actorRole,
          metadata: {
            event: "CHANGE_SUMMARY_GENERATED",
            changeCount: changeSummary.changes.length,
            changeSummaryHash,
          },
        });
      }

      await tx.deal.update({
        where: { id: dealId },
        data: { status: "FIRST_GREEN_PASSED" },
      });

      return { doc, authoritativeContractHash };
    });

    await SecondaryMarketService.assignContractToLender(dealId);
    await NegotiableInstrumentService.validateHDCRequirements(dealId);
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
            title: "First green passed",
            message: "Signed governing RISC is locked and first green is passed. Package reconciliation is beginning.",
        }),
        NotificationService.createNotification({
          workspaceId: postLockDeal.dealerId,
          dealId,
          type: "DEAL_AUTHORITATIVE_LOCKED",
            title: "First green passed",
            message: "Your signed governing contract is locked and first green is passed. DealSeal is aligning the full package.",
        }),
      ]);
      await Promise.all([
        WebhookService.dispatchEvent(postLockDeal.dealerId, "DEAL_LOCKED", {
          dealId,
          status: "FIRST_GREEN_PASSED",
        }),
        WebhookService.dispatchEvent(postLockDeal.lenderId, "DEAL_LOCKED", {
          dealId,
          status: "FIRST_GREEN_PASSED",
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
