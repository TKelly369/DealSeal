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

export const NON_OVERRIDABLE_FIELDS = [
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

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function readString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
