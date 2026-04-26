import { createHash } from "crypto";

export const DEALSEAL_COMPLIANCE_ORCHESTRATOR_ACTOR = "DealSeal Compliance Orchestrator Agent";

export type DealInput = {
  state: string;
  dealerId: string;
  lenderId: string;
  buyer: {
    name: string;
    address: string;
    email: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin: string;
    mileage: number;
  };
  financialTerms: {
    cashPrice: number;
    downPayment: number;
    amountFinanced: number;
    apr: number;
    termMonths: number;
    monthlyPayment: number;
    taxes: number;
    fees: number;
    serviceContracts: number;
  };
};

export type AuthoritativeContract = {
  recordId: string;
  dealId: string;
  state: string;
  version: number;
  status: string;
  hash: string;
  signedAt: string | null;
  lockedAt: string | null;
  contractData: Record<string, unknown>;
};

export type DocStatus = "PENDING" | "READY" | "BLOCKED";

export type GeneratedDealerDocument = {
  docType: string;
  required: boolean;
  sourceOfTruth: "AUTHORITATIVE_CONTRACT";
  fieldsToPopulate: string[];
  status: DocStatus;
};

export type PopulatedDocument = {
  docType: string;
  populatedFields: Record<string, unknown>;
  missingFields: string[];
  hashOfPopulatedDoc: string;
  status: DocStatus;
};

export type AuditStyleEvent = {
  eventType: string;
  timestamp: string;
  actor: typeof DEALSEAL_COMPLIANCE_ORCHESTRATOR_ACTOR;
  recordId: string;
  result: string;
  hash: string;
};

export type PreConsummationCheckpointResult = {
  checkpoint: "PRE_CONSUMMATION";
  status: "GREEN" | "YELLOW" | "RED";
  issues: string[];
  requiredFixes: string[];
  warnings: string[];
  approvedToSign: boolean;
  auditEvent: AuditStyleEvent;
};

export type PostFundingCheckpointResult = {
  checkpoint: "POST_FUNDING";
  status: "GREEN" | "YELLOW" | "RED";
  cleared: boolean;
  blockers: string[];
  warnings: string[];
  auditSummary: string[];
  auditEvent: AuditStyleEvent;
};

export type FundingPackageResult = {
  packageId: string;
  generatedAt: string;
  requiredDocuments: string[];
  packageHash: string;
  status: "READY" | "BLOCKED";
};

export type DriftValidationResult = {
  hasDrift: boolean;
  mismatches: string[];
};

export type LegalResearchPlaceholder = {
  state: string;
  dealType: "AUTO_FINANCE";
  notices: string[];
  requiredDocs: string[];
  complianceNotes: string[];
};

export type ComplianceReport = {
  dealId: string;
  state: string;
  preConsummation: PreConsummationCheckpointResult;
  requiredDocuments: GeneratedDealerDocument[];
  populatedDocuments: PopulatedDocument[];
  fundingPackage: FundingPackageResult;
  postFunding: PostFundingCheckpointResult;
  auditEvents: AuditStyleEvent[];
};

const NON_OVERRIDABLE_FIELDS = [
  "cashPrice",
  "apr",
  "financeCharge",
  "amountFinanced",
  "monthlyPayment",
  "termMonths",
  "vin",
  "buyerName",
  "dealerName",
  "lenderName",
] as const;

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

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

function hashSha256(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function createAuditEvent(eventType: string, recordId: string, result: string, payload: unknown): AuditStyleEvent {
  const timestamp = new Date().toISOString();
  return {
    eventType,
    timestamp,
    actor: DEALSEAL_COMPLIANCE_ORCHESTRATOR_ACTOR,
    recordId,
    result,
    hash: hashSha256({ eventType, recordId, result, timestamp, payload }),
  };
}

function financialTermFields(): string[] {
  return [
    "cashPrice",
    "downPayment",
    "amountFinanced",
    "apr",
    "termMonths",
    "monthlyPayment",
    "taxes",
    "fees",
    "serviceContracts",
  ];
}

function baseDocumentPlan(dealInput: DealInput): GeneratedDealerDocument[] {
  const serviceContractRequired = dealInput.financialTerms.serviceContracts > 0;
  const gapRequired = dealInput.financialTerms.amountFinanced > 0 && dealInput.financialTerms.termMonths >= 60;

  return [
    {
      docType: "Retail Installment Sale Contract",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: [
        "buyer.name",
        "dealerId",
        "lenderId",
        "vehicle.vin",
        ...financialTermFields(),
      ],
      status: "PENDING",
    },
    {
      docType: "Buyer’s Order",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "vehicle.year", "vehicle.make", "vehicle.model", ...financialTermFields()],
      status: "PENDING",
    },
    {
      docType: "Odometer Disclosure",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["vehicle.vin", "vehicle.mileage", "buyer.name", "dealerId"],
      status: "PENDING",
    },
    {
      docType: "Title Application",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "buyer.address", "vehicle.vin", "lenderId", "dealerId"],
      status: "PENDING",
    },
    {
      docType: "Lien Filing Instructions",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["vehicle.vin", "lenderId", "dealerId", "buyer.name", "amountFinanced"],
      status: "PENDING",
    },
    {
      docType: "Assignment Agreement / Assignment Addendum",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["dealerId", "lenderId", "vehicle.vin", "amountFinanced", "apr", "termMonths"],
      status: "PENDING",
    },
    {
      docType: "Privacy Notice",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "buyer.address", "buyer.email", "dealerId", "lenderId"],
      status: "PENDING",
    },
    {
      docType: "Credit Application",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "buyer.address", "buyer.email", "amountFinanced"],
      status: "PENDING",
    },
    {
      docType: "Insurance Acknowledgment",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "vehicle.vin", "lenderId", "dealerId"],
      status: "PENDING",
    },
    {
      docType: "Service Contract Disclosure",
      required: serviceContractRequired,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "vehicle.vin", "serviceContracts"],
      status: serviceContractRequired ? "PENDING" : "READY",
    },
    {
      docType: "GAP Disclosure",
      required: gapRequired,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["buyer.name", "vehicle.vin", "amountFinanced", "termMonths"],
      status: gapRequired ? "PENDING" : "READY",
    },
    {
      docType: "State-specific notices placeholder",
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: ["state", "buyer.name", "dealerId", "lenderId"],
      status: "PENDING",
    },
  ];
}

// Attach real AI model here later.
export function runLegalResearchAgent(state: string, dealType: "AUTO_FINANCE"): LegalResearchPlaceholder {
  const upperState = state.trim().toUpperCase();
  const noticesByState: Record<string, string[]> = {
    CA: ["California disclosure bundle review"],
    TX: ["Texas installment disclosure review"],
    FL: ["Florida fee and optional product notice review"],
    NY: ["New York contract notice review"],
  };

  return {
    state: upperState,
    dealType,
    notices: noticesByState[upperState] ?? ["General state notice review"],
    requiredDocs: [],
    complianceNotes: ["Deterministic placeholder legal research result. Attach model for deep statutory mapping."],
  };
}

export class DealSealComplianceOrchestrator {
  reviewBeforeConsummation(dealInput: DealInput): PreConsummationCheckpointResult {
    const issues: string[] = [];
    const requiredFixes: string[] = [];
    const warnings: string[] = [];

    const buyer = dealInput.buyer;
    const vehicle = dealInput.vehicle;
    const terms = dealInput.financialTerms;

    const state = toStringValue(dealInput.state).toUpperCase();
    if (!state) {
      issues.push("State is required.");
      requiredFixes.push("Provide transaction state before consummation.");
    }

    if (!toStringValue(dealInput.dealerId)) {
      issues.push("Dealer identity is incomplete.");
      requiredFixes.push("Provide valid dealerId.");
    }

    if (!toStringValue(dealInput.lenderId)) {
      issues.push("Lender identity is incomplete.");
      requiredFixes.push("Provide valid lenderId.");
    }

    if (!toStringValue(buyer.name) || !toStringValue(buyer.address) || !toStringValue(buyer.email)) {
      issues.push("Buyer identity fields are incomplete.");
      requiredFixes.push("Provide buyer name, address, and email.");
    }

    if (!toStringValue(vehicle.make) || !toStringValue(vehicle.model) || vehicle.year <= 0) {
      issues.push("Vehicle identity fields are incomplete.");
      requiredFixes.push("Provide vehicle year/make/model.");
    }

    if (!toStringValue(vehicle.vin)) {
      issues.push("VIN is missing.");
      requiredFixes.push("Provide VIN before contract drafting.");
    }

    if (vehicle.mileage < 0) {
      issues.push("Odometer mileage is invalid.");
      requiredFixes.push("Provide non-negative mileage.");
    }

    if (terms.apr <= 0) {
      issues.push("APR must be greater than 0.");
      requiredFixes.push("Set valid APR before consummation.");
    }

    if (terms.amountFinanced <= 0) {
      issues.push("Amount financed must be greater than 0.");
      requiredFixes.push("Set amount financed.");
    }

    const financeCharge = terms.monthlyPayment * terms.termMonths - terms.amountFinanced;
    if (financeCharge <= 0) {
      issues.push("Finance charge calculation is invalid.");
      requiredFixes.push("Validate payment schedule against amount financed.");
    }

    if (terms.monthlyPayment <= 0 || terms.termMonths <= 0) {
      issues.push("Payment schedule is incomplete.");
      requiredFixes.push("Provide monthly payment and term months.");
    }

    if (terms.taxes < 0 || terms.fees < 0 || terms.serviceContracts < 0) {
      issues.push("Taxes/fees/service contract charges cannot be negative.");
      requiredFixes.push("Normalize fee and tax values.");
    }

    if (!toStringValue(dealInput.dealerId) || !toStringValue(dealInput.lenderId)) {
      issues.push("Assignment readiness cannot be validated.");
      requiredFixes.push("Ensure dealer and lender assignment identities are present.");
    }

    if (!toStringValue(vehicle.vin) || !toStringValue(buyer.name) || terms.amountFinanced <= 0) {
      issues.push("Title/lien requirements cannot be satisfied.");
      requiredFixes.push("Populate title-critical fields (VIN, buyer identity, lien amount).");
    }

    const legalResearch = runLegalResearchAgent(state, "AUTO_FINANCE");
    warnings.push(...legalResearch.complianceNotes);
    if (legalResearch.notices.length > 0) {
      warnings.push(`State notices identified: ${legalResearch.notices.join("; ")}`);
    }

    warnings.push("Authoritative-record readiness requires immutable lock immediately after signing.");

    let status: "GREEN" | "YELLOW" | "RED" = "GREEN";
    if (issues.length > 0) {
      status = "RED";
    } else if (warnings.length > 0) {
      status = "YELLOW";
    }

    const approvedToSign = status !== "RED";
    const checkpointPayload: Omit<PreConsummationCheckpointResult, "auditEvent"> = {
      checkpoint: "PRE_CONSUMMATION",
      status,
      issues,
      requiredFixes,
      warnings,
      approvedToSign,
    };

    return {
      ...checkpointPayload,
      auditEvent: createAuditEvent(
        "AI_PRE_CONSUMMATION_CHECKPOINT_EVALUATED",
        `pre-${toStringValue(dealInput.dealerId)}-${toStringValue(dealInput.lenderId)}`,
        status,
        checkpointPayload,
      ),
    };
  }

  generateRequiredDealerDocs(dealInput: DealInput): GeneratedDealerDocument[] {
    const documents = baseDocumentPlan(dealInput);
    const isReadyForDrafting = toStringValue(dealInput.state) && toStringValue(dealInput.buyer.name) && toStringValue(dealInput.vehicle.vin);

    return documents.map((doc) => {
      if (!doc.required) return doc;
      return {
        ...doc,
        status: isReadyForDrafting ? "READY" : "BLOCKED",
      };
    });
  }

  generateFundingPackage(authoritativeContract: AuthoritativeContract, docs: GeneratedDealerDocument[]): FundingPackageResult {
    const requiredDocTypes = docs.filter((doc) => doc.required).map((doc) => doc.docType);
    const allReady = docs.filter((doc) => doc.required).every((doc) => doc.status !== "BLOCKED");
    const generatedAt = new Date().toISOString();
    const packageHash = hashSha256({
      recordId: authoritativeContract.recordId,
      state: authoritativeContract.state,
      requiredDocTypes,
      generatedAt,
    });

    return {
      packageId: `funding-pkg-${packageHash.slice(0, 12)}`,
      generatedAt,
      requiredDocuments: requiredDocTypes,
      packageHash,
      status: allReady ? "READY" : "BLOCKED",
    };
  }

  populateDocsFromAuthoritativeContract(
    authoritativeContract: AuthoritativeContract,
    docs: GeneratedDealerDocument[],
  ): PopulatedDocument[] {
    const source = authoritativeContract.contractData;

    return docs
      .filter((doc) => doc.required)
      .map((doc) => {
        const populatedFields: Record<string, unknown> = {};
        const missingFields: string[] = [];

        for (const field of doc.fieldsToPopulate) {
          const directValue = source[field];
          if (directValue !== undefined && directValue !== null && toStringValue(directValue) !== "") {
            populatedFields[field] = directValue;
            continue;
          }

          // Handle dotted paths in deterministic way.
          const pathChunks = field.split(".");
          let cursor: unknown = source;
          for (const chunk of pathChunks) {
            if (typeof cursor === "object" && cursor !== null && chunk in (cursor as Record<string, unknown>)) {
              cursor = (cursor as Record<string, unknown>)[chunk];
            } else {
              cursor = undefined;
              break;
            }
          }
          if (cursor !== undefined && cursor !== null && toStringValue(cursor) !== "") {
            populatedFields[field] = cursor;
          } else {
            missingFields.push(field);
          }
        }

        const hashOfPopulatedDoc = hashSha256({
          recordId: authoritativeContract.recordId,
          docType: doc.docType,
          populatedFields,
          missingFields,
        });

        return {
          docType: doc.docType,
          populatedFields,
          missingFields,
          hashOfPopulatedDoc,
          status: missingFields.length === 0 ? "READY" : "BLOCKED",
        };
      });
  }

  validateNoDownstreamDrift(
    authoritativeContract: AuthoritativeContract,
    generatedDocs: PopulatedDocument[],
  ): DriftValidationResult {
    const mismatches: string[] = [];
    const source = authoritativeContract.contractData;

    for (const doc of generatedDocs) {
      for (const fieldName of NON_OVERRIDABLE_FIELDS) {
        const authoritativeValue = source[fieldName];
        const populatedValue = doc.populatedFields[fieldName];
        if (populatedValue === undefined || authoritativeValue === undefined) {
          continue;
        }

        const normalizedAuthoritative = toStringValue(authoritativeValue);
        const normalizedPopulated = toStringValue(populatedValue);
        if (normalizedAuthoritative !== normalizedPopulated) {
          mismatches.push(
            `${doc.docType} drifted on ${fieldName}: authoritative=${normalizedAuthoritative} populated=${normalizedPopulated}`,
          );
        }
      }
    }

    return {
      hasDrift: mismatches.length > 0,
      mismatches,
    };
  }

  validatePostFundingCheckpoint(
    authoritativeContract: AuthoritativeContract,
    populatedDocs: PopulatedDocument[],
  ): PostFundingCheckpointResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const auditSummary: string[] = [];

    const isLocked =
      toStringValue(authoritativeContract.status).toUpperCase() === "LOCKED" &&
      toStringValue(authoritativeContract.lockedAt).length > 0;
    if (!isLocked) {
      blockers.push("Authoritative record is not locked.");
    }

    const fundingPackageGenerated = populatedDocs.length > 0;
    if (!fundingPackageGenerated) {
      blockers.push("Funding package was not generated.");
    }

    const contractData = authoritativeContract.contractData;
    const assignmentPresent =
      toStringValue(contractData.assignmentAgreementId).length > 0 ||
      toStringValue(contractData.lenderAssignmentReference).length > 0;
    if (!assignmentPresent) {
      blockers.push("Assignment data is missing.");
    }

    const lienholderPresent =
      toStringValue(contractData.lienholderName).length > 0 || toStringValue(contractData.lenderName).length > 0;
    if (!lienholderPresent) {
      blockers.push("Lienholder data is missing.");
    }

    const titleDoc = populatedDocs.find((doc) => doc.docType === "Title Application");
    const lienDoc = populatedDocs.find((doc) => doc.docType === "Lien Filing Instructions");
    if (!titleDoc || titleDoc.status !== "READY") {
      blockers.push("Title Application is not fully populated.");
    }
    if (!lienDoc || lienDoc.status !== "READY") {
      blockers.push("Lien Filing Instructions are not fully populated.");
    }

    const missingHashes = populatedDocs.filter((doc) => !toStringValue(doc.hashOfPopulatedDoc)).length;
    if (missingHashes > 0) {
      blockers.push("One or more generated documents do not have hashes.");
    }

    const drift = this.validateNoDownstreamDrift(authoritativeContract, populatedDocs);
    if (drift.hasDrift) {
      blockers.push("Downstream document drift detected.");
      warnings.push(...drift.mismatches);
    }

    const moneyFields = ["cashPrice", "amountFinanced", "monthlyPayment", "termMonths", "apr"] as const;
    for (const field of moneyFields) {
      const sourceValue = contractData[field];
      if (sourceValue === undefined) {
        warnings.push(`Authoritative contract is missing ${field} in contractData.`);
      }
    }

    const hasAuditEvent = toStringValue(authoritativeContract.recordId).length > 0;
    if (!hasAuditEvent) {
      blockers.push("Audit event anchor cannot be created without recordId.");
    } else {
      auditSummary.push(`Audit anchor ready for record ${authoritativeContract.recordId}.`);
    }

    const custodyIntact = isLocked && !drift.hasDrift;
    if (!custodyIntact) {
      blockers.push("Custody chain is not intact.");
    } else {
      auditSummary.push("Custody chain intact from authoritative record to generated docs.");
    }

    let status: "GREEN" | "YELLOW" | "RED" = "GREEN";
    if (blockers.length > 0) {
      status = "RED";
    } else if (warnings.length > 0) {
      status = "YELLOW";
    }

    const payload = {
      checkpoint: "POST_FUNDING" as const,
      status,
      cleared: status === "GREEN",
      blockers,
      warnings,
      auditSummary,
    };

    return {
      ...payload,
      auditEvent: createAuditEvent(
        "AI_POST_FUNDING_CHECKPOINT_EVALUATED",
        authoritativeContract.recordId,
        status,
        payload,
      ),
    };
  }

  produceComplianceReport(dealInput: DealInput, authoritativeContract: AuthoritativeContract): ComplianceReport {
    const preConsummation = this.reviewBeforeConsummation(dealInput);
    const requiredDocuments = this.generateRequiredDealerDocs(dealInput);
    const populatedDocuments = this.populateDocsFromAuthoritativeContract(authoritativeContract, requiredDocuments);
    const fundingPackage = this.generateFundingPackage(authoritativeContract, requiredDocuments);
    const postFunding = this.validatePostFundingCheckpoint(authoritativeContract, populatedDocuments);

    return {
      dealId: authoritativeContract.dealId,
      state: authoritativeContract.state,
      preConsummation,
      requiredDocuments,
      populatedDocuments,
      fundingPackage,
      postFunding,
      auditEvents: [preConsummation.auditEvent, postFunding.auditEvent],
    };
  }
}

