import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isLenderStaffRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";
import { GenerationHubClient } from "@/components/generation/GenerationHubClient";

export default async function LenderGenerationPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/generation");
  if (!isLenderStaffRole(session.user.role)) redirect("/dashboard");
  const deals = await GenerationHubService.listDealsForActor("lender", session.user.workspaceId);
  return (
    <GenerationHubClient
      roleLabel="Lender"
      basePath="/lender/generation"
      deals={deals.map((d) => ({
        id: d.id,
        state: d.state,
        status: d.status,
        updatedAt: d.updatedAt.toISOString(),
        dealerName: d.dealer.name,
      }))}
    />
  );
}
