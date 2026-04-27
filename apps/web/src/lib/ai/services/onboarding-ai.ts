import { generateObject, zodSchema } from "ai";
import { classifyAIError, type AIErrorCode } from "@/lib/ai/errors";
import { getModel } from "@/lib/ai/client";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { sanitizeUserInputForLLM } from "@/lib/ai/sanitize";
import { onboardingExtractionSchema, type OnboardingExtraction } from "@/lib/ai/schemas";

export type OnboardingRole = "dealer" | "lender";

export type ExtractOnboardingRulesResult =
  | { ok: true; data: OnboardingExtraction }
  | { ok: false; error: string; code: AIErrorCode };

/**
 * Convert conversational onboarding text into strict JSON aligned with
 * DealerOnboardingAnswer / LenderOnboardingAnswer persistence (answerValue + ruleInference).
 */
export async function extractOnboardingRules(
  userAnswers: string,
  role: OnboardingRole = "dealer",
): Promise<ExtractOnboardingRulesResult> {
  const safe = sanitizeUserInputForLLM(userAnswers);
  if (!safe.trim()) {
    return { ok: false, error: "No onboarding text provided.", code: "VALIDATION" };
  }

  const roleHint =
    role === "dealer"
      ? "The respondent is an auto dealership."
      : "The respondent is an auto finance lender or captive.";

  try {
    const { object } = await generateObject({
      model: getModel("high-reasoning"),
      schema: zodSchema(onboardingExtractionSchema),
      schemaName: "OnboardingRules",
      schemaDescription: "Structured onboarding extraction for DealSeal workspaces",
      system: ONBOARDING_SYSTEM_PROMPT,
      prompt: `${roleHint}\n\nOnboarding answers (may be multi-step notes):\n---\n${safe}\n---\n\nExtract the schema.`,
    });

    const parsed = onboardingExtractionSchema.safeParse(object);
    if (!parsed.success) {
      return { ok: false, error: "AI output failed validation.", code: "VALIDATION" };
    }
    return { ok: true, data: parsed.data };
  } catch (e) {
    const { message, code } = classifyAIError(e);
    return { ok: false, error: message, code };
  }
}
