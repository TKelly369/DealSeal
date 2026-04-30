import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";
import { AdminCalendarClient, type AdminCalendarEventRow } from "./AdminCalendarClient";
import { deleteAdminCalendarEventAction } from "./actions";

export default async function AdminCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/calendar");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const rows = await prisma.calendarEvent.findMany({
    orderBy: { startsAt: "asc" },
    take: 150,
    select: { id: true, kind: true, title: true, startsAt: true, workspaceId: true, dealId: true },
  });
  const events: AdminCalendarEventRow[] = rows.map((event) => ({
    id: event.id,
    kind: event.kind,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    workspaceId: event.workspaceId,
    dealId: event.dealId,
  }));

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Admin calendar</h1>
      <AdminCalendarClient events={events} deleteAction={deleteAdminCalendarEventAction} />
    </div>
  );
}
