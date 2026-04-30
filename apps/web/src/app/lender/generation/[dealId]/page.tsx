import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isLenderStaffRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";
import { GenerationDealClient } from "@/components/generation/GenerationDealClient";

export default async function LenderGenerationDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/lender/login?next=/lender/generation/${dealId}`);
  if (!isLenderStaffRole(session.user.role)) redirect("/dashboard");
  const deal = await GenerationHubService.getDealForActor("lender", session.user.workspaceId, dealId);
  if (!deal) redirect("/lender/generation");
  const snapshot = await GenerationHubService.getSimultaneousEngagementSnapshot("lender", session.user.workspaceId, dealId);

  return (
    <GenerationDealClient
      roleLabel="Lender"
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
        if (!fresh?.user) redirect(`/lender/login?next=/lender/generation/${dealId}`);
        await GenerationHubService.applyCentralInput("lender", fresh.user.workspaceId, dealId, input, fresh.user.id);
      }}
      runAiPopulate={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/lender/login?next=/lender/generation/${dealId}`);
        return GenerationHubService.aiPopulate("lender", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
      runMismatchValidation={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/lender/login?next=/lender/generation/${dealId}`);
        return GenerationHubService.runMismatchValidation("lender", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
      uploadDocForAi={async (fileName) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/lender/login?next=/lender/generation/${dealId}`);
        await GenerationHubService.uploadDocForAiAnalysis("lender", fresh.user.workspaceId, dealId, fileName, fresh.user.id);
      }}
      engagementSnapshot={snapshot}
      automateEngagement={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/lender/login?next=/lender/generation/${dealId}`);
        return GenerationHubService.automateSimultaneousEngagement("lender", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
    />
  );
}
