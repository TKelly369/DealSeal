import { auth } from "@/lib/auth";
import { LenderOnboardingWizard } from "@/components/lender/LenderOnboardingWizard";
import { processLenderOnboarding } from "@/lib/ai/onboarding";
import { extractOnboardingRules } from "@/lib/ai/services/onboarding-ai";
import {
  lenderOnboardingExtendedDetails,
  lenderOnboardingToProfileScalars,
} from "@/lib/lender-onboarding-schema";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { redirect } from "next/navigation";

export default async function LenderOnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/onboarding");

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender onboarding</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720, marginBottom: "1.25rem" }}>
        Capture your legal identity, licensing, dealer policy, document requirements, signature and funding rules, and
        risk triggers. This feeds your lender profile and archived onboarding answers for compliance and rule
        automation.
      </p>
      <LenderOnboardingWizard
        title="Program setup"
        onFinish={async (answers) => {
          "use server";
          const fresh = await auth();
          if (!fresh?.user) redirect("/lender/login?next=/lender/onboarding");

          const workspaceId = fresh.user.workspaceId;
          const extended = lenderOnboardingExtendedDetails(answers);
          const profileScalars = lenderOnboardingToProfileScalars(answers);

          const narrative = JSON.stringify({ answers, extended }, null, 2);
          const extracted = await extractOnboardingRules(narrative, "lender");
          if (!extracted.ok) {
            throw new Error(extracted.error);
          }

          const deterministic = processLenderOnboarding("final", answers);
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

          await prisma.lenderProfile.upsert({
            where: { workspaceId },
            update: profileScalars,
            create: { workspaceId, ...profileScalars },
          });

          await prisma.lenderOnboardingAnswer.create({
            data: {
              lenderId: workspaceId,
              questionKey: extracted.data.questionKey,
              answerValue: answerValue as Prisma.InputJsonValue,
              ruleInference: ruleInference as Prisma.InputJsonValue,
            },
          });

          redirect("/lender/dashboard");
        }}
      />
    </div>
  );
}
