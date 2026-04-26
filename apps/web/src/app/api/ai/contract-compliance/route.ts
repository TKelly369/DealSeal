import { NextResponse } from "next/server";
import { parseAiOnboardingIntake } from "@/lib/ai/intake-parser";
import { runAiComplianceEvaluation } from "@/lib/ai/compliance-engine";
import type { AiComplianceEvaluation, AiValidationFailure } from "@/lib/ai/types";

type ContractComplianceResponse = {
  ok: true;
  compliance: {
    decision: AiComplianceEvaluation["decision"];
    primaryState: AiComplianceEvaluation["primaryState"];
    gates: AiComplianceEvaluation["gates"];
    requiredPackageDocuments: string[];
    requiredDisclosures: string[];
    prohibitedClauses: string[];
    authoritativeRecordPlan: AiComplianceEvaluation["authoritativeRecordPlan"];
    packagePlan: AiComplianceEvaluation["packagePlan"];
  };
  audit: {
    evaluationId: string;
    generatedAt: string;
    engineVersion: string;
    rulePackVersion: string;
  };
};

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

  const evaluation = runAiComplianceEvaluation(parsed.value);
  if ("ok" in evaluation && !evaluation.ok) {
    return NextResponse.json(evaluation, { status: 400 });
  }

  const result = evaluation as AiComplianceEvaluation;
  const response: ContractComplianceResponse = {
    ok: true,
    compliance: {
      decision: result.decision,
      primaryState: result.primaryState,
      gates: result.gates,
      requiredPackageDocuments: result.requirements.requiredPackageDocuments,
      requiredDisclosures: result.requirements.requiredDisclosures,
      prohibitedClauses: result.requirements.prohibitedClauses,
      authoritativeRecordPlan: result.authoritativeRecordPlan,
      packagePlan: result.packagePlan,
    },
    audit: {
      evaluationId: result.evaluationId,
      generatedAt: result.generatedAt,
      engineVersion: result.engineVersion,
      rulePackVersion: result.rulePackVersion,
    },
  };

  return NextResponse.json(response, { status: 200 });
}
