export const AI_ENGINE_VERSION = "dealseal-ai-compliance-v1";
export const AI_RULE_PACK_VERSION = "2026.04.26";

export const SUPPORTED_STATES = ["CA", "TX", "FL", "NY"] as const;
export type SupportedState = (typeof SUPPORTED_STATES)[number];

export type FundingModel = "DIRECT" | "INDIRECT";
export type VehicleCondition = "NEW" | "USED";

export type LenderIntake = {
  legalName: string;
  lenderCode: string;
  servicingStates: string[];
  fundingModel: FundingModel;
};

export type DealerIntake = {
  legalName: string;
  dealerCode: string;
  licensedState: string;
  hasPowerOfAttorneyProcess: boolean;
};

export type TransactionIntake = {
  state: string;
  vehicleCondition: VehicleCondition;
  amountFinanced: number;
  aprBps: number;
  termMonths: number;
};

export type AiOnboardingIntake = {
  lender: LenderIntake;
  dealer: DealerIntake;
  transaction: TransactionIntake;
};

export type StateRequirementSet = {
  state: SupportedState;
  governingLawReferences: string[];
  requiredDisclosures: string[];
  requiredPackageDocuments: string[];
  wetInkRequiredDocuments: string[];
  prohibitedClauses: string[];
  titlePerfectionRules: string[];
};

export type ComplianceGateResult = {
  gateId: string;
  status: "PASS" | "FAIL";
  message: string;
};

export type ComplianceDecision = "APPROVED_FOR_PACKAGE_GENERATION" | "REVIEW_REQUIRED";

export type AuthoritativeRecordPlan = {
  model: "AUTHORITATIVE_GOVERNING_RECORD_V1";
  authoritativeDataSources: string[];
  chainOfCustodyControls: string[];
  downstreamPopulationTargets: string[];
  prohibitedOperations: string[];
};

export type GeneratedPackagePlan = {
  primaryState: SupportedState;
  requiredPackageDocuments: string[];
  autofillStrategy: string;
  recordLineage: {
    sourceRecord: "AUTHORITATIVE_GOVERNING_RECORD";
    outputRecordKinds: string[];
  };
};

export type AiComplianceEvaluation = {
  evaluationId: string;
  generatedAt: string;
  engineVersion: string;
  rulePackVersion: string;
  primaryState: SupportedState;
  intake: AiOnboardingIntake;
  requirements: StateRequirementSet;
  gates: ComplianceGateResult[];
  decision: ComplianceDecision;
  authoritativeRecordPlan: AuthoritativeRecordPlan;
  packagePlan: GeneratedPackagePlan;
};

export type AiValidationFailure = {
  ok: false;
  error: "INVALID_INPUT";
  issues: string[];
};

export type AiOnboardingResponse = {
  ok: true;
  result: AiComplianceEvaluation;
};
