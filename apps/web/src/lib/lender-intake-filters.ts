import type { DealComplianceStatus, DealStatus } from "@/generated/prisma";

export const INTAKE_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "green", label: "Green-light ready" },
  { key: "yellow", label: "Yellow-light warnings" },
  { key: "red", label: "Red-light blocked" },
  { key: "missing_credit", label: "Missing credit report" },
  { key: "missing_disclosure", label: "Missing disclosure" },
  { key: "missing_signature", label: "Missing signature" },
  { key: "pending_funding", label: "Pending funding decision" },
] as const;

export type IntakeFilterKey = (typeof INTAKE_FILTERS)[number]["key"];

const FILTER_KEYS = new Set(INTAKE_FILTERS.map((f) => f.key));

export function normalizeIntakeFilter(raw: string | undefined): IntakeFilterKey {
  if (raw && FILTER_KEYS.has(raw as IntakeFilterKey)) return raw as IntakeFilterKey;
  return "all";
}

const NEW_DAYS = 14;
const MS_DAY = 86_400_000;

const GREEN_LIGHT_STATUSES: DealStatus[] = [
  "AUTHORIZED_FOR_STRUCTURING",
  "GREEN_STAGE",
  "FIRST_GREEN_PASSED",
];

const POST_RISC_STRUCTURAL: DealStatus[] = [
  "FIRST_GREEN_PASSED",
  "AUTHORITATIVE_LOCK",
  "GENERATING_CLOSING_PACKAGE",
  "CLOSING_PACKAGE_READY",
  "CONSUMMATED",
];

/** Row shape returned by deal-intake Prisma select (filter helpers). */
export type IntakeDealFilterRow = {
  status: DealStatus;
  complianceStatus: DealComplianceStatus;
  createdAt: Date;
  initialDisclosureAcceptedAt: Date | null;
  parties: { creditTier: string | null }[];
  authoritativeContract: { signatureStatus: string } | null;
  riscSignedDocs: { id: string }[];
};

function isNewDeal(deal: Pick<IntakeDealFilterRow, "createdAt">, now: number): boolean {
  return deal.createdAt.getTime() >= now - NEW_DAYS * MS_DAY;
}

function greenLightReady(deal: IntakeDealFilterRow): boolean {
  return deal.complianceStatus === "COMPLIANT" && GREEN_LIGHT_STATUSES.includes(deal.status);
}

function buyerCreditTierMissing(deal: IntakeDealFilterRow): boolean {
  const buyer = deal.parties[0];
  const tier = buyer?.creditTier?.trim() ?? "";
  return tier.length === 0;
}

function missingDisclosure(deal: IntakeDealFilterRow): boolean {
  return deal.status === "DISCLOSURE_REQUIRED" || deal.initialDisclosureAcceptedAt == null;
}

function missingSignature(deal: IntakeDealFilterRow): boolean {
  if (deal.status === "RISC_UNSIGNED_REVIEW" || deal.status === "RISC_LENDER_FINAL") return true;
  const executed = deal.authoritativeContract?.signatureStatus === "EXECUTED_RISC";
  const hasRiscSigned = deal.riscSignedDocs.length > 0;
  if (POST_RISC_STRUCTURAL.includes(deal.status)) {
    return !executed && !hasRiscSigned;
  }
  return false;
}

function pendingFundingDecision(deal: IntakeDealFilterRow): boolean {
  return deal.status === "CLOSING_PACKAGE_READY" || deal.status === "GENERATING_CLOSING_PACKAGE";
}

export function dealMatchesIntakeFilter(deal: IntakeDealFilterRow, filter: IntakeFilterKey, now = Date.now()): boolean {
  switch (filter) {
    case "all":
      return true;
    case "new":
      return isNewDeal(deal, now);
    case "green":
      return greenLightReady(deal);
    case "yellow":
      return deal.complianceStatus === "WARNING";
    case "red":
      return deal.complianceStatus === "BLOCKED";
    case "missing_credit":
      return deal.status !== "DISCLOSURE_REQUIRED" && buyerCreditTierMissing(deal);
    case "missing_disclosure":
      return missingDisclosure(deal);
    case "missing_signature":
      return missingSignature(deal);
    case "pending_funding":
      return pendingFundingDecision(deal);
    default:
      return true;
  }
}

export function countByIntakeFilter(deals: IntakeDealFilterRow[], now = Date.now()): Record<IntakeFilterKey, number> {
  const counts = {} as Record<IntakeFilterKey, number>;
  for (const f of INTAKE_FILTERS) {
    counts[f.key] = 0;
  }
  for (const d of deals) {
    for (const f of INTAKE_FILTERS) {
      if (dealMatchesIntakeFilter(d, f.key, now)) counts[f.key] += 1;
    }
  }
  return counts;
}
