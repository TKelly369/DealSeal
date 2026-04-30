import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminCustodyPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/custody");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const events = await prisma.documentCustodyEvent.findMany({
    orderBy: { timestamp: "desc" },
    take: 150,
    select: {
      id: true,
      dealId: true,
      documentId: true,
      eventType: true,
      actorRole: true,
      timestamp: true,
    },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Custody events</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Deal</th>
              <th>Document</th>
              <th>Actor role</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.timestamp.toLocaleString()}</td>
                <td>{event.eventType}</td>
                <td>{event.dealId}</td>
                <td>{event.documentId ?? "—"}</td>
                <td>{event.actorRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
