import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/shared/OnboardingWizard";
import { processDealerOnboarding } from "@/lib/ai/onboarding";
import { extractOnboardingRules } from "@/lib/ai/services/onboarding-ai";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

const steps = [
  "Entity Info",
  "States/Licensing",
  "DMS/Integration",
  "Add-ons/Fees",
  "Lender Selection",
  "Signing/Compliance",
];

export default async function DealerOnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/dealer/onboarding");

  return (
    <OnboardingWizard
      title="Dealer Onboarding"
      steps={steps}
      onFinish={async (answers) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect("/login?next=/dealer/onboarding");
        const narrative = JSON.stringify(answers, null, 2);
        const extracted = await extractOnboardingRules(narrative, "dealer");
        if (!extracted.ok) {
          throw new Error(extracted.error);
        }
        const deterministic = processDealerOnboarding("final", answers);
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
        await prisma.dealerProfile.upsert({
          where: { workspaceId: fresh.user.workspaceId },
          update: {
            legalName: String((answers["Entity Info"] as string) || "Dealer Legal Name"),
            stateOfFormation: "TX",
            operatingStates: ["TX"],
            addOnsOffered: ["GAP", "Warranty"],
          },
          create: {
            workspaceId: fresh.user.workspaceId,
            legalName: String((answers["Entity Info"] as string) || "Dealer Legal Name"),
            stateOfFormation: "TX",
            operatingStates: ["TX"],
            addOnsOffered: ["GAP", "Warranty"],
            dmsProvider: "DealerTrack",
            vehicleTypes: "BOTH",
            signingMethod: "HYBRID",
            licenseNumber: "D-10021",
          },
        });
        await prisma.dealerOnboardingAnswer.create({
          data: {
            dealerId: fresh.user.workspaceId,
            questionKey: extracted.data.questionKey,
            answerValue: answerValue as Prisma.InputJsonValue,
            ruleInference: ruleInference as Prisma.InputJsonValue,
          },
        });
        redirect("/dealer");
      }}
    />
  );
}
