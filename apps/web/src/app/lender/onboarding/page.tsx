import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/shared/OnboardingWizard";
import { processLenderOnboarding } from "@/lib/ai/onboarding";
import { extractOnboardingRules } from "@/lib/ai/services/onboarding-ai";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

const steps = [
  "Entity Info",
  "Licensed States",
  "Dealer Network Rules",
  "Contract Formats/Clauses",
  "Funding/Assignment Rules",
];

export default async function LenderOnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/onboarding");
  return (
    <OnboardingWizard
      title="Lender Onboarding"
      steps={steps}
      onFinish={async (answers) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect("/login?next=/lender/onboarding");
        const narrative = JSON.stringify(answers, null, 2);
        const extracted = await extractOnboardingRules(narrative, "lender");
        if (!extracted.ok) {
          throw new Error(extracted.error);
        }
        const deterministic = processLenderOnboarding("final", answers);
        const answerValue = {
          ...answers,
          ai: {
            narrativeSummary: extracted.data.answerValue.narrativeSummary,
            extractedFacts: extracted.data.answerValue.extractedFacts,
          },
        };
        const ruleInference = {
          ...extracted.data.ruleInference,
          deterministicEcho: deterministic,
        };
        await prisma.lenderProfile.upsert({
          where: { workspaceId: fresh.user.workspaceId },
          update: {
            legalName: String(answers["Entity Info"] || "Lender Legal Name"),
            licensedStates: ["TX"],
            acceptedDealerTypes: ["FRANCHISE", "INDEPENDENT"],
            assignmentType: "IMMEDIATE",
          },
          create: {
            workspaceId: fresh.user.workspaceId,
            legalName: String(answers["Entity Info"] || "Lender Legal Name"),
            entityType: "FINANCE",
            licensedStates: ["TX"],
            acceptedDealerTypes: ["FRANCHISE", "INDEPENDENT"],
            assignmentType: "IMMEDIATE",
          },
        });
        await prisma.lenderOnboardingAnswer.create({
          data: {
            lenderId: fresh.user.workspaceId,
            questionKey: extracted.data.questionKey,
            answerValue: answerValue as Prisma.InputJsonValue,
            ruleInference: ruleInference as Prisma.InputJsonValue,
          },
        });
        redirect("/lender");
      }}
    />
  );
}
