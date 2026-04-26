import { NextResponse } from "next/server";
import {
  DealSealComplianceOrchestrator,
  type DealInput,
} from "@/lib/ai/dealseal-compliance-orchestrator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDealInput(body: unknown): { ok: true; value: DealInput } | { ok: false; issues: string[] } {
  if (!isRecord(body)) {
    return { ok: false, issues: ["Request body must be a JSON object."] };
  }

  const issues: string[] = [];
  const requiredTopLevel = ["state", "dealerId", "lenderId", "buyer", "vehicle", "financialTerms"] as const;
  for (const field of requiredTopLevel) {
    if (!(field in body)) {
      issues.push(`Missing required field: ${field}`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (!isRecord(body.buyer)) {
    issues.push("buyer must be an object");
  }
  if (!isRecord(body.vehicle)) {
    issues.push("vehicle must be an object");
  }
  if (!isRecord(body.financialTerms)) {
    issues.push("financialTerms must be an object");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: body as DealInput };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseDealInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.issues }, { status: 400 });
  }

  const orchestrator = new DealSealComplianceOrchestrator();
  const checkpoint = orchestrator.reviewBeforeConsummation(parsed.value);
  const generatedDocs = orchestrator.generateRequiredDealerDocs(parsed.value);

  return NextResponse.json(
    {
      ok: true,
      checkpoint,
      generatedDocs,
    },
    { status: 200 },
  );
}
