import { createHash } from "crypto";

export type AgentDocStatus = "PENDING" | "READY" | "BLOCKED";

export type AgentGeneratedDocument = {
  docType: string;
  required: boolean;
  sourceOfTruth: "AUTHORITATIVE_CONTRACT";
  fieldsToPopulate: string[];
  status: AgentDocStatus;
};

export type AgentPopulatedDocument = {
  docType: string;
  populatedFields: Record<string, unknown>;
  missingFields: string[];
  hashOfPopulatedDoc: string;
  status: AgentDocStatus;
};

export type StateLawResearchOutput = {
  state: string;
  dealType: "AUTO_FINANCE";
  notices: string[];
  requiredDisclosures: string[];
  requiredFilings: string[];
  titleLienRules: string[];
  complianceNotes: string[];
  outputHash: string;
};

export type FundingReadinessOutput = {
  fundingReadiness: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  assignmentValidated: boolean;
  missingSignatures: string[];
  missingStipulations: string[];
  missingFundingDocuments: string[];
  warnings: string[];
  outputHash: string;
};

export type TitleLienChecklistItem = {
  item: string;
  status: "READY" | "MISSING";
};

export type TitleLienChecklistOutput = {
  state: string;
  checklist: TitleLienChecklistItem[];
  readyToFile: boolean;
  warnings: string[];
  outputHash: string;
};

export type DownstreamDriftOutput = {
  hasDrift: boolean;
  mismatches: string[];
  comparedFieldCount: number;
  outputHash: string;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export class StateLawResearchAgent {
  research(state: string, dealType: "AUTO_FINANCE"): StateLawResearchOutput {
    const upperState = state.trim().toUpperCase();
    const byState: Record<string, Omit<StateLawResearchOutput, "state" | "dealType" | "outputHash">> = {
      CA: {
        notices: ["California financing disclosure packet"],
        requiredDisclosures: ["State APR/finance disclosure", "Privacy disclosure"],
        requiredFilings: ["California lien perfection filing", "Title transfer packet"],
        titleLienRules: ["VIN/lienholder consistency required across all filings"],
        complianceNotes: ["Use California-approved disclosure language templates."],
      },
      TX: {
        notices: ["Texas retail installment disclosure packet"],
        requiredDisclosures: ["Finance charge disclosure", "Optional products disclosure"],
        requiredFilings: ["Texas title and lien filing packet"],
        titleLienRules: ["Lienholder and assignment references must match authoritative record."],
        complianceNotes: ["Validate assignment references before funding release."],
      },
      FL: {
        notices: ["Florida fee and optional product notice packet"],
        requiredDisclosures: ["Fee itemization disclosure", "Insurance acknowledgment disclosure"],
        requiredFilings: ["Florida title/lien filing packet"],
        titleLienRules: ["Buyer identity and VIN must match signed governing record."],
        complianceNotes: ["Auto-generated notices must preserve immutable financial terms."],
      },
      NY: {
        notices: ["New York installment contract notice packet"],
        requiredDisclosures: ["Consumer credit disclosure", "Privacy/consent disclosure"],
        requiredFilings: ["New York title and lien submission packet"],
        titleLienRules: ["Title docs must include lender and assignment identity controls."],
        complianceNotes: ["Capture state-specific notice confirmation in audit trail."],
      },
    };
    const fallback = {
      notices: ["General auto finance compliance notice packet"],
      requiredDisclosures: ["Core financing disclosure"],
      requiredFilings: ["Title and lien filing packet"],
      titleLienRules: ["VIN and lienholder must be consistent across generated forms."],
      complianceNotes: ["State-specific legal review required before consummation."],
    };

    const resolved = byState[upperState] ?? fallback;
    const output = {
      state: upperState,
      dealType,
      ...resolved,
    };

    return {
      ...output,
      outputHash: sha256Hex(output),
    };
  }
}

export class DocumentGenerationAgent {
  generateRequiredDocuments(input: {
    state: string;
    buyerName: string;
    dealerId: string;
    lenderId: string;
    vin: string;
    amountFinanced: number;
    termMonths: number;
    serviceContracts: number;
  }): AgentGeneratedDocument[] {
    const serviceContractRequired = input.serviceContracts > 0;
    const gapRequired = input.amountFinanced > 0 && input.termMonths >= 60;
    const hasCoreIdentity = Boolean(input.state && input.buyerName && input.dealerId && input.lenderId && input.vin);

    const docs: AgentGeneratedDocument[] = [
      {
        docType: "Retail Installment Sale Contract",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "dealerId", "lenderId", "vin", "cashPrice", "amountFinanced", "apr", "termMonths"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Buyer’s Order",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "cashPrice", "taxes", "fees"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Odometer Disclosure",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "mileage", "dealerId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Title Application",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "buyer.address", "vin", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Lien Filing Instructions",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["vin", "lenderId", "dealerId", "buyer.name"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Assignment Agreement / Assignment Addendum",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["dealerId", "lenderId", "vin", "amountFinanced", "apr", "termMonths"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Privacy Notice",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "buyer.address", "buyer.email", "dealerId", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Credit Application",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "buyer.address", "buyer.email", "amountFinanced"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Insurance Acknowledgment",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
      {
        docType: "Service Contract Disclosure",
        required: serviceContractRequired,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "serviceContracts"],
        status: serviceContractRequired ? (hasCoreIdentity ? "READY" : "BLOCKED") : "READY",
      },
      {
        docType: "GAP Disclosure",
        required: gapRequired,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["buyer.name", "vin", "amountFinanced", "termMonths"],
        status: gapRequired ? (hasCoreIdentity ? "READY" : "BLOCKED") : "READY",
      },
      {
        docType: "State-specific notices placeholder",
        required: true,
        sourceOfTruth: "AUTHORITATIVE_CONTRACT",
        fieldsToPopulate: ["state", "buyer.name", "dealerId", "lenderId"],
        status: hasCoreIdentity ? "READY" : "BLOCKED",
      },
    ];

    return docs;
  }
}

export class FundingPackageAgent {
  validateFundingReadiness(input: {
    recordId: string;
    contractData: Record<string, unknown>;
    generatedDocs: AgentGeneratedDocument[];
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

export class TitleLienFilingAgent {
  prepareChecklist(input: {
    state: string;
    contractData: Record<string, unknown>;
    populatedDocs: AgentPopulatedDocument[];
  }): TitleLienChecklistOutput {
    const checklist: TitleLienChecklistItem[] = [
      {
        item: "VIN present",
        status: readString(input.contractData.vin) ? "READY" : "MISSING",
      },
      {
        item: "Buyer identity present",
        status: readString(input.contractData.buyerName) && readString(input.contractData.buyerAddress) ? "READY" : "MISSING",
      },
      {
        item: "Lienholder present",
        status: readString(input.contractData.lienholderName) || readString(input.contractData.lenderName) ? "READY" : "MISSING",
      },
      {
        item: "Title Application populated",
        status: input.populatedDocs.some((doc) => doc.docType === "Title Application" && doc.status === "READY")
          ? "READY"
          : "MISSING",
      },
      {
        item: "Lien Filing Instructions populated",
        status: input.populatedDocs.some((doc) => doc.docType === "Lien Filing Instructions" && doc.status === "READY")
          ? "READY"
          : "MISSING",
      },
    ];

    const warnings: string[] = [];
    if (!readString(input.state)) {
      warnings.push("State code missing; apply manual filing review.");
    }

    const readyToFile = checklist.every((item) => item.status === "READY");
    const payload = {
      state: input.state.trim().toUpperCase(),
      checklist,
      readyToFile,
      warnings,
    };

    return {
      ...payload,
      outputHash: sha256Hex(payload),
    };
  }
}

export class DownstreamDriftDetectionAgent {
  detectDrift(input: {
    authoritativeContractData: Record<string, unknown>;
    populatedDocs: AgentPopulatedDocument[];
    nonOverridableFields: readonly string[];
  }): DownstreamDriftOutput {
    const mismatches: string[] = [];
    let comparedFieldCount = 0;

    for (const doc of input.populatedDocs) {
      for (const fieldName of input.nonOverridableFields) {
        const authoritativeValue = input.authoritativeContractData[fieldName];
        const populatedValue = doc.populatedFields[fieldName];
        if (authoritativeValue === undefined || populatedValue === undefined) {
          continue;
        }
        comparedFieldCount += 1;
        if (readString(authoritativeValue) !== readString(populatedValue)) {
          mismatches.push(
            `${doc.docType} mismatch on ${fieldName}: authoritative=${readString(authoritativeValue)} populated=${readString(populatedValue)}`,
          );
        }
      }
    }

    const payload = {
      hasDrift: mismatches.length > 0,
      mismatches,
      comparedFieldCount,
    };

    return {
      ...payload,
      outputHash: sha256Hex(payload),
    };
  }
}

export class AuditCustodyAgent {
  logAction(input: {
    eventType: string;
    timestamp: string;
    actor: string;
    recordId: string;
    result: string;
    payload: unknown;
  }): { hash: string } {
    return {
      hash: sha256Hex(input),
    };
  }
}
