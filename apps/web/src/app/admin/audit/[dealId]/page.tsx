import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminDealAuditPage({ params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");
  const { dealId } = await params;

  const events = await prisma.dealAuditEvent.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deal audit timeline</h1>
      <p style={{ color: "var(--muted)" }}>Deal {dealId}</p>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.createdAt.toLocaleString()}</td>
                <td>{event.action}</td>
                <td>{event.actorRole ?? "—"}</td>
                <td>{event.entityType ?? "—"}</td>
                <td style={{ fontSize: 12 }}>{event.chainHash?.slice(0, 16) ?? "—"}</td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  No audit events for this deal.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
