import type { DealComplianceStatus, DealStatus } from "@/generated/prisma";

/** Minimal deal row for dealer dashboard metrics (from `listDealsForDealerDashboard`). */
export type DealerDashboardDealRow = {
  id: string;
  status: DealStatus;
  state: string;
  complianceStatus: DealComplianceStatus;
  initialDisclosureAcceptedAt: Date | null;
  lender: { name: string };
  _count: { generatedDocuments: number };
};

const LENDER_PENDING: DealStatus[] = ["RISC_UNSIGNED_REVIEW", "RISC_LENDER_FINAL"];

const TYPICALLY_NEEDS_DOCS: DealStatus[] = [
  "AUTHORIZED_FOR_STRUCTURING",
  "GREEN_STAGE",
  "RISC_UNSIGNED_REVIEW",
  "GENERATING_CLOSING_PACKAGE",
];

export function computeDealerDashboardMetrics(deals: DealerDashboardDealRow[]) {
  const activeDeals = deals.filter((d) => d.status !== "CONSUMMATED").length;

  const dealsNeedingDocuments = deals.filter((d) => {
    if (d.status === "DISCLOSURE_REQUIRED") return false;
    if (TYPICALLY_NEEDS_DOCS.includes(d.status)) return true;
    if (d.initialDisclosureAcceptedAt && d._count.generatedDocuments < 1) return true;
    return false;
  }).length;

  const dealStatusRyg = {
    red: deals.filter((d) => d.complianceStatus === "BLOCKED").length,
    yellow: deals.filter((d) => d.complianceStatus === "WARNING").length,
    green: deals.filter((d) => d.complianceStatus === "COMPLIANT").length,
  };

  const pendingLenderSubmissions = deals.filter((d) => LENDER_PENDING.includes(d.status)).length;

  const missingInitialDisclosureDeals = deals.filter(
    (d) => d.status === "DISCLOSURE_REQUIRED" && d.initialDisclosureAcceptedAt == null,
  );

  return {
    activeDeals,
    dealsNeedingDocuments,
    dealStatusRyg,
    pendingLenderSubmissions,
    missingInitialDisclosureDeals,
  };
}

export function isAiComplianceAlert(type: string, severity: string): boolean {
  const t = type.toLowerCase();
  if (t.includes("ai") && t.includes("compliance")) return true;
  if (t.includes("compliance") && (t.includes("rule") || t.includes("check"))) return true;
  if (severity === "CRITICAL") return true;
  return false;
}
