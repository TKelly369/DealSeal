import { z } from "zod";

const ruleInferenceItemSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  confidence: z.number().min(0).max(1),
});

/** Matches fields persisted on DealerOnboardingAnswer / LenderOnboardingAnswer (answerValue + ruleInference JSON). */
export const onboardingExtractionSchema = z.object({
  questionKey: z
    .string()
    .describe("Stable key for this extraction batch, e.g. onboarding-ai-final"),
  answerValue: z.object({
    narrativeSummary: z.string(),
    extractedFacts: z.array(
      z.object({
        fact: z.string(),
        sourceSpan: z.string().optional(),
      }),
    ),
  }),
  ruleInference: z.object({
    inferences: z.array(ruleInferenceItemSchema),
    operatingStates: z.array(z.string()).optional(),
    licensedStates: z.array(z.string()).optional(),
    maxLtvPercent: z.number().nullable().optional(),
    allowedDealTypes: z.array(z.string()).optional(),
    signingMethodPreference: z.enum(["WET", "E_SIGN", "HYBRID"]).optional(),
    riskFlags: z.array(z.string()).optional(),
    complianceNotes: z.array(z.string()).optional(),
  }),
});

export type OnboardingExtraction = z.infer<typeof onboardingExtractionSchema>;

const complianceCheckDraftSchema = z.object({
  ruleSet: z.enum(["STATE", "LENDER"]),
  status: z.enum(["COMPLIANT", "WARNING", "BLOCKED"]),
  affectedField: z.string().nullable().optional(),
  explanation: z.string(),
  ruleSource: z.string(),
  suggestedCorrection: z.string().nullable().optional(),
});

export const complianceReviewSchema = z.object({
  checks: z.array(complianceCheckDraftSchema),
  executiveSummary: z.string().optional(),
});

export type ComplianceReview = z.infer<typeof complianceReviewSchema>;
export type ComplianceCheckDraft = z.infer<typeof complianceCheckDraftSchema>;
