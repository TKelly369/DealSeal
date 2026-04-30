import { auth } from "@/lib/auth";
import { isAdminManagementRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AdminLinksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/links");
  if (!isAdminManagementRole(session.user.role)) redirect("/dashboard");
  const links = await prisma.dealerLenderLink.findMany({
    include: {
      dealer: { select: { name: true } },
      lender: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Dealer-Lender Link Management</h2>
      <table className="ds-table">
        <thead>
          <tr>
            <th>Dealer</th>
            <th>Lender</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id}>
              <td>{link.dealer.name}</td>
              <td>{link.lender.name}</td>
              <td>{link.status}</td>
              <td>
                <form
                  action={async () => {
                    "use server";
                    const fresh = await auth();
                    if (!fresh?.user) redirect("/login?next=/admin/links");
                    if (!isAdminManagementRole(fresh.user.role)) redirect("/dashboard");
                    await prisma.dealerLenderLink.update({ where: { id: link.id }, data: { status: "SUSPENDED" } });
                  }}
                >
                  <button type="submit" className="btn btn-secondary">
                    Suspend
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
