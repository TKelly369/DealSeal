import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminTasksPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/tasks");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const [openAlerts, pendingLinks, unresolvedComments] = await Promise.all([
    prisma.dealAlert.count({ where: { status: "OPEN" } }),
    prisma.dealerLenderLink.count({ where: { status: "PENDING" } }),
    prisma.dealComment.count({ where: { isResolved: false } }),
  ]);

  const items = [
    { label: "Resolve open system alerts", count: openAlerts },
    { label: "Review pending dealer-lender links", count: pendingLinks },
    { label: "Triage unresolved deal comments", count: unresolvedComments },
  ];

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Internal admin tasks</h1>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {items.map((item) => (
            <li key={item.label} style={{ marginBottom: "0.4rem" }}>
              {item.label}: <strong>{item.count}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
