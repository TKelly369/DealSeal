export type CheckpointStatus = "pass" | "fail";
export type PipelineStepStatus = "PENDING" | "PASS" | "FAIL";

export interface StateLawResult {
  state: string;
  dealType: string;
  applicableStatutes: string[];
  requiredDisclosures: string[];
  filingRequirements: string[];
  rateCaps: string[];
  coolingOffPeriods: string[];
}

export interface GeneratedDoc {
  title: string;
  type: string;
  status: "generated" | "pending";
  sourceRecordId: string;
}

export interface FundingPackage {
  recordId: string;
  dealSummary: string;
  lenderForms: string[];
  dealerForms: string[];
  complianceChecklist: string[];
}

export interface FilingResult {
  recordId: string;
  filingType: string;
  jurisdiction: string;
  status: "ready" | "pending" | "blocked";
  requiredDocuments: string[];
}

export interface DriftDocumentStatus {
  documentName: string;
  driftStatus: "no_drift" | "drift_detected";
  notes: string;
}

export interface DriftReport {
  recordId: string;
  documents: DriftDocumentStatus[];
}

export interface AuditCheckpoint {
  checkpoint: string;
  timestamp: string;
  hash: string;
}

export interface AuditTrail {
  recordId: string;
  custodyChain: string[];
  hashChain: string[];
  checkpointHistory: AuditCheckpoint[];
}

export interface CheckpointResult {
  checkpoint: "pre-consummation" | "post-funding";
  status: CheckpointStatus;
  findings: string[];
}

export interface PopulationResult {
  recordId: string;
  populatedDocuments: GeneratedDoc[];
  warnings: string[];
}

export interface ComplianceReport {
  recordId: string;
  stateLaw: StateLawResult;
  preConsummationCheckpoint: CheckpointResult;
  postFundingCheckpoint: CheckpointResult;
  fundingPackage: FundingPackage;
  filingResult: FilingResult;
  driftReport: DriftReport;
  auditTrail: AuditTrail;
}
