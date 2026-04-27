import { auth } from "@/lib/auth";
import { NotificationService } from "@/lib/services/notification.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await NotificationService.getNotificationsForWorkspace(
    session.user.workspaceId,
    session.user.id,
  );
  return Response.json(result);
}

