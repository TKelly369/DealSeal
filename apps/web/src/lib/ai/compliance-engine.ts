import { createHash } from "crypto";
import { STATE_REQUIREMENTS } from "@/lib/ai/state-laws";
import {
  AI_ENGINE_VERSION,
  AI_RULE_PACK_VERSION,
  SUPPORTED_STATES,
  type AiComplianceEvaluation,
  type AiOnboardingIntake,
  type AiValidationFailure,
  type ComplianceGateResult,
  type SupportedState,
} from "@/lib/ai/types";

function toUpper(value: string): string {
  return value.trim().toUpperCase();
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeState(value: string): SupportedState | null {
  const upper = toUpper(value);
  if (SUPPORTED_STATES.includes(upper as SupportedState)) {
    return upper as SupportedState;
  }
  return null;
}

function validateInput(input: AiOnboardingIntake): string[] {
  const issues: string[] = [];
  if (!input.lender.legalName.trim()) issues.push("lender.legalName is required");
  if (!input.lender.lenderCode.trim()) issues.push("lender.lenderCode is required");
  if (!input.dealer.legalName.trim()) issues.push("dealer.legalName is required");
  if (!input.dealer.dealerCode.trim()) issues.push("dealer.dealerCode is required");

  const txState = normalizeState(input.transaction.state);
  if (!txState) {
    issues.push(`transaction.state must be one of: ${SUPPORTED_STATES.join(", ")}`);
  }

  const dealerState = normalizeState(input.dealer.licensedState);
  if (!dealerState) {
    issues.push(`dealer.licensedState must be one of: ${SUPPORTED_STATES.join(", ")}`);
  }

  if (input.transaction.amountFinanced <= 0) {
    issues.push("transaction.amountFinanced must be greater than 0");
  }
  if (input.transaction.aprBps <= 0) {
    issues.push("transaction.aprBps must be greater than 0");
  }
  if (input.transaction.termMonths <= 0) {
    issues.push("transaction.termMonths must be greater than 0");
  }
  if (input.lender.servicingStates.length === 0) {
    issues.push("lender.servicingStates must include at least one state");
  }
  return issues;
}

function evaluateGates(input: AiOnboardingIntake, primaryState: SupportedState): ComplianceGateResult[] {
  const lenderServicing = new Set(input.lender.servicingStates.map((s) => toUpper(s)));
  const dealerState = normalizeState(input.dealer.licensedState);
  const gates: ComplianceGateResult[] = [
    {
      gateId: "STATE_SUPPORTED",
      status: primaryState ? "PASS" : "FAIL",
      message: primaryState
        ? `Primary state ${primaryState} is currently supported by DealSeal AI compliance.`
        : "Transaction state is not supported.",
    },
    {
      gateId: "LENDER_SERVICING_STATE_MATCH",
      status: lenderServicing.has(primaryState) ? "PASS" : "FAIL",
      message: lenderServicing.has(primaryState)
        ? `Lender services ${primaryState}.`
        : `Lender servicing states do not include ${primaryState}.`,
    },
    {
      gateId: "DEALER_LICENSE_STATE_MATCH",
      status: dealerState === primaryState ? "PASS" : "FAIL",
      message:
        dealerState === primaryState
          ? "Dealer licensed state matches transaction state."
          : "Dealer licensed state does not match transaction state.",
    },
    {
      gateId: "APR_SANITY_CHECK",
      status: input.transaction.aprBps > 0 && input.transaction.aprBps < 5000 ? "PASS" : "FAIL",
      message:
        input.transaction.aprBps > 0 && input.transaction.aprBps < 5000
          ? "APR basis points are within configured onboarding range."
          : "APR basis points are outside configured onboarding range.",
    },
    {
      gateId: "AUTHORITATIVE_RECORD_ENFORCEMENT",
      status: "PASS",
      message:
        "Transaction will be anchored to one Authoritative Governing Record with immutable custody and downstream derivation.",
    },
  ];
  return gates;
}

export function runAiComplianceEvaluation(
  input: AiOnboardingIntake,
): AiComplianceEvaluation | AiValidationFailure {
  const issues = validateInput(input);
  if (issues.length > 0) {
    return {
      ok: false,
      error: "INVALID_INPUT",
      issues,
    };
  }

  const primaryState = normalizeState(input.transaction.state) as SupportedState;
  const requirements = STATE_REQUIREMENTS[primaryState];
  const gates = evaluateGates(input, primaryState);
  const decision = gates.every((gate) => gate.status === "PASS")
    ? "APPROVED_FOR_PACKAGE_GENERATION"
    : "REVIEW_REQUIRED";

  const generatedAt = new Date().toISOString();
  const evaluationId = sha256Hex(
    JSON.stringify({
      lenderCode: input.lender.lenderCode,
      dealerCode: input.dealer.dealerCode,
      state: primaryState,
      generatedAt,
      engineVersion: AI_ENGINE_VERSION,
      rulePackVersion: AI_RULE_PACK_VERSION,
    }),
  );

  return {
    evaluationId,
    generatedAt,
    engineVersion: AI_ENGINE_VERSION,
    rulePackVersion: AI_RULE_PACK_VERSION,
    primaryState,
    intake: input,
    requirements,
    gates,
    decision,
    authoritativeRecordPlan: {
      model: "AUTHORITATIVE_GOVERNING_RECORD_V1",
      authoritativeDataSources: [
        "Signed governing contract payload",
        "Counterparty identity metadata",
        "Execution event ledger",
        "Versioned amendment lineage",
      ],
      chainOfCustodyControls: [
        "Single locked governing record per transaction version",
        "Immutable hash checksum at lock",
        "Role-bound render and package generation policies",
        "Audit event capture for every read/render/export action",
      ],
      downstreamPopulationTargets: [
        "State disclosure addendum",
        "Title and lien filing packet",
        "Package manifest and investor handoff record",
      ],
      prohibitedOperations: [
        "No direct mutation of locked governing payload",
        "No downstream form generation from unsigned convenience copies",
      ],
    },
    packagePlan: {
      primaryState,
      requiredPackageDocuments: requirements.requiredPackageDocuments,
      autofillStrategy:
        "Downstream documents are auto-populated from authoritative governing record fields only.",
      recordLineage: {
        sourceRecord: "AUTHORITATIVE_GOVERNING_RECORD",
        outputRecordKinds: [
          "CERTIFIED_RENDERING",
          "STATE_DISCLOSURE_FORMS",
          "TITLE_AND_LIEN_PACKET",
          "PACKAGE_MANIFEST",
        ],
      },
    },
  };
}
