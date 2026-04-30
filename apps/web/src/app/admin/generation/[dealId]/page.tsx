import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminShellRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";
import { GenerationDealClient } from "@/components/generation/GenerationDealClient";

export default async function AdminGenerationDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/admin/login?next=/admin/generation/${dealId}`);
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");
  const deal = await GenerationHubService.getDealForActor("admin", session.user.workspaceId, dealId);
  if (!deal) redirect("/admin/generation");
  const snapshot = await GenerationHubService.getSimultaneousEngagementSnapshot("admin", session.user.workspaceId, dealId);

  return (
    <GenerationDealClient
      roleLabel="Admin"
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
        if (!fresh?.user) redirect(`/admin/login?next=/admin/generation/${dealId}`);
        await GenerationHubService.applyCentralInput("admin", fresh.user.workspaceId, dealId, input, fresh.user.id);
      }}
      runAiPopulate={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/admin/login?next=/admin/generation/${dealId}`);
        return GenerationHubService.aiPopulate("admin", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
      runMismatchValidation={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/admin/login?next=/admin/generation/${dealId}`);
        return GenerationHubService.runMismatchValidation("admin", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
      uploadDocForAi={async (fileName) => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/admin/login?next=/admin/generation/${dealId}`);
        await GenerationHubService.uploadDocForAiAnalysis("admin", fresh.user.workspaceId, dealId, fileName, fresh.user.id);
      }}
      engagementSnapshot={snapshot}
      automateEngagement={async () => {
        "use server";
        const fresh = await auth();
        if (!fresh?.user) redirect(`/admin/login?next=/admin/generation/${dealId}`);
        return GenerationHubService.automateSimultaneousEngagement("admin", fresh.user.workspaceId, dealId, fresh.user.id);
      }}
    />
  );
}
