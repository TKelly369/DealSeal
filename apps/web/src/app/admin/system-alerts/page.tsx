import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminSystemAlertsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/system-alerts");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const alerts = await prisma.dealAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    select: {
      id: true,
      dealId: true,
      severity: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>System alerts</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Severity</th>
              <th>Title</th>
              <th>Status</th>
              <th>Deal</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{alert.createdAt.toLocaleString()}</td>
                <td>{alert.severity}</td>
                <td>{alert.title}</td>
                <td>{alert.status}</td>
                <td>{alert.dealId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
