import type { DealComplianceStatus, DealStatus } from "@/generated/prisma";

export type LenderDashboardDealRow = {
  id: string;
  status: DealStatus;
  state: string;
  complianceStatus: DealComplianceStatus;
  initialDisclosureAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  dealer: { name: string };
  _count: { generatedDocuments: number };
  amendments: { id: string }[];
};

const PENDING_LENDER_REVIEW: DealStatus[] = ["RISC_UNSIGNED_REVIEW", "RISC_LENDER_FINAL"];

const TYPICALLY_NEEDS_DOCS: DealStatus[] = [
  "AUTHORIZED_FOR_STRUCTURING",
  "GREEN_STAGE",
  "RISC_UNSIGNED_REVIEW",
  "GENERATING_CLOSING_PACKAGE",
];

const MS_DAY = 86_400_000;

export function isInLenderPipeline(deal: LenderDashboardDealRow): boolean {
  return deal.status !== "CONSUMMATED";
}

export function dealNeedsDocumentsRow(deal: LenderDashboardDealRow): boolean {
  if (deal.status === "DISCLOSURE_REQUIRED") return false;
  if (TYPICALLY_NEEDS_DOCS.includes(deal.status)) return true;
  if (deal.initialDisclosureAcceptedAt && deal._count.generatedDocuments < 1) return true;
  return false;
}

export function dealPendingReview(deal: LenderDashboardDealRow): boolean {
  return PENDING_LENDER_REVIEW.includes(deal.status) || deal.amendments.length > 0;
}

export function complianceRygForPipeline(deals: LenderDashboardDealRow[]) {
  const pipeline = deals.filter(isInLenderPipeline);
  return {
    red: pipeline.filter((d) => d.complianceStatus === "BLOCKED").length,
    yellow: pipeline.filter((d) => d.complianceStatus === "WARNING").length,
    green: pipeline.filter((d) => d.complianceStatus === "COMPLIANT").length,
    total: pipeline.length,
  };
}

export function newSubmissionsWindow(deals: LenderDashboardDealRow[], days = 14): LenderDashboardDealRow[] {
  const cutoff = Date.now() - days * MS_DAY;
  return deals
    .filter((d) => d.createdAt.getTime() >= cutoff && d.status !== "CONSUMMATED")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Previous calendar day in UTC (alerts feed). */
export function previousUtcDayRange(now = new Date()): { start: Date; end: Date } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  const start = new Date(d);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}
