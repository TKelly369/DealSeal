import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isDealerStaffRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";
import { GenerationHubClient } from "@/components/generation/GenerationHubClient";

export default async function DealerGenerationPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/generation");
  if (!isDealerStaffRole(session.user.role)) redirect("/dashboard");
  const deals = await GenerationHubService.listDealsForActor("dealer", session.user.workspaceId);
  return (
    <GenerationHubClient
      roleLabel="Dealer"
      basePath="/dealer/generation"
      deals={deals.map((d) => ({
        id: d.id,
        state: d.state,
        status: d.status,
        updatedAt: d.updatedAt.toISOString(),
        lenderName: d.lender.name,
      }))}
    />
  );
}
