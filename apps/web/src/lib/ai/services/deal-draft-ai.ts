import { generateObject, zodSchema } from "ai";
import { classifyAIError, type AIErrorCode } from "@/lib/ai/errors";
import { getModel } from "@/lib/ai/client";
import { sanitizeUserInputForLLM } from "@/lib/ai/sanitize";
import { dealDraftAssistSchema, type DealDraftAssist } from "@/lib/ai/schemas";

export type DealDraftAssistInput = {
  state: string;
  buyerName: string;
  vehicleLabel: string;
  lenderName?: string;
  existing: {
    amountFinanced?: string;
    taxesAmount?: string;
    feesAmount?: string;
    downPaymentAmount?: string;
    totalSalePrice?: string;
    pricingNotes?: string;
    taxesNotes?: string;
    feesNotes?: string;
    addOnsNotes?: string;
    tradeInNotes?: string;
  };
};

export type DealDraftAssistResult =
  | { ok: true; data: DealDraftAssist }
  | { ok: false; error: string; code: AIErrorCode };

export async function suggestDealDraftFromAI(input: DealDraftAssistInput): Promise<DealDraftAssistResult> {
  const prompt = sanitizeUserInputForLLM(
    JSON.stringify(
      {
        state: input.state,
        buyer: input.buyerName,
        vehicle: input.vehicleLabel,
        lender: input.lenderName ?? "TBD",
        existing: input.existing,
      },
      null,
      2,
    ),
  );

  try {
    const { object } = await generateObject({
      model: getModel("fast-extraction"),
      schema: zodSchema(dealDraftAssistSchema),
      schemaName: "DealDraftAssist",
      schemaDescription: "Suggested deal draft values and notes for dealer data entry acceleration",
      system:
        "You are DealSeal deal assistant. Suggest conservative, plausible draft values for taxes/fees/pricing and notes. Do not fabricate legal approvals. Keep numeric fields as plain decimal strings without currency symbols.",
      prompt: `Generate suggested draft deal fields from this context:\n${prompt}`,
    });

    const parsed = dealDraftAssistSchema.safeParse(object);
    if (!parsed.success) {
      return { ok: false, error: "AI output failed validation.", code: "VALIDATION" };
    }
    return { ok: true, data: parsed.data };
  } catch (e) {
    const { message, code } = classifyAIError(e);
    return { ok: false, error: message, code };
  }
}
