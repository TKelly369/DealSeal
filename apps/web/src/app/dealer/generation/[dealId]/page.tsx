import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isDealerStaffRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";
import { GenerationDealClient } from "@/components/generation/GenerationDealClient";

export default async function DealerGenerationDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/dealer/login?next=/dealer/generation/${dealId}`);
  if (!isDealerStaffRole(session.user.role)) redirect("/dashboard");
  const deal = await GenerationHubService.getDealForActor("dealer", session.user.workspaceId, dealId);
  if (!deal) redirect("/dealer/generation");
  const snapshot = await GenerationHubService.getSimultaneousEngagementSnapshot("dealer", session.user.workspaceId, dealId);

  return (
    <GenerationDealClient
      roleLabel="Dealer"
      dealId={deal.id}
      initial={{
        amountFinanced: deal.financials ? String(deal.financials.amountFinanced) : "",
        taxesAmount: deal.financials ? String(deal.financials.taxes) : "",
        feesAmount: deal.financials ? String(deal.financials.fees) : "",
        downPaymentAmount: "",
        totalSalePrice: deal.financials ? String(deal.financials.totalSalePrice) : "",
        pricingNotes: "",
        taxesNotes: "",
        feesNotes: "",
        addOnsNotes: "",
        tradeInNotes: "",
        aiQuestions: "",
      }}
      applyInput={async (input) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/dealer/login?next=/dealer/generation/${dealId}`);
        await GenerationHubService.applyCentralInput("dealer", fresh.user.workspaceId, dealId, input, fresh.user.id);
      }}
      runAiPopulate={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/dealer/login?next=/dealer/generation/${dealId}`);
        return GenerationHubService.aiPopulate("dealer", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
      runMismatchValidation={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/dealer/login?next=/dealer/generation/${dealId}`);
        return GenerationHubService.runMismatchValidation("dealer", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
      uploadDocForAi={async (fileName) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/dealer/login?next=/dealer/generation/${dealId}`);
        await GenerationHubService.uploadDocForAiAnalysis("dealer", fresh.user.workspaceId, dealId, fileName, fresh.user.id);
      }}
      engagementSnapshot={snapshot}
      automateEngagement={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/dealer/login?next=/dealer/generation/${dealId}`);
        return GenerationHubService.automateSimultaneousEngagement("dealer", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
    />
  );
}
