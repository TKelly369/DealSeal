import type { BillableEventType, Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_PRICE_BOOK } from "@dealseal/shared";

export interface PricingLineInput {
  eventType: BillableEventType;
  quantity: number;
  /** Optional override from admin rule resolution */
  unitAmountUsd?: number;
  metadata?: Record<string, string>;
}

export interface PricingLineResult {
  eventType: BillableEventType;
  quantity: number;
  unitAmountUsd: number;
  lineTotalUsd: number;
  metadata?: Record<string, string>;
}

/**
 * Resolves unit price: org-specific active PricingRule, else default price book.
 * Hybrid subscription + usage: subscription records SUBSCRIPTION_PERIOD; usage meters other events.
 */
export async function resolveUnitUsd(
  db: PrismaClient,
  orgId: string | null,
  eventType: BillableEventType,
): Promise<number> {
  if (orgId) {
    const now = new Date();
    const rule = await db.pricingRule.findFirst({
      where: {
        orgId,
        eventType,
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (rule) return Number(rule.unitAmountUsd);
  }

  const book = DEFAULT_PRICE_BOOK;
  switch (eventType) {
    case "DEAL_SEALED":
      return book.perDealSealUsd.min;
    case "DOCUMENT_EXPORT":
      return book.documentExportUsd.min;
    case "CERTIFIED_PACKAGE":
      return book.certifiedPackageUsd.min;
    case "API_CALL":
      return book.apiPerCallUsd.min;
    case "PRIORITY_PROCESSING":
      return book.priorityPerDealUsd.min;
    case "ANALYTICS_DASHBOARD":
      return book.analyticsDashboardMonthlyUsd;
    case "ANALYTICS_REPORT":
      return book.analyticsReportUsd.min;
    case "ADDON_RISK_SCORING":
      return book.addonsMonthlyUsd.riskScoring;
    case "ADDON_STRUCTURING":
      return book.addonsMonthlyUsd.structuringAutomation;
    case "ADDON_ERROR_DETECTION":
      return book.addonsMonthlyUsd.errorDetection;
    case "SUBSCRIPTION_PERIOD":
      return book.subscription.STARTER.monthlyUsd;
    case "SUBSCRIPTION_PLAN_ASSIGNED":
      return 0;
    case "PREMIUM_COMPLIANCE":
      return book.addonsMonthlyUsd.riskScoring;
    default:
      return 0;
  }
}

export async function previewCharges(
  db: PrismaClient,
  orgId: string,
  lines: PricingLineInput[],
): Promise<{ currency: "usd"; lines: PricingLineResult[]; subtotalUsd: number }> {
  const out: PricingLineResult[] = [];
  let subtotal = 0;
  for (const line of lines) {
    const unit =
      line.unitAmountUsd ??
      (await resolveUnitUsd(db, orgId, line.eventType));
    const total = unit * line.quantity;
    subtotal += total;
    out.push({
      eventType: line.eventType,
      quantity: line.quantity,
      unitAmountUsd: unit,
      lineTotalUsd: total,
      metadata: line.metadata,
    });
  }
  return { currency: "usd", lines: out, subtotalUsd: subtotal };
}

export async function recordUsage(
  db: PrismaClient,
  input: {
    orgId: string;
    transactionId?: string;
    eventType: BillableEventType;
    quantity: number;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const unit = await resolveUnitUsd(db, input.orgId, input.eventType);
  const amount = unit * input.quantity;
  await db.usageEvent.create({
    data: {
      orgId: input.orgId,
      transactionId: input.transactionId,
      eventType: input.eventType,
      quantity: input.quantity,
      unitAmountUsd: unit,
      amountUsd: amount,
      idempotencyKey: input.idempotencyKey,
      metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
