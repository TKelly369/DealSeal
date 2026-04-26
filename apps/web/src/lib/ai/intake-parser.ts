import type { AiOnboardingIntake, FundingModel, VehicleCondition } from "@/lib/ai/types";

type ParseSuccess = {
  ok: true;
  value: AiOnboardingIntake;
};

type ParseFailure = {
  ok: false;
  issues: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, path: string, issues: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path} must be a non-empty string`);
    return "";
  }
  return value.trim();
}

function asBoolean(value: unknown, path: string, issues: string[]): boolean {
  if (typeof value !== "boolean") {
    issues.push(`${path} must be a boolean`);
    return false;
  }
  return value;
}

function asPositiveNumber(value: unknown, path: string, issues: string[]): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    issues.push(`${path} must be a number greater than 0`);
    return 0;
  }
  return value;
}

function asStringArray(value: unknown, path: string, issues: string[]): string[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array of strings`);
    return [];
  }
  const collected = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (collected.length !== value.length) {
    issues.push(`${path} must contain only non-empty strings`);
  }
  return collected.map((item) => item.trim().toUpperCase());
}

function asFundingModel(value: unknown, path: string, issues: string[]): FundingModel {
  if (value === "DIRECT" || value === "INDIRECT") {
    return value;
  }
  issues.push(`${path} must be DIRECT or INDIRECT`);
  return "DIRECT";
}

function asVehicleCondition(value: unknown, path: string, issues: string[]): VehicleCondition {
  if (value === "NEW" || value === "USED") {
    return value;
  }
  issues.push(`${path} must be NEW or USED`);
  return "USED";
}

export function parseAiOnboardingIntake(input: unknown): ParseSuccess | ParseFailure {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: ["Request body must be a JSON object"],
    };
  }

  const lenderRaw = input.lender;
  const dealerRaw = input.dealer;
  const transactionRaw = input.transaction;

  if (!isRecord(lenderRaw)) issues.push("lender must be an object");
  if (!isRecord(dealerRaw)) issues.push("dealer must be an object");
  if (!isRecord(transactionRaw)) issues.push("transaction must be an object");

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const lenderInput = lenderRaw as Record<string, unknown>;
  const dealerInput = dealerRaw as Record<string, unknown>;
  const transactionInput = transactionRaw as Record<string, unknown>;

  const lender = {
    legalName: asNonEmptyString(lenderInput.legalName, "lender.legalName", issues),
    lenderCode: asNonEmptyString(lenderInput.lenderCode, "lender.lenderCode", issues),
    servicingStates: asStringArray(lenderInput.servicingStates, "lender.servicingStates", issues),
    fundingModel: asFundingModel(lenderInput.fundingModel, "lender.fundingModel", issues),
  };

  const dealer = {
    legalName: asNonEmptyString(dealerInput.legalName, "dealer.legalName", issues),
    dealerCode: asNonEmptyString(dealerInput.dealerCode, "dealer.dealerCode", issues),
    licensedState: asNonEmptyString(dealerInput.licensedState, "dealer.licensedState", issues).toUpperCase(),
    hasPowerOfAttorneyProcess: asBoolean(
      dealerInput.hasPowerOfAttorneyProcess,
      "dealer.hasPowerOfAttorneyProcess",
      issues,
    ),
  };

  const transaction = {
    state: asNonEmptyString(transactionInput.state, "transaction.state", issues).toUpperCase(),
    vehicleCondition: asVehicleCondition(transactionInput.vehicleCondition, "transaction.vehicleCondition", issues),
    amountFinanced: asPositiveNumber(transactionInput.amountFinanced, "transaction.amountFinanced", issues),
    aprBps: asPositiveNumber(transactionInput.aprBps, "transaction.aprBps", issues),
    termMonths: asPositiveNumber(transactionInput.termMonths, "transaction.termMonths", issues),
  };

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      lender,
      dealer,
      transaction,
    },
  };
}
