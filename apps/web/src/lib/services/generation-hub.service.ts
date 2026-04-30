import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { suggestDealDraftFromAI } from "@/lib/ai/services/deal-draft-ai";
import { LenderOpsService } from "@/lib/services/lender-ops.service";

type HubActor = "dealer" | "lender" | "admin";

function toDecimal(input?: string | null) {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  return new Prisma.Decimal(raw);
}

export const GenerationHubService = {
  async listDealsForActor(actor: HubActor, workspaceId: string) {
    const where =
      actor === "dealer"
        ? { dealerId: workspaceId }
        : actor === "lender"
          ? { lenderId: workspaceId }
          : {};
    return prisma.deal.findMany({
      where,
      select: {
        id: true,
        state: true,
        status: true,
        updatedAt: true,
        dealer: { select: { name: true } },
        lender: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  },

  async getDealForActor(actor: HubActor, workspaceId: string, dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        lender: { select: { name: true } },
        financials: true,
        parties: true,
        vehicle: true,
        generatedDocuments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!deal) return null;
    if (actor === "dealer" && deal.dealerId !== workspaceId) return null;
    if (actor === "lender" && deal.lenderId !== workspaceId) return null;
    return deal;
  },

  async applyCentralInput(
    actor: HubActor,
    workspaceId: string,
    dealId: string,
    input: {
      amountFinanced?: string;
      taxesAmount?: string;
      feesAmount?: string;
      downPaymentAmount?: string;
      totalSalePrice?: string;
      pricingNotes?: string;
      taxesNotes?: string;
      feesNotes?: string;
      addOnsNotes?: string;
      tradeInNotes?: string;
      aiQuestions?: string;
    },
    actorUserId?: string,
  ) {
    const deal = await this.getDealForActor(actor, workspaceId, dealId);
    if (!deal) throw new Error("Deal not found.");

    const amountFinanced = toDecimal(input.amountFinanced);
    const taxes = toDecimal(input.taxesAmount);
    const fees = toDecimal(input.feesAmount);
    const totalSalePrice = toDecimal(input.totalSalePrice);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.dealFinancials.findUnique({ where: { dealId } });
      if (existing) {
        await tx.dealFinancials.update({
          where: { dealId },
          data: {
            amountFinanced: amountFinanced ?? existing.amountFinanced,
            taxes: taxes ?? existing.taxes,
            fees: fees ?? existing.fees,
            totalSalePrice: totalSalePrice ?? existing.totalSalePrice,
          },
        });
      } else if (amountFinanced || taxes || fees || totalSalePrice) {
        const af = amountFinanced ?? new Prisma.Decimal(0);
        const t = taxes ?? new Prisma.Decimal(0);
        const f = fees ?? new Prisma.Decimal(0);
        const total = totalSalePrice ?? af.plus(t).plus(f);
        await tx.dealFinancials.create({
          data: {
            dealId,
            amountFinanced: af,
            taxes: t,
            fees: f,
            totalSalePrice: total,
            ltv: new Prisma.Decimal(0.85),
            maxLtv: new Prisma.Decimal(0.9),
            gap: new Prisma.Decimal(0),
            warranty: new Prisma.Decimal(0),
          },
        });
      }

      await tx.deal.update({
        where: { id: dealId },
        data: {
          preliminarySubmittedTerms: {
            centralGenerationHub: true,
            downPaymentAmount: input.downPaymentAmount ?? null,
            pricingNotes: input.pricingNotes ?? "",
            taxesNotes: input.taxesNotes ?? "",
            feesNotes: input.feesNotes ?? "",
            addOnsNotes: input.addOnsNotes ?? "",
            tradeInNotes: input.tradeInNotes ?? "",
            aiQuestions: input.aiQuestions ?? "",
            updatedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      await tx.dealAuditEvent.create({
        data: {
          dealId,
          workspaceId,
          actorUserId: actorUserId ?? null,
          actorRole: actor,
          authMethod: "SESSION",
          action: "GENERATION_HUB_INPUT_APPLIED",
          entityType: "Deal",
          entityId: dealId,
          payloadJson: {
            amountFinanced: input.amountFinanced ?? null,
            taxesAmount: input.taxesAmount ?? null,
            feesAmount: input.feesAmount ?? null,
            totalSalePrice: input.totalSalePrice ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });
  },

  async runMismatchValidation(actor: HubActor, workspaceId: string, dealId: string, actorUserId?: string) {
    const deal = await this.getDealForActor(actor, workspaceId, dealId);
    if (!deal) throw new Error("Deal not found.");
    if (!deal.financials) return { mismatch: false, message: "No financials yet." };

    const af = Number(deal.financials.amountFinanced);
    const taxes = Number(deal.financials.taxes);
    const fees = Number(deal.financials.fees);
    const total = Number(deal.financials.totalSalePrice);
    const expected = af + taxes + fees;
    const mismatch = Number.isFinite(total) && Number.isFinite(expected) && Math.abs(total - expected) > 1;
    if (!mismatch) return { mismatch: false, message: "No mismatch detected." };

    await prisma.dealAlert.create({
      data: {
        dealId,
        workspaceId: deal.dealerId,
        type: "GENERATION_HUB_MISMATCH",
        severity: "WARNING",
        title: "Generation hub mismatch",
        message: "Total sale price does not match amount financed + taxes + fees.",
        metadata: { totalSalePrice: total, expectedTotal: expected },
        audits: {
          create: {
            action: "ALERT_ISSUED",
            actorUserId,
            actorRole: actor,
            note: "Generated by generation hub mismatch validator.",
          },
        },
      },
    });
    return { mismatch: true, message: "Mismatch detected and alert issued." };
  },

  async aiPopulate(actor: HubActor, workspaceId: string, dealId: string, actorUserId?: string) {
    const deal = await this.getDealForActor(actor, workspaceId, dealId);
    if (!deal) throw new Error("Deal not found.");
    const buyer = deal.parties.find((p) => p.role === "BUYER");
    const ai = await suggestDealDraftFromAI({
      state: deal.state,
      buyerName: buyer ? `${buyer.firstName} ${buyer.lastName}` : "Unknown buyer",
      vehicleLabel: deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : "Unknown vehicle",
      lenderName: deal.lender?.name,
      existing: {
        amountFinanced: deal.financials ? String(deal.financials.amountFinanced) : "",
        taxesAmount: deal.financials ? String(deal.financials.taxes) : "",
        feesAmount: deal.financials ? String(deal.financials.fees) : "",
        totalSalePrice: deal.financials ? String(deal.financials.totalSalePrice) : "",
      },
    });
    if (!ai.ok) throw new Error(ai.error);

    await this.applyCentralInput(
      actor,
      workspaceId,
      dealId,
      {
        amountFinanced: ai.data.amountFinanced,
        taxesAmount: ai.data.taxesAmount,
        feesAmount: ai.data.feesAmount,
        totalSalePrice: ai.data.totalSalePrice,
        pricingNotes: ai.data.pricingNotes,
        taxesNotes: ai.data.taxesNotes,
        feesNotes: ai.data.feesNotes,
        addOnsNotes: ai.data.addOnsNotes,
        tradeInNotes: ai.data.tradeInNotes,
      },
      actorUserId,
    );
    return ai.data;
  },

  async uploadDocForAiAnalysis(
    actor: HubActor,
    workspaceId: string,
    dealId: string,
    fileName: string,
    actorUserId?: string,
  ) {
    const deal = await this.getDealForActor(actor, workspaceId, dealId);
    if (!deal) throw new Error("Deal not found.");
    const versionAgg = await prisma.generatedDocument.aggregate({
      where: { dealId, documentType: "DEALER_UPLOAD" },
      _max: { version: true },
    });
    const version = (versionAgg._max.version ?? 0) + 1;
    const doc = await prisma.generatedDocument.create({
      data: {
        dealId,
        authoritativeContractId: null,
        type: "BUYERS_ORDER",
        documentType: "DEALER_UPLOAD",
        fileUrl: `/mock-uploads/${dealId}/generation-hub-${version}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
        version,
        valuesSnapshot: {
          generationHubUpload: true,
          aiAnalysisQueued: true,
          uploadedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.dealAuditEvent.create({
      data: {
        dealId,
        workspaceId,
        actorUserId: actorUserId ?? null,
        actorRole: actor,
        authMethod: "SESSION",
        action: "GENERATION_HUB_DOC_UPLOADED_FOR_AI",
        entityType: "GeneratedDocument",
        entityId: doc.id,
        payloadJson: { fileName, version } as Prisma.InputJsonValue,
      },
    });
    return doc;
  },

  async getSimultaneousEngagementSnapshot(actor: HubActor, workspaceId: string, dealId: string) {
    const deal = await this.getDealForActor(actor, workspaceId, dealId);
    if (!deal) throw new Error("Deal not found.");
    const [openDealerAlerts, lenderOpenTasks, missingItems] = await Promise.all([
      prisma.dealAlert.count({
        where: { dealId, workspaceId: deal.dealerId, status: "OPEN" },
      }),
      prisma.lenderTask.count({
        where: { dealId, lenderId: deal.lenderId, status: { in: ["open", "in_progress", "blocked", "overdue"] } },
      }),
      prisma.missingItemRequest.count({
        where: { dealId, lenderId: deal.lenderId, status: { in: ["requested", "uploaded", "overdue"] } },
      }),
    ]);
    return {
      openDealerAlerts,
      lenderOpenTasks,
      missingItems,
      canSimultaneouslyCloseAndFund: lenderOpenTasks === 0 && missingItems === 0,
    };
  },

  async automateSimultaneousEngagement(actor: HubActor, workspaceId: string, dealId: string, actorUserId?: string) {
    const deal = await this.getDealForActor(actor, workspaceId, dealId);
    if (!deal) throw new Error("Deal not found.");

    const dueSoon = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await Promise.all([
      LenderOpsService.createTask({
        lenderId: deal.lenderId,
        dealId: deal.id,
        dealerId: deal.dealerId,
        title: "Simultaneous close/fund validation",
        description:
          "Run parallel lender/dealer close-and-fund checklist from Generation Hub; clear blockers or document exceptions.",
        category: "funding",
        priority: "high",
        dueDate: dueSoon,
        source: "generation_hub",
      }),
      prisma.dealAlert.create({
        data: {
          dealId: deal.id,
          workspaceId: deal.dealerId,
          type: "SIMULTANEOUS_ENGAGEMENT_STARTED",
          severity: "WARNING",
          title: "Simultaneous close/fund workflow active",
          message:
            "Dealer and lender are now engaged in parallel automation. Keep documents/numbers synchronized to prevent funding delay.",
          status: "OPEN",
          metadata: {
            source: "generation_hub",
            lenderId: deal.lenderId,
            dueBy: dueSoon.toISOString(),
          },
        },
      }),
      prisma.dealAuditEvent.create({
        data: {
          dealId: deal.id,
          workspaceId,
          actorUserId: actorUserId ?? null,
          actorRole: actor,
          authMethod: "SESSION",
          action: "GENERATION_HUB_SIMULTANEOUS_ENGAGEMENT_STARTED",
          entityType: "Deal",
          entityId: deal.id,
          payloadJson: {
            dueBy: dueSoon.toISOString(),
            lenderId: deal.lenderId,
            dealerId: deal.dealerId,
          } as Prisma.InputJsonValue,
        },
      }),
    ]);

    return this.getSimultaneousEngagementSnapshot(actor, workspaceId, dealId);
  },
};
