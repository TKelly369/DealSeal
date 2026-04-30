import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminDealerLenderLinksPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/dealer-lender-links");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const links = await prisma.dealerLenderLink.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      dealer: { select: { name: true } },
      lender: { select: { name: true } },
    },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Dealer-lender links</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Dealer</th>
              <th>Lender</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id}>
                <td>{link.dealer.name}</td>
                <td>{link.lender.name}</td>
                <td>{link.status}</td>
                <td>{link.updatedAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
