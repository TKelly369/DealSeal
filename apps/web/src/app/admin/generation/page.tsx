import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminShellRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";
import { GenerationHubClient } from "@/components/generation/GenerationHubClient";

export default async function AdminGenerationPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/generation");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");
  const deals = await GenerationHubService.listDealsForActor("admin", session.user.workspaceId);
  return (
    <GenerationHubClient
      roleLabel="Admin"
      basePath="/admin/generation"
      deals={deals.map((d) => ({
        id: d.id,
        state: d.state,
        status: d.status,
        updatedAt: d.updatedAt.toISOString(),
        dealerName: d.dealer.name,
        lenderName: d.lender.name,
      }))}
    />
  );
}
