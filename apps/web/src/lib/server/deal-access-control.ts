import type { Deal, DealFinancials, DealStatus, UserRole } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export type SessionUser = {
  id: string;
  role: UserRole;
  workspaceId: string;
};

const DEALER_ROLES: UserRole[] = ["DEALER_ADMIN", "ADMIN", "USER", "PLATFORM_ADMIN"];
const LENDER_ROLES: UserRole[] = ["LENDER_ADMIN", "PLATFORM_ADMIN"];

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
};

function parseRuleProfile(raw: unknown): LenderRuleProfileShape {
  if (!raw || typeof raw !== "object") return {};
  return raw as LenderRuleProfileShape;
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
): Promise<{ deal: Deal & { financials: DealFinancials | null }; financialsView: DealFinancials | null } | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      financials: true,
      dealerLenderLink: true,
    },
  });
  if (!deal) return null;

  if (session.role === "PLATFORM_ADMIN") {
    return { deal, financialsView: deal.financials };
  }

  if (DEALER_ROLES.includes(session.role) && deal.dealerId === session.workspaceId) {
    return { deal, financialsView: deal.financials };
  }

  if (
    (LENDER_ROLES.includes(session.role) || session.role === "USER") &&
    deal.lenderId === session.workspaceId
  ) {
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
  if (!row || row.deal.dealerId !== session.workspaceId) {
    throw new Error("FORBIDDEN_DEAL_ACCESS");
  }
  if (!["DEALER_ADMIN", "ADMIN", "USER", "PLATFORM_ADMIN"].includes(session.role)) {
    throw new Error("FORBIDDEN_DEAL_ACCESS");
  }
  return row.deal;
}
