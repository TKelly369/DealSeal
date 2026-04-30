import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";

export async function loadDealerDealOrRedirect(dealId: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/dealer/login?next=${encodeURIComponent(`/dealer/deals/${dealId}`)}`);
  }
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "dealer");
  if (!deal) {
    redirect("/dealer/deals");
  }
  return { session, deal };
}
