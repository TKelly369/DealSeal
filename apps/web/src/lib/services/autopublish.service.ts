import type { DocumentType, GeneratedDocumentType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { extractConsummatedTerms, type ConsummatedDealData } from "@/lib/ai/services/contract-extraction";

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

function toDecimal(n: number): string {
  return n.toFixed(2);
}

async function logAutopublishCustody(
  tx: Prisma.TransactionClient,
  dealId: string,
  userId: string,
  actorRole: string,
  metadata: Prisma.InputJsonValue,
) {
  await tx.documentCustodyEvent.create({
    data: {
      dealId,
      documentId: null,
      eventType: "GENERATED",
      actorUserId: userId,
      actorRole,
      metadata,
    },
  });
}

async function reconcileDealFromConsummated(dealId: string, data: ConsummatedDealData) {
  const buyer = data.parties.find((p) => p.role === "BUYER");
  if (!buyer) throw new Error("Consummated data must include a BUYER.");

  const existingBuyer = await prisma.dealParty.findFirst({
    where: { dealId, role: "BUYER" },
  });
  if (existingBuyer) {
    await prisma.dealParty.update({
      where: { id: existingBuyer.id },
      data: {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        address: buyer.address,
        creditTier: buyer.creditTier ?? null,
      },
    });
  } else {
    await prisma.dealParty.create({
      data: {
        dealId,
        role: "BUYER",
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        address: buyer.address,
        creditTier: buyer.creditTier ?? null,
      },
    });
  }

  await prisma.vehicle.update({
    where: { dealId },
    data: {
      year: data.vehicle.year,
      make: data.vehicle.make,
      model: data.vehicle.model,
      vin: data.vehicle.vin,
      mileage: data.vehicle.mileage,
      condition: data.vehicle.condition,
    },
  });

  await prisma.dealFinancials.update({
    where: { dealId },
    data: {
      amountFinanced: toDecimal(data.financials.amountFinanced),
      ltv: toDecimal(data.financials.ltv),
      maxLtv: toDecimal(data.financials.maxLtv),
      taxes: toDecimal(data.financials.taxes),
      fees: toDecimal(data.financials.fees),
      gap: toDecimal(data.financials.gap),
      warranty: toDecimal(data.financials.warranty),
      totalSalePrice: toDecimal(data.financials.totalSalePrice),
    },
  });
}

const UCSP_SEQUENCE: DocumentType[] = [
  "UCSP_BUYERS_ORDER",
  "UCSP_STATE_DISCLOSURE",
  "UCSP_ASSIGNMENT",
  "UCSP_TITLE_APPLICATION",
  "BMV_LIEN_CERT",
];

export const AutopublishService = {
  async generateUniformClosingPackage(dealId: string, userId: string, actorRole: string) {
    const dealCheck = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { authoritativeContract: true },
    });
    if (!dealCheck) throw new Error("Deal not found.");

    if (dealCheck.status === "CLOSING_PACKAGE_READY") {
      return { skipped: true as const };
    }
    if (
      dealCheck.status !== "FIRST_GREEN_PASSED" &&
      dealCheck.status !== "AUTHORITATIVE_LOCK" &&
      dealCheck.status !== "GENERATING_CLOSING_PACKAGE"
    ) {
      throw new Error("Autopublish requires first green pass (or resume from generating).");
    }
    if (!dealCheck.authoritativeContract) {
      throw new Error("Authoritative contract missing.");
    }

    const authoritativeContractHash = dealCheck.authoritativeContract.authoritativeContractHash;
    const authId = dealCheck.authoritativeContract.id;

    await prisma.deal.update({
      where: { id: dealId },
      data: { status: "GENERATING_CLOSING_PACKAGE" },
    });

    try {
      const signedDoc = await prisma.generatedDocument.findFirst({
        where: { dealId, documentType: "RISC_SIGNED" },
        orderBy: { version: "desc" },
      });
      const signedUrl = signedDoc?.fileUrl ?? "";

      const consummated = await extractConsummatedTerms(signedUrl, dealId);
      await reconcileDealFromConsummated(dealId, consummated);

      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
          dealer: { include: { dealerProfile: true } },
          lender: { include: { lenderProfile: true } },
          authoritativeContract: true,
        },
      });
      if (!deal?.authoritativeContract) throw new Error("Deal state lost during autopublish.");

      const stateComplianceProfile = {
        titlingState: deal.state,
        dealerOperatingStates: deal.dealer.dealerProfile?.operatingStates ?? [],
        lenderLicensedStates: deal.lender.lenderProfile?.licensedStates ?? [],
        lenderLegalName: deal.lender.lenderProfile?.legalName ?? deal.lender.name,
        dealerLegalName: deal.dealer.dealerProfile?.legalName ?? deal.dealer.name,
      };

      const versionByType: Partial<Record<DocumentType, number>> = {};
      for (const docType of UCSP_SEQUENCE) {
        versionByType[docType] = await nextDocVersion(dealId, docType);
      }
      const manifestVersion = await nextDocVersion(dealId, "UCSP_CLOSING_MANIFEST");

      const createdIds: string[] = [];

      await prisma.$transaction(async (tx) => {
        await tx.deal.update({
          where: { id: dealId },
          data: {
            consummatedData: consummated as unknown as Prisma.InputJsonValue,
          },
        });

        for (const docType of UCSP_SEQUENCE) {
          const version = versionByType[docType]!;
          const slug = docType.toLowerCase().replace(/_/g, "-");
          const fileUrl = `/mock-uploads/${dealId}/ucsp-${slug}-v${version}.pdf`;

          const valuesSnapshot: Prisma.InputJsonValue = {
            uniformClosingPackage: true,
            stateComplianceProfile,
            consummatedAt: new Date().toISOString(),
            apr: consummated.financials.apr ?? null,
            termMonths: consummated.financials.termMonths ?? null,
            paymentAmount: consummated.financials.paymentAmount ?? null,
          };

          if (docType === "BMV_LIEN_CERT") {
            (valuesSnapshot as Record<string, unknown>).lienholderJustification =
              `Certified for BMV per locked RISC. Authoritative SHA-256: ${authoritativeContractHash}.`;
          }

          const row = await tx.generatedDocument.create({
            data: {
              dealId,
              authoritativeContractId: authId,
              type: legacyTypeFor(docType),
              documentType: docType,
              fileUrl,
              version,
              isAuthoritative: true,
              authoritativeContractHash,
              valuesSnapshot,
            },
          });
          createdIds.push(row.id);

          await tx.documentCustodyEvent.create({
            data: {
              dealId,
              documentId: row.id,
              eventType: "GENERATED",
              actorUserId: userId,
              actorRole,
              metadata: {
                autopublish: true,
                documentType: docType,
                authoritativeContractHash,
              },
            },
          });
        }

        const manifest = await tx.generatedDocument.create({
          data: {
            dealId,
            authoritativeContractId: authId,
            type: legacyTypeFor("UCSP_CLOSING_MANIFEST"),
            documentType: "UCSP_CLOSING_MANIFEST",
            fileUrl: `/mock-uploads/${dealId}/ucsp-closing-manifest-v${manifestVersion}.json`,
            version: manifestVersion,
            isAuthoritative: true,
            authoritativeContractHash,
            valuesSnapshot: {
              documentIds: createdIds,
              authoritativeContractHash,
              sealedAt: new Date().toISOString(),
            },
          },
        });
        createdIds.push(manifest.id);

        await logAutopublishCustody(tx, dealId, userId, actorRole, {
          autopublishComplete: true,
          authoritativeContractHash,
          manifestId: manifest.id,
          packageDocumentIds: createdIds,
        });

        await tx.deal.update({
          where: { id: dealId },
          data: { status: "CLOSING_PACKAGE_READY" },
        });
      });

      return { skipped: false as const, documentIds: createdIds };
    } catch (e) {
      await prisma.deal.update({
        where: { id: dealId },
        data: { status: "FIRST_GREEN_PASSED" },
      });
      throw e;
    }
  },
};
