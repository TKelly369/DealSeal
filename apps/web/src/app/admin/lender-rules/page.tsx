import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminLenderRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/lender-rules");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  const links = await prisma.dealerLenderLink.findMany({
    where: { status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      lender: { select: { name: true } },
      dealer: { select: { name: true } },
      lenderRuleProfile: true,
    },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Lender rules</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Lender</th>
              <th>Dealer</th>
              <th>Rule profile</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id}>
                <td>{link.lender.name}</td>
                <td>{link.dealer.name}</td>
                <td style={{ fontSize: 12 }}>
                  {link.lenderRuleProfile && typeof link.lenderRuleProfile === "object" ? "Configured" : "Default"}
                </td>
              </tr>
            ))}
            {links.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: "var(--muted)" }}>
                  No approved lender programs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
