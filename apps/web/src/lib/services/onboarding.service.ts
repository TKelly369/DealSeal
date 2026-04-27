import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";

export const DEALER_ONBOARDING_QUESTION_KEYS = [
  "dealer.legal_name",
  "dealer.dba",
  "dealer.address_state_license",
  "dealer.operating_states",
  "dealer.financing_states",
  "dealer.doc_fee_policy",
  "dealer.tax_and_jurisdiction_practices",
  "dealer.trade_title_registration_process",
  "dealer.products_offered",
  "dealer.lender_enrollments",
  "dealer.user_authority_levels",
  "dealer.signature_mode",
  "dealer.forms_by_state_and_lender",
] as const;

export const LENDER_ONBOARDING_QUESTION_KEYS = [
  "lender.legal_identity_and_licensing",
  "lender.states_where_paper_bought",
  "lender.program_rules_and_underwriting",
  "lender.required_contract_forms",
  "lender.required_disclosures",
  "lender.assignment_and_assignee_language",
  "lender.prefunding_package_requirements",
  "lender.accepted_signature_types",
  "lender.required_proof_documents",
  "lender.repo_replevin_preferences",
  "lender.buyback_triggers",
  "lender.program_limits_apr_term_amount",
] as const;

export const OnboardingService = {
  async upsertDealerAnswer(dealerId: string, questionKey: string, answerValue: unknown, ruleInference?: unknown) {
    return prisma.dealerOnboardingAnswer.upsert({
      where: { id: `${dealerId}:${questionKey}` },
      create: {
        id: `${dealerId}:${questionKey}`,
        dealerId,
        questionKey,
        answerValue: answerValue as Prisma.InputJsonValue,
        ruleInference: (ruleInference ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        answerValue: answerValue as Prisma.InputJsonValue,
        ruleInference: (ruleInference ?? {}) as Prisma.InputJsonValue,
      },
    });
  },

  async upsertLenderAnswer(lenderId: string, questionKey: string, answerValue: unknown, ruleInference?: unknown) {
    return prisma.lenderOnboardingAnswer.upsert({
      where: { id: `${lenderId}:${questionKey}` },
      create: {
        id: `${lenderId}:${questionKey}`,
        lenderId,
        questionKey,
        answerValue: answerValue as Prisma.InputJsonValue,
        ruleInference: (ruleInference ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        answerValue: answerValue as Prisma.InputJsonValue,
        ruleInference: (ruleInference ?? {}) as Prisma.InputJsonValue,
      },
    });
  },
};
