import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { ComplianceEngineService } from "@/lib/services/compliance.service";
import { DealerLenderLinkService } from "@/lib/services/link.service";
import { recordDealAuditEvent } from "@/lib/services/deal-audit-service";

export const FundingValidationService = {
  async generatePrefundingCertificate(dealId: string) {
    const existing = await prisma.preFundingValidationCertificate.findUnique({
      where: { dealId },
    });
    if (existing) {
      return existing;
    }

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

    const allRuleChecks = [...stateCompliance.checks, ...lenderCompliance.checks];

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

    const contractHash = deal.authoritativeContract?.authoritativeContractHash ?? "";
    const issuedAt = new Date().toISOString();
    const status = blockers.length === 0 ? "COMPLIANT" : "BLOCKED";

    const integrityBody = {
      dealId,
      issuedAt,
      contractHash,
      ruleChecks: allRuleChecks,
      warnings,
      blockers,
      status,
    };
    const processingIntegrityDigest = crypto.createHash("sha256").update(JSON.stringify(integrityBody)).digest("hex");

    const created = await prisma.preFundingValidationCertificate.create({
      data: {
        dealId,
        lenderId: deal.lenderId,
        dealerId: deal.dealerId,
        status,
        ruleChecks: allRuleChecks as unknown as object[],
        warnings,
        blockers,
        documentList: deal.generatedDocuments.map((d) => ({ id: d.id, type: d.type })),
        contractHash,
        auditRef: `prefunding:${dealId}:${processingIntegrityDigest}`,
        immutable: true,
      },
    });

    await recordDealAuditEvent({
      dealId,
      workspaceId: deal.dealerId,
      authMethod: "SYSTEM",
      action: "PREFUNDING_CERTIFICATE_ISSUED",
      entityType: "PreFundingValidationCertificate",
      entityId: created.id,
      payload: {
        processingIntegrityDigest,
        ruleOutcomeSummary: allRuleChecks.map((c) => ({
          id: c.id,
          outcome: c.status,
          ruleSet: c.ruleSet,
        })),
      },
    });

    return created;
  },
};
