import type { DocumentType, GeneratedDocumentType, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";

type BrandingOptions = {
  includeBranding: boolean;
  logoUrl?: string;
};

function legacyTypeFor(dt: DocumentType): GeneratedDocumentType {
  switch (dt) {
    case "UCSP_BUYERS_ORDER":
      return "BUYERS_ORDER";
    case "UCSP_ASSIGNMENT":
    case "UCSP_TITLE_APPLICATION":
    case "BMV_LIEN_CERT":
      return "FUNDING_PACKET";
    case "UCSP_STATE_DISCLOSURE":
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

function requiredDocsForStateAndProgram(state: string, lenderRuleHints: string[]): DocumentType[] {
  const docs: DocumentType[] = ["UCSP_BUYERS_ORDER", "UCSP_STATE_DISCLOSURE", "UCSP_TITLE_APPLICATION"];
  if (lenderRuleHints.some((k) => k.includes("assignment"))) docs.push("UCSP_ASSIGNMENT");
  if (state === "TX" || state === "FL" || state === "OH") docs.push("BMV_LIEN_CERT");
  return Array.from(new Set(docs));
}

export const AiDealOrchestratorService = {
  async generateDealJacketDocs(dealId: string, userId: string, actorRole: string, options: BrandingOptions) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        dealer: { include: { dealerProfile: true, dealerOnboardingAnswers: true } },
        lender: { include: { lenderOnboardingAnswers: true } },
      },
    });
    if (!deal) throw new Error("Deal not found.");
    if (deal.status !== "AUTHORIZED_FOR_STRUCTURING" && deal.status !== "GREEN_STAGE") {
      throw new Error("AI deal-jacket generation is available only after Initial Disclosure acceptance.");
    }

    const lenderHints = deal.lender.lenderOnboardingAnswers.map((a) => a.questionKey.toLowerCase());
    const docs = requiredDocsForStateAndProgram(deal.state, lenderHints);

    const created = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const docType of docs) {
        const version = await nextDocVersion(dealId, docType);
        const slug = docType.toLowerCase().replace(/_/g, "-");
        const row = await tx.generatedDocument.create({
          data: {
            dealId,
            authoritativeContractId: null,
            type: legacyTypeFor(docType),
            documentType: docType,
            fileUrl: `/mock-uploads/${dealId}/ai-${slug}-v${version}.pdf`,
            version,
            valuesSnapshot: {
              aiGenerated: true,
              generationStage: "PRE_LENDER_APPROVAL_ESTIMATE",
              stateProfile: deal.governingStateProfile ?? {},
              uccAware: true,
              sourceInputs: {
                dealershipName: deal.dealer.dealerProfile?.legalName ?? deal.dealer.name,
                state: deal.state,
                lender: deal.lender.name,
              },
              branding: options.includeBranding
                ? {
                    enabled: true,
                    dealershipName: deal.dealer.dealerProfile?.legalName ?? deal.dealer.name,
                    logoUrl: options.logoUrl ?? null,
                  }
                : { enabled: false },
            } as Prisma.InputJsonValue,
          },
        });
        ids.push(row.id);

        await tx.documentCustodyEvent.create({
          data: {
            dealId,
            documentId: row.id,
            eventType: "GENERATED",
            actorUserId: userId,
            actorRole,
            metadata: {
              event: "AI_DEAL_JACKET_DOC_GENERATED",
              documentType: docType,
              intuitiveAgent: true,
              includeBranding: options.includeBranding,
              state: deal.state,
            } as Prisma.InputJsonValue,
          },
        });
      }

      if (deal.status === "AUTHORIZED_FOR_STRUCTURING") {
        await tx.deal.update({
          where: { id: dealId },
          data: { status: "GREEN_STAGE" },
        });
      }

      return ids;
    });

    await NotificationService.createNotification({
      workspaceId: deal.dealerId,
      dealId,
      type: "DEAL_UPDATE",
      title: "AI generated deal-jacket docs",
      message: `Generated ${created.length} required state/lender deal-jacket document(s).`,
    });
    await NotificationService.createNotification({
      workspaceId: deal.lenderId,
      dealId,
      type: "DEAL_UPDATE",
      title: "AI docs ready for review",
      message: "AI generated pre-approval deal-jacket docs from transaction parameters.",
    });

    return { generatedDocumentIds: created, generatedCount: created.length };
  },
};
