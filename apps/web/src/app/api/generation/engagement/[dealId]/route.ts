import { auth } from "@/lib/auth";
import { isAdminShellRole, isDealerStaffRole, isLenderStaffRole } from "@/lib/role-policy";
import { GenerationHubService } from "@/lib/services/generation-hub.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { dealId } = await params;
  const role = session.user.role;
  const workspaceId = session.user.workspaceId;

  try {
    const actor = isDealerStaffRole(role) ? "dealer" : isLenderStaffRole(role) ? "lender" : isAdminShellRole(role) ? "admin" : null;
    if (!actor) return Response.json({ error: "Forbidden" }, { status: 403 });
    const snapshot = await GenerationHubService.getSimultaneousEngagementSnapshot(actor, workspaceId, dealId);
    return Response.json(snapshot);
  } catch (e) {
    console.error("[DealSeal] generation engagement polling fallback", e);
    return Response.json(
      {
        openDealerAlerts: 0,
        lenderOpenTasks: 0,
        missingItems: 0,
        canSimultaneouslyCloseAndFund: false,
      },
      { status: 200 },
    );
  }
}
