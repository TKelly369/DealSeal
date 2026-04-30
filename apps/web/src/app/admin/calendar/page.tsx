import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminCalendarPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/calendar");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const events = await prisma.calendarEvent.findMany({
    orderBy: { startsAt: "asc" },
    take: 150,
    select: { id: true, kind: true, title: true, startsAt: true, workspaceId: true, dealId: true },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Admin calendar</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>Title</th>
              <th>Workspace</th>
              <th>Deal</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.startsAt.toLocaleString()}</td>
                <td>{event.kind}</td>
                <td>{event.title}</td>
                <td>{event.workspaceId}</td>
                <td>{event.dealId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
