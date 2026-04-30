import { auth } from "@/lib/auth";
import { DealerOnboardingWizard } from "@/components/dealer/DealerOnboardingWizard";
import { processDealerOnboarding } from "@/lib/ai/onboarding";
import { extractOnboardingRules } from "@/lib/ai/services/onboarding-ai";
import { dealerOnboardingExtendedDetails, dealerOnboardingToProfileScalars } from "@/lib/dealer-onboarding-schema";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { redirect } from "next/navigation";

export default async function DealerOnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/onboarding");

  return (
    <div className="ds-section-shell">
      <DealerOnboardingWizard
        title="A. Dealer onboarding"
        onFinish={async (answers) => {
          "use server";
          const fresh = await auth();
          if (!fresh?.user) redirect("/dealer/login?next=/dealer/onboarding");

          const workspaceId = fresh.user.workspaceId;
          const extended = dealerOnboardingExtendedDetails(answers);
          const profileScalars = dealerOnboardingToProfileScalars(answers);

          const narrative = JSON.stringify({ answers, extended }, null, 2);
          const extracted = await extractOnboardingRules(narrative, "dealer");
          if (!extracted.ok) {
            throw new Error(extracted.error);
          }

          const deterministic = processDealerOnboarding("final", answers);
          const answerValue = {
            answers,
            extended,
            ai: {
              narrativeSummary: extracted.data.answerValue.narrativeSummary,
              extractedFacts: extracted.data.answerValue.extractedFacts,
            },
          };
          const ruleInference = {
            ...extracted.data.ruleInference,
            deterministicEcho: deterministic,
          };

          await prisma.dealerProfile.upsert({
            where: { workspaceId },
            update: profileScalars,
            create: { workspaceId, ...profileScalars },
          });

          await prisma.dealerOnboardingAnswer.create({
            data: {
              dealerId: workspaceId,
              questionKey: extracted.data.questionKey,
              answerValue: answerValue as Prisma.InputJsonValue,
              ruleInference: ruleInference as Prisma.InputJsonValue,
            },
          });

          redirect("/dealer/dashboard");
        }}
      />
    </div>
  );
}
