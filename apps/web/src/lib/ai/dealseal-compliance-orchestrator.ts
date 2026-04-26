import { createHash } from "crypto";
import {
  AuditCustodyAgent,
  DocumentGenerationAgent,
  DownstreamDriftDetectionAgent,
  FundingPackageAgent,
  StateLawResearchAgent,
  TitleLienFilingAgent,
  type AgentGeneratedDocument,
  type AgentPopulatedDocument,
} from "@/lib/ai/internal-agents";

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
export type GeneratedDealerDocument = AgentGeneratedDocument;
export type PopulatedDocument = AgentPopulatedDocument;

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

// Attach real AI model here later.
export function runLegalResearchAgent(state: string, dealType: "AUTO_FINANCE"): LegalResearchPlaceholder {
  const agent = new StateLawResearchAgent();
  const result = agent.research(state, dealType);
  return {
    state: result.state,
    dealType: result.dealType,
    notices: result.notices,
    requiredDocs: result.requiredFilings,
    complianceNotes: result.complianceNotes,
  };
}

export class DealSealComplianceOrchestrator {
  private readonly stateLawResearchAgent = new StateLawResearchAgent();
  private readonly documentGenerationAgent = new DocumentGenerationAgent();
  private readonly fundingPackageAgent = new FundingPackageAgent();
  private readonly titleLienFilingAgent = new TitleLienFilingAgent();
  private readonly downstreamDriftDetectionAgent = new DownstreamDriftDetectionAgent();
  private readonly auditCustodyAgent = new AuditCustodyAgent();

  private createAuditEvent(eventType: string, recordId: string, result: string, payload: unknown): AuditStyleEvent {
    const timestamp = new Date().toISOString();
    const hash = this.auditCustodyAgent.logAction({
      eventType,
      timestamp,
      actor: DEALSEAL_COMPLIANCE_ORCHESTRATOR_ACTOR,
      recordId,
      result,
      payload,
    }).hash;
    return {
      eventType,
      timestamp,
      actor: DEALSEAL_COMPLIANCE_ORCHESTRATOR_ACTOR,
      recordId,
      result,
      hash,
    };
  }

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
      issues.push("Dealer identity fields are incomplete.");
      requiredFixes.push("Provide valid dealerId.");
    }
    if (!toStringValue(dealInput.lenderId)) {
      issues.push("Lender identity fields are incomplete.");
      requiredFixes.push("Provide valid lenderId.");
    }
    if (!toStringValue(buyer.name) || !toStringValue(buyer.address) || !toStringValue(buyer.email)) {
      issues.push("Buyer identity fields are incomplete.");
      requiredFixes.push("Provide buyer name, address, and email.");
    }
    if (!toStringValue(vehicle.make) || !toStringValue(vehicle.model) || vehicle.year <= 0) {
      issues.push("Vehicle fields are incomplete.");
      requiredFixes.push("Provide vehicle year/make/model.");
    }
    if (!toStringValue(vehicle.vin)) {
      issues.push("VIN is missing.");
      requiredFixes.push("Provide VIN before consummation.");
    }
    if (vehicle.mileage < 0) {
      issues.push("Odometer/mileage is invalid.");
      requiredFixes.push("Provide non-negative mileage.");
    }
    if (terms.apr <= 0) {
      issues.push("APR must be greater than 0.");
      requiredFixes.push("Set a valid APR.");
    }
    if (terms.amountFinanced <= 0) {
      issues.push("Amount financed must be greater than 0.");
      requiredFixes.push("Set amount financed.");
    }
    if (terms.monthlyPayment <= 0 || terms.termMonths <= 0) {
      issues.push("Payment schedule is incomplete.");
      requiredFixes.push("Provide monthly payment and term.");
    }

    const financeCharge = terms.monthlyPayment * terms.termMonths - terms.amountFinanced;
    if (financeCharge <= 0) {
      issues.push("Finance charge calculation is invalid.");
      requiredFixes.push("Validate payment schedule against amount financed.");
    }

    if (terms.taxes < 0 || terms.fees < 0 || terms.serviceContracts < 0) {
      issues.push("Taxes/fees/service contract charges cannot be negative.");
      requiredFixes.push("Normalize financial charge fields.");
    }

    if (!toStringValue(dealInput.dealerId) || !toStringValue(dealInput.lenderId)) {
      issues.push("Assignment readiness cannot be validated.");
      requiredFixes.push("Provide dealer and lender assignment identity anchors.");
    }

    if (!toStringValue(vehicle.vin) || !toStringValue(buyer.name) || terms.amountFinanced <= 0) {
      issues.push("Title/lien requirements cannot be satisfied.");
      requiredFixes.push("Populate title/lien critical fields (VIN, buyer, amount financed).");
    }

    const research = this.stateLawResearchAgent.research(state || "UNKNOWN", "AUTO_FINANCE");
    warnings.push(...research.complianceNotes);
    if (research.notices.length > 0) {
      warnings.push(`State notices identified: ${research.notices.join("; ")}`);
    }
    if (research.requiredDisclosures.length > 0) {
      warnings.push(`Required disclosures: ${research.requiredDisclosures.join("; ")}`);
    }
    warnings.push("Authoritative record must be locked immediately after signing.");

    let status: "GREEN" | "YELLOW" | "RED" = "GREEN";
    if (issues.length > 0) status = "RED";
    else if (warnings.length > 0) status = "YELLOW";

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
      auditEvent: this.createAuditEvent(
        "AI_PRE_CONSUMMATION_CHECKPOINT_EVALUATED",
        `pre-${toStringValue(dealInput.dealerId)}-${toStringValue(dealInput.lenderId)}`,
        status,
        { ...checkpointPayload, researchHash: research.outputHash },
      ),
    };
  }

  generateRequiredDealerDocs(dealInput: DealInput): GeneratedDealerDocument[] {
    return this.documentGenerationAgent.generateRequiredDocuments({
      state: dealInput.state,
      buyerName: dealInput.buyer.name,
      dealerId: dealInput.dealerId,
      lenderId: dealInput.lenderId,
      vin: dealInput.vehicle.vin,
      amountFinanced: dealInput.financialTerms.amountFinanced,
      termMonths: dealInput.financialTerms.termMonths,
      serviceContracts: dealInput.financialTerms.serviceContracts,
    });
  }

  generateFundingPackage(authoritativeContract: AuthoritativeContract, docs: GeneratedDealerDocument[]): FundingPackageResult {
    const requiredDocTypes = docs.filter((doc) => doc.required).map((doc) => doc.docType);
    const generatedAt = new Date().toISOString();
    const fundingReadiness = this.fundingPackageAgent.validateFundingReadiness({
      recordId: authoritativeContract.recordId,
      contractData: authoritativeContract.contractData,
      generatedDocs: docs,
    });
    const packageHash = hashSha256({
      recordId: authoritativeContract.recordId,
      state: authoritativeContract.state,
      requiredDocTypes,
      generatedAt,
      fundingReadinessHash: fundingReadiness.outputHash,
    });

    return {
      packageId: `funding-pkg-${packageHash.slice(0, 12)}`,
      generatedAt,
      requiredDocuments: requiredDocTypes,
      packageHash,
      status: fundingReadiness.fundingReadiness === "READY" ? "READY" : "BLOCKED",
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

  validateNoDownstreamDrift(authoritativeContract: AuthoritativeContract, generatedDocs: PopulatedDocument[]): DriftValidationResult {
    const output = this.downstreamDriftDetectionAgent.detectDrift({
      authoritativeContractData: authoritativeContract.contractData,
      populatedDocs: generatedDocs,
      nonOverridableFields: NON_OVERRIDABLE_FIELDS,
    });
    return {
      hasDrift: output.hasDrift,
      mismatches: output.mismatches,
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

    const generatedDocsForFunding: GeneratedDealerDocument[] = populatedDocs.map((doc) => ({
      docType: doc.docType,
      required: true,
      sourceOfTruth: "AUTHORITATIVE_CONTRACT",
      fieldsToPopulate: Object.keys(doc.populatedFields),
      status: doc.status,
    }));

    const fundingReadiness = this.fundingPackageAgent.validateFundingReadiness({
      recordId: authoritativeContract.recordId,
      contractData: authoritativeContract.contractData,
      generatedDocs: generatedDocsForFunding,
    });
    if (fundingReadiness.fundingReadiness === "BLOCKED") {
      blockers.push("Funding package readiness is blocked.");
    }
    warnings.push(...fundingReadiness.warnings);
    warnings.push(...fundingReadiness.missingSignatures);
    warnings.push(...fundingReadiness.missingStipulations);
    warnings.push(...fundingReadiness.missingFundingDocuments);

    const titleLien = this.titleLienFilingAgent.prepareChecklist({
      state: authoritativeContract.state,
      contractData: authoritativeContract.contractData,
      populatedDocs,
    });
    if (!titleLien.readyToFile) {
      blockers.push("Title/lien filing checklist is incomplete.");
    }
    warnings.push(...titleLien.warnings);

    const missingHashes = populatedDocs.filter((doc) => !toStringValue(doc.hashOfPopulatedDoc)).length;
    if (missingHashes > 0) {
      blockers.push("One or more generated documents do not have hashes.");
    }

    const driftOutput = this.downstreamDriftDetectionAgent.detectDrift({
      authoritativeContractData: authoritativeContract.contractData,
      populatedDocs,
      nonOverridableFields: NON_OVERRIDABLE_FIELDS,
    });
    if (driftOutput.hasDrift) {
      blockers.push("Downstream document drift detected.");
      warnings.push(...driftOutput.mismatches);
    }

    const hasAuditEvent = toStringValue(authoritativeContract.recordId).length > 0;
    if (!hasAuditEvent) {
      blockers.push("Audit event anchor cannot be created without recordId.");
    } else {
      auditSummary.push(`Audit anchor ready for record ${authoritativeContract.recordId}.`);
    }

    const custodyIntact = isLocked && !driftOutput.hasDrift;
    if (!custodyIntact) {
      blockers.push("Custody chain is not intact.");
    } else {
      auditSummary.push("Custody chain intact from authoritative record to generated docs.");
    }

    auditSummary.push(`Funding readiness hash: ${fundingReadiness.outputHash}`);
    auditSummary.push(`Title/lien checklist hash: ${titleLien.outputHash}`);
    auditSummary.push(`Drift detector hash: ${driftOutput.outputHash}`);

    let status: "GREEN" | "YELLOW" | "RED" = "GREEN";
    if (blockers.length > 0) status = "RED";
    else if (warnings.length > 0) status = "YELLOW";

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
      auditEvent: this.createAuditEvent(
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

