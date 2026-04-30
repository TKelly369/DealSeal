import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminShellRole } from "@/lib/role-policy";
import { redirect } from "next/navigation";

export default async function AdminDealsPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login?next=/admin/deals");
  if (!isAdminShellRole(session.user.role)) redirect("/dashboard");

  let deals: Array<{
    id: string;
    status: string;
    state: string;
    createdAt: Date;
    dealer: { name: string } | null;
    lender: { name: string } | null;
  }> = [];
  let warning: string | null = null;
  try {
    deals = await prisma.deal.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        state: true,
        createdAt: true,
        dealer: { select: { name: true } },
        lender: { select: { name: true } },
      },
    });
  } catch {
    warning = "Deal list unavailable right now.";
  }

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deals</h1>
      {warning ? <p style={{ color: "#fecaca" }}>{warning}</p> : null}
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Deal</th>
              <th>Dealer</th>
              <th>Lender</th>
              <th>Status</th>
              <th>State</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id}>
                <td>
                  <Link href={`/admin/deals/${deal.id}`}>{deal.id.slice(0, 12)}…</Link>
                </td>
                <td>{deal.dealer?.name ?? "—"}</td>
                <td>{deal.lender?.name ?? "—"}</td>
                <td>{deal.status}</td>
                <td>{deal.state}</td>
                <td>{deal.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {deals.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)" }}>
                  No deals found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
