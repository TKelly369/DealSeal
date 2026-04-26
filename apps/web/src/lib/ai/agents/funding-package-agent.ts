import { type FundingReadinessOutput, type GeneratedDealerDocument, readNumber, readString, sha256Hex } from "@/lib/ai/agents/types";

export class FundingPackageAgent {
  validateFundingReadiness(input: {
    recordId: string;
    contractData: Record<string, unknown>;
    generatedDocs: GeneratedDealerDocument[];
  }): FundingReadinessOutput {
    const missingSignatures: string[] = [];
    const missingStipulations: string[] = [];
    const missingFundingDocuments: string[] = [];
    const warnings: string[] = [];

    if (!readString(input.contractData.buyerName)) {
      missingSignatures.push("Buyer signature anchor missing.");
    }
    if (!readString(input.contractData.dealerName)) {
      missingSignatures.push("Dealer signature anchor missing.");
    }
    if (!readString(input.contractData.lenderName)) {
      warnings.push("Lender signature anchor not present; verify funding policy.");
    }

    if (!readString(input.contractData.assignmentAgreementId) && !readString(input.contractData.lenderAssignmentReference)) {
      missingStipulations.push("Assignment reference missing.");
    }
    if (!readString(input.contractData.vin)) {
      missingStipulations.push("VIN missing.");
    }
    if (readNumber(input.contractData.amountFinanced) <= 0) {
      missingStipulations.push("Amount financed must be present.");
    }

    for (const doc of input.generatedDocs.filter((item) => item.required)) {
      if (doc.status === "BLOCKED") {
        missingFundingDocuments.push(`${doc.docType} is blocked`);
      }
    }

    const assignmentValidated = missingStipulations.length === 0;
    const hasBlockingIssue =
      missingSignatures.length > 0 || missingStipulations.length > 0 || missingFundingDocuments.length > 0;
    const fundingReadiness: FundingReadinessOutput["fundingReadiness"] =
      hasBlockingIssue ? "BLOCKED" : warnings.length > 0 ? "REVIEW_REQUIRED" : "READY";

    const payload = {
      recordId: input.recordId,
      fundingReadiness,
      assignmentValidated,
      missingSignatures,
      missingStipulations,
      missingFundingDocuments,
      warnings,
    };

    return {
      ...payload,
      outputHash: sha256Hex(payload),
    };
  }
}
