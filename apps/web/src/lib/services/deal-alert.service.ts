import { DealAlertSeverity, DealAlertStatus, Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/lib/services/notification.service";

type AlertDraft = {
  type: string;
  severity: DealAlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

function buildMathLegalAlerts(deal: {
  id: string;
  dealerId: string;
  lenderId: string;
  financials: {
    amountFinanced: unknown;
    ltv: unknown;
    maxLtv: unknown;
    taxes: unknown;
    fees: unknown;
    gap: unknown;
    warranty: unknown;
    totalSalePrice: unknown;
  } | null;
  vehicle: { vin: string } | null;
  parties: { role: string; firstName: string; lastName: string }[];
  generatedDocuments: { documentType: string | null }[];
}): AlertDraft[] {
  const alerts: AlertDraft[] = [];
  const fin = deal.financials;
  if (!fin) {
    alerts.push({
      type: "MISSING_FINANCIALS",
      severity: DealAlertSeverity.CRITICAL,
      title: "Financial packet missing",
      message: "AI detected missing deal financials. Confirm financed amount, taxes, fees, and sale price before signatures.",
    });
    return alerts;
  }

  const amountFinanced = Number(fin.amountFinanced);
  const ltv = Number(fin.ltv);
  const maxLtv = Number(fin.maxLtv);
  const taxes = Number(fin.taxes);
  const fees = Number(fin.fees);
  const gap = Number(fin.gap);
  const warranty = Number(fin.warranty);
  const totalSalePrice = Number(fin.totalSalePrice);

  if ([amountFinanced, ltv, maxLtv, taxes, fees, gap, warranty, totalSalePrice].some((n) => !Number.isFinite(n))) {
    alerts.push({
      type: "INVALID_NUMBERS",
      severity: DealAlertSeverity.CRITICAL,
      title: "Math validation failed",
      message: "One or more financial values are invalid. Review all numeric fields before RISC finalization.",
    });
  }

  if (Number.isFinite(ltv) && Number.isFinite(maxLtv) && ltv > maxLtv) {
    alerts.push({
      type: "LTV_THRESHOLD",
      severity: DealAlertSeverity.CRITICAL,
      title: "LTV exceeds lender threshold",
      message: `AI detected LTV ${ltv.toFixed(2)} above max ${maxLtv.toFixed(2)}.`,
      metadata: { ltv, maxLtv },
    });
  }

  if (Number.isFinite(totalSalePrice) && Number.isFinite(amountFinanced) && totalSalePrice < amountFinanced) {
    alerts.push({
      type: "SALE_PRICE_MISMATCH",
      severity: DealAlertSeverity.WARNING,
      title: "Sale price mismatch",
      message: "Total sale price is below amount financed. Confirm contract math and disclosures.",
      metadata: { totalSalePrice, amountFinanced },
    });
  }

  if (Number.isFinite(taxes) && taxes < 0) {
    alerts.push({
      type: "NEGATIVE_TAX",
      severity: DealAlertSeverity.WARNING,
      title: "Negative tax amount detected",
      message: "Tax value appears negative. Confirm deal jacket computations and legal disclosures.",
      metadata: { taxes },
    });
  }

  const buyer = deal.parties.find((p) => p.role === "BUYER");
  if (!buyer || !buyer.firstName || !buyer.lastName) {
    alerts.push({
      type: "BUYER_IDENTITY_GAP",
      severity: DealAlertSeverity.CRITICAL,
      title: "Buyer legal name incomplete",
      message: "Buyer legal identity is incomplete. Confirm buyer details before signatures.",
    });
  }

  if (!deal.vehicle?.vin || deal.vehicle.vin.trim().length < 11) {
    alerts.push({
      type: "VIN_GAP",
      severity: DealAlertSeverity.CRITICAL,
      title: "VIN appears incomplete",
      message: "VIN is missing or incomplete. Verify collateral details before issuing final RISC.",
    });
  }

  const docTypes = new Set(deal.generatedDocuments.map((d) => d.documentType).filter(Boolean));
  if (!docTypes.has("INSURANCE")) {
    alerts.push({
      type: "MISSING_INSURANCE_DOC",
      severity: DealAlertSeverity.WARNING,
      title: "Insurance document missing",
      message: "Insurance proof is not yet in the deal jacket.",
    });
  }
  if (!docTypes.has("DEALER_UPLOAD")) {
    alerts.push({
      type: "MISSING_STIP_DOC",
      severity: DealAlertSeverity.WARNING,
      title: "Additional stipulation docs missing",
      message: "No additional dealer stipulations were found in the jacket.",
    });
  }

  return alerts;
}

export const DealAlertService = {
  async generatePreSignatureAlerts(dealId: string, actorUserId: string, actorRole: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        financials: true,
        vehicle: true,
        parties: true,
        generatedDocuments: true,
      },
    });
    if (!deal) throw new Error("Deal not found.");

    await prisma.dealAlert.updateMany({
      where: { dealId, status: DealAlertStatus.OPEN },
      data: { status: DealAlertStatus.CLEARED, resolvedAt: new Date(), resolutionNote: "Superseded by re-run." },
    });

    const drafts = buildMathLegalAlerts(deal);
    if (drafts.length === 0) return [];

    const members = await prisma.membership.findMany({
      where: { workspaceId: { in: [deal.dealerId, deal.lenderId] } },
      select: { userId: true, workspaceId: true },
    });

    const alerts = [];
    for (const d of drafts) {
      const alert = await prisma.dealAlert.create({
        data: {
          dealId: deal.id,
          workspaceId: deal.dealerId,
          type: d.type,
          severity: d.severity,
          title: d.title,
          message: d.message,
          metadata: (d.metadata ?? {}) as Prisma.InputJsonValue,
          audits: {
            create: {
              action: "ALERT_ISSUED",
              actorUserId,
              actorRole,
              note: "Generated by AI math/legal pre-signature monitor.",
            },
          },
        },
      });
      alerts.push(alert);

      for (const member of members) {
        await NotificationService.createNotification({
          workspaceId: member.workspaceId,
          userId: member.userId,
          dealId: deal.id,
          type: "DEAL_ALERT",
          title: d.title,
          message: d.message,
        });
        await prisma.dealAlertAudit.create({
          data: {
            dealAlertId: alert.id,
            action: "ALERT_SENT",
            actorUserId,
            actorRole,
            recipientUserId: member.userId,
            note: `Notification sent to workspace ${member.workspaceId}`,
          },
        });
      }
    }
    return alerts;
  },

  async getAlertsForDeal(dealId: string) {
    return prisma.dealAlert.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
      include: {
        audits: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  async clearAlert(alertId: string, actorUserId: string, actorRole: string) {
    const updated = await prisma.dealAlert.update({
      where: { id: alertId },
      data: {
        status: "CLEARED",
        resolvedAt: new Date(),
      },
    });
    await prisma.dealAlertAudit.create({
      data: {
        dealAlertId: alertId,
        action: "CLEARED",
        actorUserId,
        actorRole,
      },
    });
    return updated;
  },

  async overrideAlert(alertId: string, note: string, actorUserId: string, actorRole: string) {
    const trimmed = note.trim();
    if (!trimmed) {
      throw new Error("A file note is required to move forward without clearing an alert.");
    }
    const updated = await prisma.dealAlert.update({
      where: { id: alertId },
      data: {
        status: "OVERRIDDEN",
        resolvedAt: new Date(),
        resolutionNote: trimmed,
      },
    });
    await prisma.dealAlertAudit.create({
      data: {
        dealAlertId: alertId,
        action: "OVERRIDDEN",
        actorUserId,
        actorRole,
        note: trimmed,
      },
    });
    return updated;
  },
};

