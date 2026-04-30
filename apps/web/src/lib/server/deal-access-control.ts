import type { Deal, DealFinancials, DealerLenderLink, DealStatus, UserRole } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";

export type SessionUser = {
  id: string;
  role: UserRole;
  workspaceId: string;
};

/** Dealer-tenant deal access (workspace must match dealerId). */
const DEALER_ROLES: UserRole[] = [
  "DEALER_USER",
  "DEALER_MANAGER",
  "ADMIN_USER",
  "CUSTODIAN_ADMIN",
  "SUPER_ADMIN",
];

/** Lender-tenant deal access (workspace must match lenderId). */
const LENDER_ROLES: UserRole[] = [
  "LENDER_USER",
  "LENDER_MANAGER",
  "ADMIN_USER",
  "CUSTODIAN_ADMIN",
  "SUPER_ADMIN",
];

/** Lender may see structured financials only after the deal has left early structuring gates. */
const LENDER_FINANCIAL_VISIBLE: DealStatus[] = [
  "RISC_LENDER_FINAL",
  "FIRST_GREEN_PASSED",
  "AUTHORITATIVE_LOCK",
  "GENERATING_CLOSING_PACKAGE",
  "CLOSING_PACKAGE_READY",
  "CONSUMMATED",
];

export type LenderRuleProfileShape = {
  showDealerFeeBreakdown?: boolean;
  /** When false, lender cannot open custodial view of dealer-uploaded credit reports. Default: allowed. */
  allowLenderCreditReportView?: boolean;
  /** When false, lender cannot download dealer-uploaded credit reports. Default: allowed. */
  allowLenderCreditReportDownload?: boolean;
};

export function parseLenderRuleProfile(raw: unknown): LenderRuleProfileShape {
  if (!raw || typeof raw !== "object") return {};
  return raw as LenderRuleProfileShape;
}

function parseRuleProfile(raw: unknown): LenderRuleProfileShape {
  return parseLenderRuleProfile(raw);
}

/** Hide dealer markup lines unless lender rule profile allows (column-oriented disclosure control). */
export function maskDealFinancialsForLender(
  financials: DealFinancials,
  profile: LenderRuleProfileShape,
): DealFinancials {
  if (profile.showDealerFeeBreakdown) return financials;
  const zero = new Prisma.Decimal(0);
  return {
    ...financials,
    fees: zero,
    gap: zero,
    warranty: zero,
  };
}

/**
 * Strict tenancy check for Deal reads. Returns null if forbidden or missing.
 * For lenders, strips fee breakdown when `lenderRuleProfile.showDealerFeeBreakdown` is false.
 */
export async function getDealForSession(
  session: SessionUser,
  dealId: string,
): Promise<{
  deal: Deal & { financials: DealFinancials | null; dealerLenderLink: DealerLenderLink };
  financialsView: DealFinancials | null;
} | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      financials: true,
      dealerLenderLink: true,
    },
  });
  if (!deal) return null;

  /** Platform admins use INTERNAL workspace id — not dealer/lender tenant ids. */
  if (isAdminShellRole(session.role)) {
    return { deal, financialsView: deal.financials };
  }

  if (DEALER_ROLES.includes(session.role) && deal.dealerId === session.workspaceId) {
    return { deal, financialsView: deal.financials };
  }

  if (LENDER_ROLES.includes(session.role) && deal.lenderId === session.workspaceId) {
    if (deal.dealerLenderLink.status !== "APPROVED") return null;
    const profile = parseRuleProfile(deal.dealerLenderLink.lenderRuleProfile);
    const canSeeFinancials = LENDER_FINANCIAL_VISIBLE.includes(deal.status);
    const baseFin = canSeeFinancials ? deal.financials : null;
    const financialsView = baseFin ? maskDealFinancialsForLender(baseFin, profile) : null;
    return { deal, financialsView };
  }

  return null;
}

export async function assertDealerDealAccess(session: SessionUser, dealId: string): Promise<Deal> {
  const row = await getDealForSession(session, dealId);
  if (!row) {
    throw new Error("FORBIDDEN_DEAL_ACCESS");
  }
  const dealerActors: UserRole[] = [...DEALER_ROLES];
  if (!dealerActors.includes(session.role)) {
    throw new Error("FORBIDDEN_DEAL_ACCESS");
  }
  if (!isAdminShellRole(session.role) && row.deal.dealerId !== session.workspaceId) {
    throw new Error("FORBIDDEN_DEAL_ACCESS");
  }
  return row.deal;
}
