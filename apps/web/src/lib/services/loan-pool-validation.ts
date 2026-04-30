import { DealComplianceStatus, DealStatus } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export type DealPoolEligibility = {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
};

/**
 * DealSeal does not score credit — tier filters are lender-defined strings on `DealParty.creditTier`.
 */
export async function evaluateDealForPooling(dealId: string, lenderId: string): Promise<DealPoolEligibility> {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      authoritativeContract: true,
      prefundingValidationCertificate: true,
      generatedDocuments: true,
      financials: true,
    },
  });

  if (!deal || deal.lenderId !== lenderId) {
    return { eligible: false, reasons: ["Deal not found or not owned by this lender."], warnings: [] };
  }

  if (deal.status !== DealStatus.CONSUMMATED && deal.status !== DealStatus.FUNDED) {
    reasons.push("Deal must be funded before pooling.");
  }

  if (!deal.authoritativeContract) {
    reasons.push("Authoritative contract record is required.");
  }

  if (!deal.prefundingValidationCertificate) {
    reasons.push("Pre-funding validation certificate must exist.");
  } else if (deal.prefundingValidationCertificate.status === "BLOCKED") {
    reasons.push("Pre-funding validation certificate was BLOCKED at issuance.");
  } else if (deal.prefundingValidationCertificate.status === "WARNING") {
    warnings.push("Pre-funding validation completed with warnings.");
  }

  if (deal.generatedDocuments.length === 0) {
    reasons.push("At least one generated/on-platform document must exist.");
  }

  if (deal.complianceStatus === DealComplianceStatus.BLOCKED) {
    reasons.push("Deal compliance status is BLOCKED.");
  } else if (deal.complianceStatus === DealComplianceStatus.WARNING) {
    warnings.push("Deal compliance status has active warnings.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
  };
}

export async function computePoolIntegrityStatus(poolId: string): Promise<DealComplianceStatus> {
  const pool = await prisma.loanPool.findUnique({
    where: { id: poolId },
    include: { deals: { select: { id: true } } },
  });
  if (!pool) return "BLOCKED";
  if (pool.deals.length === 0) return "WARNING";

  let blocked = 0;
  let warned = 0;
  for (const d of pool.deals) {
    const ev = await evaluateDealForPooling(d.id, pool.lenderId);
    if (!ev.eligible) blocked += 1;
    if (ev.warnings.length) warned += 1;
  }
  if (blocked > 0) return "BLOCKED";
  if (warned > 0) return "WARNING";
  return "COMPLIANT";
}
