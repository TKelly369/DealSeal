import { auth } from "@/lib/auth";
import { NotificationService } from "@/lib/services/notification.service";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  const scoped = await NotificationService.getNotificationsForWorkspace(
    session.user.workspaceId,
    session.user.id,
  );
  const ids = body.all ? scoped.records.map((n) => n.id) : body.ids ?? [];
  const result = await NotificationService.markAsRead(ids, session.user.workspaceId, session.user.id);
  return Response.json({ updated: result.count });
}

