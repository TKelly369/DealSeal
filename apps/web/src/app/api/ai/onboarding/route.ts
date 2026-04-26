import { NextResponse } from "next/server";
import { parseAiOnboardingIntake } from "@/lib/ai/intake-parser";
import { runAiComplianceEvaluation } from "@/lib/ai/compliance-engine";
import type { AiComplianceEvaluation, AiOnboardingResponse, AiValidationFailure } from "@/lib/ai/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseAiOnboardingIntake(body);

  if (!parsed.ok) {
    const errorResponse: AiValidationFailure = {
      ok: false,
      error: "INVALID_INPUT",
      issues: parsed.issues,
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const result = runAiComplianceEvaluation(parsed.value);
  if ("ok" in result && !result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const success: AiOnboardingResponse = {
    ok: true,
    result: result as AiComplianceEvaluation,
  };
  return NextResponse.json(success, { status: 200 });
}
