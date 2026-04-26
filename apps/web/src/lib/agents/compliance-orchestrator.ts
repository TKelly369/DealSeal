import { AuditCustodyAgent } from "@/lib/agents/audit-custody-agent";
import { DocumentGenerationAgent } from "@/lib/agents/document-generation-agent";
import { DownstreamDriftDetectionAgent } from "@/lib/agents/drift-detection-agent";
import { FundingPackageAgent } from "@/lib/agents/funding-package-agent";
import { StateLawResearchAgent } from "@/lib/agents/state-law-research-agent";
import { TitleLienFilingAgent } from "@/lib/agents/title-lien-filing-agent";
import {
  CheckpointResult,
  ComplianceReport,
  FundingPackage,
  GeneratedDoc,
  PopulationResult,
} from "@/lib/agents/types";
import { getDemoRecordById } from "@/lib/demo-records";

export class DealSealComplianceOrchestratorAgent {
  private readonly stateLawResearchAgent = new StateLawResearchAgent();
  private readonly documentGenerationAgent = new DocumentGenerationAgent();
  private readonly fundingPackageAgent = new FundingPackageAgent();
  private readonly titleLienFilingAgent = new TitleLienFilingAgent();
  private readonly driftDetectionAgent = new DownstreamDriftDetectionAgent();
  private readonly auditCustodyAgent = new AuditCustodyAgent();

  async reviewBeforeConsummation(recordId: string): Promise<CheckpointResult> {
    const record = getDemoRecordById(recordId);
    if (!record) {
      return {
        checkpoint: "pre-consummation",
        status: "fail",
        findings: ["Authoritative record was not found for compliance review."],
      };
    }

    const lawResult = await this.stateLawResearchAgent.researchStateLaw("TX", "vehicle-retail-installment");
    return {
      checkpoint: "pre-consummation",
      status: "pass",
      findings: [
        `Applicable statutes reviewed: ${lawResult.applicableStatutes.join(", ")}`,
        `Required disclosures identified: ${lawResult.requiredDisclosures.length}`,
      ],
    };
  }

  async generateRequiredDealerDocs(recordId: string): Promise<GeneratedDoc[]> {
    return this.documentGenerationAgent.generateDocs(recordId, [
      "Dealer Compliance Certification",
      "Risk Retention Acknowledgement",
      "Privacy and Data Consent",
    ]);
  }

  async generateFundingPackage(recordId: string): Promise<FundingPackage> {
    return this.fundingPackageAgent.generateFundingPackage(recordId);
  }

  async populateDocsFromAuthoritativeContract(recordId: string): Promise<PopulationResult> {
    const populatedDocuments = await this.documentGenerationAgent.generateDocs(recordId, [
      "Lender Funding Cover Sheet",
      "Dealer Participation Summary",
    ]);
    return {
      recordId,
      populatedDocuments,
      warnings: [],
    };
  }

  async validatePostFundingCheckpoint(recordId: string): Promise<CheckpointResult> {
    const driftReport = await this.driftDetectionAgent.detectDrift(recordId);
    const hasDrift = driftReport.documents.some((doc) => doc.driftStatus === "drift_detected");
    return {
      checkpoint: "post-funding",
      status: hasDrift ? "fail" : "pass",
      findings: hasDrift
        ? ["Detected downstream drift against authoritative contract."]
        : ["No downstream drift detected.", "Funding and filing package remains aligned."],
    };
  }

  async produceComplianceReport(recordId: string): Promise<ComplianceReport> {
    const stateLaw = await this.stateLawResearchAgent.researchStateLaw("TX", "vehicle-retail-installment");
    const preConsummationCheckpoint = await this.reviewBeforeConsummation(recordId);
    const fundingPackage = await this.generateFundingPackage(recordId);
    const filingResult = await this.titleLienFilingAgent.prepareFiling(recordId, "TX");
    const driftReport = await this.driftDetectionAgent.detectDrift(recordId);
    const postFundingCheckpoint = await this.validatePostFundingCheckpoint(recordId);
    const auditTrail = await this.auditCustodyAgent.produceAuditTrail(recordId);

    return {
      recordId,
      stateLaw,
      preConsummationCheckpoint,
      postFundingCheckpoint,
      fundingPackage,
      filingResult,
      driftReport,
      auditTrail,
    };
  }
}
