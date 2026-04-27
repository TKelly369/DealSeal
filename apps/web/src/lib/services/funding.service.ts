import { prisma } from "@/lib/db";
import { ComplianceEngineService } from "@/lib/services/compliance.service";
import { DealerLenderLinkService } from "@/lib/services/link.service";

export const FundingValidationService = {
  async generatePrefundingCertificate(dealId: string) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        generatedDocuments: true,
        authoritativeContract: true,
      },
    });
    if (!deal) throw new Error("Deal not found");

    const activeLinks = await DealerLenderLinkService.getActiveLinksForDealer(deal.dealerId);
    const linkOk = activeLinks.some((l) => l.id === deal.dealerLenderLinkId);
    const stateCompliance = await ComplianceEngineService.runStateCompliance(dealId);
    const lenderCompliance = await ComplianceEngineService.runLenderCompliance(dealId);
    const blockers = [
      ...(linkOk ? [] : ["No active dealer-lender link."]),
      ...(deal.generatedDocuments.length > 0 ? [] : ["No generated documents attached."]),
      ...(deal.authoritativeContract ? [] : ["Missing authoritative contract."]),
      ...stateCompliance.checks.filter((c) => c.status === "BLOCKED").map((c) => c.explanation),
      ...lenderCompliance.checks.filter((c) => c.status === "BLOCKED").map((c) => c.explanation),
    ];

    const warnings = [
      ...stateCompliance.checks.filter((c) => c.status === "WARNING").map((c) => c.explanation),
      ...lenderCompliance.checks.filter((c) => c.status === "WARNING").map((c) => c.explanation),
    ];

    return prisma.preFundingValidationCertificate.upsert({
      where: { dealId },
      update: {
        status: blockers.length === 0 ? "COMPLIANT" : "BLOCKED",
        ruleChecks: [...stateCompliance.checks, ...lenderCompliance.checks],
        warnings,
        blockers,
        documentList: deal.generatedDocuments.map((d) => ({ id: d.id, type: d.type })),
        contractHash: deal.authoritativeContract?.contentHash ?? "",
        auditRef: `prefunding-${dealId}-${Date.now()}`,
      },
      create: {
        dealId,
        lenderId: deal.lenderId,
        dealerId: deal.dealerId,
        status: blockers.length === 0 ? "COMPLIANT" : "BLOCKED",
        ruleChecks: [...stateCompliance.checks, ...lenderCompliance.checks],
        warnings,
        blockers,
        documentList: deal.generatedDocuments.map((d) => ({ id: d.id, type: d.type })),
        contractHash: deal.authoritativeContract?.contentHash ?? "",
        auditRef: `prefunding-${dealId}-${Date.now()}`,
      },
    });
  },
};
