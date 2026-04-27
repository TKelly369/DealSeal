import { generateObject, zodSchema } from "ai";
import { classifyAIError, type AIErrorCode } from "@/lib/ai/errors";
import { getModel } from "@/lib/ai/client";
import { COMPLIANCE_REVIEW_PROMPT } from "@/lib/ai/prompts";
import { sanitizeUserInputForLLM } from "@/lib/ai/sanitize";
import { complianceReviewSchema, type ComplianceReview } from "@/lib/ai/schemas";

export type DealStructureForReview = {
  state: string;
  dealStatus?: string;
  financialsSummary?: string;
  vehicleSummary?: string;
  partiesSummary?: string;
  otherNotes?: string;
};

export type ReviewDealStructureResult =
  | { ok: true; data: ComplianceReview }
  | { ok: false; error: string; code: AIErrorCode };

function formatDealPayload(deal: DealStructureForReview): string {
  return [
    `State: ${deal.state}`,
    deal.dealStatus && `Deal status: ${deal.dealStatus}`,
    deal.financialsSummary && `Financials: ${deal.financialsSummary}`,
    deal.vehicleSummary && `Vehicle: ${deal.vehicleSummary}`,
    deal.partiesSummary && `Parties: ${deal.partiesSummary}`,
    deal.otherNotes && `Notes: ${deal.otherNotes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Produces structured compliance findings suitable for persisting ComplianceCheck rows
 * (deterministic services still enforce funding gates).
 */
export async function reviewDealStructure(
  dealData: DealStructureForReview,
  lenderRules: string,
  stateRules: string,
): Promise<ReviewDealStructureResult> {
  const dealBlock = sanitizeUserInputForLLM(formatDealPayload(dealData));
  const lender = sanitizeUserInputForLLM(lenderRules);
  const state = sanitizeUserInputForLLM(stateRules);

  if (!dealBlock.trim() || !dealData.state?.trim()) {
    return { ok: false, error: "Deal data and state are required.", code: "VALIDATION" };
  }

  try {
    const { object } = await generateObject({
      model: getModel("fast-extraction"),
      schema: zodSchema(complianceReviewSchema),
      schemaName: "ComplianceReview",
      schemaDescription: "Structured compliance audit results for a single deal",
      system: COMPLIANCE_REVIEW_PROMPT,
      prompt: `Deal facts:\n${dealBlock}\n\nLender rules (application-provided excerpt or summary):\n---\n${lender || "(none)"}\n---\n\nState rules (application-provided excerpt or summary):\n---\n${state || "(none)"}\n---\n\nReturn compliance checks.`,
    });

    const parsed = complianceReviewSchema.safeParse(object);
    if (!parsed.success) {
      return { ok: false, error: "AI compliance output failed validation.", code: "VALIDATION" };
    }
    return { ok: true, data: parsed.data };
  } catch (e) {
    const { message, code } = classifyAIError(e);
    return { ok: false, error: message, code };
  }
}
