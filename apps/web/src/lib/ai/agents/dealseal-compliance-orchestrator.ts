import {
  type AuditStyleEvent,
  type AuthoritativeContract,
  type ComplianceReport,
  DEALSEAL_COMPLIANCE_ORCHESTRATOR_ACTOR,
  type DealInput,
  type DriftValidationResult,
  type FundingPackageResult,
  type GeneratedDealerDocument,
  type LegalResearchPlaceholder,
  NON_OVERRIDABLE_FIELDS,
  type PopulatedDocument,
  type PostFundingCheckpointResult,
  type PreConsummationCheckpointResult,
  readString,
  sha256Hex,
} from "@/lib/ai/agents/types";
import { AuditCustodyAgent } from "@/lib/ai/agents/audit-custody-agent";
import { DocumentGenerationAgent } from "@/lib/ai/agents/document-generation-agent";
import { DownstreamDriftDetectionAgent } from "@/lib/ai/agents/downstream-drift-detection-agent";
import { FundingPackageAgent } from "@/lib/ai/agents/funding-package-agent";
import { StateLawResearchAgent } from "@/lib/ai/agents/state-law-research-agent";
import { TitleLienFilingAgent } from "@/lib/ai/agents/title-lien-filing-agent";

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
    const state = readString(dealInput.state).toUpperCase();

    if (!state) {
      issues.push("State is required.");
      requiredFixes.push("Provide transaction state before consummation.");
    }
    if (!readString(dealInput.dealerId)) {
      issues.push("Dealer identity fields are incomplete.");
      requiredFixes.push("Provide valid dealerId.");
    }
    if (!readString(dealInput.lenderId)) {
      issues.push("Lender identity fields are incomplete.");
      requiredFixes.push("Provide valid lenderId.");
    }
    if (!readString(buyer.name) || !readString(buyer.address) || !readString(buyer.email)) {
      issues.push("Buyer identity fields are incomplete.");
      requiredFixes.push("Provide buyer name, address, and email.");
    }
    if (!readString(vehicle.make) || !readString(vehicle.model) || vehicle.year <= 0) {
      issues.push("Vehicle fields are incomplete.");
      requiredFixes.push("Provide vehicle year/make/model.");
    }
    if (!readString(vehicle.vin)) {
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

    if (!readString(dealInput.dealerId) || !readString(dealInput.lenderId)) {
      issues.push("Assignment readiness cannot be validated.");
      requiredFixes.push("Provide dealer and lender assignment identity anchors.");
    }

    if (!readString(vehicle.vin) || !readString(buyer.name) || terms.amountFinanced <= 0) {
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
        `pre-${readString(dealInput.dealerId)}-${readString(dealInput.lenderId)}`,
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
    const packageHash = sha256Hex({
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
          if (directValue !== undefined && directValue !== null && readString(directValue) !== "") {
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
          if (cursor !== undefined && cursor !== null && readString(cursor) !== "") {
            populatedFields[field] = cursor;
          } else {
            missingFields.push(field);
          }
        }

        const hashOfPopulatedDoc = sha256Hex({
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
      readString(authoritativeContract.status).toUpperCase() === "LOCKED" &&
      readString(authoritativeContract.lockedAt).length > 0;
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

    const missingHashes = populatedDocs.filter((doc) => !readString(doc.hashOfPopulatedDoc)).length;
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

    const hasAuditEvent = readString(authoritativeContract.recordId).length > 0;
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
