import { NextResponse } from "next/server";
import {
  DealSealComplianceOrchestrator,
  type AuthoritativeContract,
  type DealInput,
} from "@/lib/ai/dealseal-compliance-orchestrator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAuthoritativeContract(
  body: unknown,
): { ok: true; value: AuthoritativeContract } | { ok: false; issues: string[] } {
  if (!isRecord(body)) {
    return { ok: false, issues: ["Request body must be a JSON object."] };
  }

  const issues: string[] = [];
  const requiredFields = [
    "recordId",
    "dealId",
    "state",
    "version",
    "status",
    "hash",
    "signedAt",
    "lockedAt",
    "contractData",
  ] as const;

  for (const field of requiredFields) {
    if (!(field in body)) {
      issues.push(`Missing required field: ${field}`);
    }
  }

  if (!isRecord(body.contractData)) {
    issues.push("contractData must be an object");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: body as AuthoritativeContract };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseAuthoritativeContract(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.issues }, { status: 400 });
  }

  const contract = parsed.value;
  const orchestrator = new DealSealComplianceOrchestrator();

  const syntheticDealInput: DealInput = {
    state: contract.state,
    dealerId: String(contract.contractData.dealerId ?? "unknown-dealer"),
    lenderId: String(contract.contractData.lenderId ?? "unknown-lender"),
    buyer: {
      name: String(contract.contractData.buyerName ?? ""),
      address: String(contract.contractData.buyerAddress ?? ""),
      email: String(contract.contractData.buyerEmail ?? ""),
    },
    vehicle: {
      year: Number(contract.contractData.vehicleYear ?? 0),
      make: String(contract.contractData.vehicleMake ?? ""),
      model: String(contract.contractData.vehicleModel ?? ""),
      vin: String(contract.contractData.vin ?? ""),
      mileage: Number(contract.contractData.mileage ?? 0),
    },
    financialTerms: {
      cashPrice: Number(contract.contractData.cashPrice ?? 0),
      downPayment: Number(contract.contractData.downPayment ?? 0),
      amountFinanced: Number(contract.contractData.amountFinanced ?? 0),
      apr: Number(contract.contractData.apr ?? 0),
      termMonths: Number(contract.contractData.termMonths ?? 0),
      monthlyPayment: Number(contract.contractData.monthlyPayment ?? 0),
      taxes: Number(contract.contractData.taxes ?? 0),
      fees: Number(contract.contractData.fees ?? 0),
      serviceContracts: Number(contract.contractData.serviceContracts ?? 0),
    },
  };

  const requiredDocs = orchestrator.generateRequiredDealerDocs(syntheticDealInput);
  const populatedDocs = orchestrator.populateDocsFromAuthoritativeContract(contract, requiredDocs);
  const fundingPackage = orchestrator.generateFundingPackage(contract, requiredDocs);
  const checkpoint = orchestrator.validatePostFundingCheckpoint(contract, populatedDocs);
  const drift = orchestrator.validateNoDownstreamDrift(contract, populatedDocs);

  return NextResponse.json(
    {
      ok: true,
      checkpoint,
      fundingPackage,
      populatedDocs,
      drift,
    },
    { status: 200 },
  );
}
