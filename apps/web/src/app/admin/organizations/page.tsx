import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminOrganizationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/organizations");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      createdAt: true,
      _count: { select: { memberships: true, dealerDeals: true, lenderDeals: true } },
    },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Organizations</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Members</th>
              <th>Dealer deals</th>
              <th>Lender deals</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => (
              <tr key={workspace.id}>
                <td>{workspace.name}</td>
                <td>{workspace.type}</td>
                <td>{workspace._count.memberships}</td>
                <td>{workspace._count.dealerDeals}</td>
                <td>{workspace._count.lenderDeals}</td>
                <td>{workspace.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
