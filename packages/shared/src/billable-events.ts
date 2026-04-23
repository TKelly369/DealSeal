export const BillableEventTypes = [
  "DEAL_SEALED",
  "DOCUMENT_EXPORT",
  "CERTIFIED_PACKAGE",
  "API_CALL",
  "PRIORITY_PROCESSING",
  "ANALYTICS_DASHBOARD",
  "ANALYTICS_REPORT",
  "ADDON_RISK_SCORING",
  "ADDON_STRUCTURING",
  "ADDON_ERROR_DETECTION",
  "SUBSCRIPTION_PERIOD",
  "SUBSCRIPTION_PLAN_ASSIGNED",
  "PREMIUM_COMPLIANCE",
] as const;

export type BillableEventType = (typeof BillableEventTypes)[number];

export type SubscriptionTierId = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface DefaultPriceBook {
  subscription: Record<
    SubscriptionTierId,
    { monthlyUsd: number; includedDeals: number }
  >;
  perDealSealUsd: { min: number; max: number };
  documentExportUsd: { min: number; max: number };
  certifiedPackageUsd: { min: number; max: number };
  addonsMonthlyUsd: {
    riskScoring: number;
    structuringAutomation: number;
    errorDetection: number;
  };
  apiPerCallUsd: { min: number; max: number };
  apiFlatMonthlyUsd: { min: number; max: number };
  priorityPerDealUsd: { min: number; max: number };
  analyticsDashboardMonthlyUsd: number;
  analyticsReportUsd: { min: number; max: number };
  enterpriseMonthlyUsd: { min: number; max: number };
}

export const DEFAULT_PRICE_BOOK: DefaultPriceBook = {
  subscription: {
    STARTER: { monthlyUsd: 99, includedDeals: 20 },
    PROFESSIONAL: { monthlyUsd: 299, includedDeals: 100 },
    ENTERPRISE: { monthlyUsd: 799, includedDeals: 10_000 },
  },
  perDealSealUsd: { min: 2, max: 5 },
  documentExportUsd: { min: 1, max: 3 },
  certifiedPackageUsd: { min: 5, max: 10 },
  addonsMonthlyUsd: {
    riskScoring: 49,
    structuringAutomation: 49,
    errorDetection: 29,
  },
  apiPerCallUsd: { min: 0.01, max: 0.05 },
  apiFlatMonthlyUsd: { min: 99, max: 499 },
  priorityPerDealUsd: { min: 0.5, max: 2 },
  analyticsDashboardMonthlyUsd: 49,
  analyticsReportUsd: { min: 5, max: 25 },
  enterpriseMonthlyUsd: { min: 2000, max: 10_000 },
};
