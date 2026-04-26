import { NextRequest, NextResponse } from "next/server";
import { DealSealComplianceOrchestratorAgent } from "@/lib/agents/compliance-orchestrator";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { recordId?: string };
  const recordId = body.recordId ?? "demo-record-001";

  const orchestrator = new DealSealComplianceOrchestratorAgent();
  const result = await orchestrator.validatePostFundingCheckpoint(recordId);

  return NextResponse.json(result);
}
