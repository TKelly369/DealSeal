import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminPoolsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin/pools");
  if (session.user.role !== "PLATFORM_ADMIN" && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const pools = await prisma.loanPool.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      lender: { select: { name: true, id: true } },
      _count: { select: { deals: true } },
    },
    take: 200,
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Admin · Loan pools</h1>
      <p style={{ color: "var(--muted)" }}>Cross-tenant visibility for custody / audit review.</p>
      <table className="ds-table" style={{ width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Pool</th>
            <th>Lender</th>
            <th>Type</th>
            <th>Status</th>
            <th>Integrity</th>
            <th># Deals</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pools.map((p) => (
            <tr key={p.id}>
              <td>{p.poolName}</td>
              <td>{p.lender.name}</td>
              <td>{p.poolType}</td>
              <td>{p.status}</td>
              <td>{p.poolIntegrityStatus}</td>
              <td>{p._count.deals}</td>
              <td>
                <Link href={`/admin/pools/${p.id}`} className="btn btn-secondary">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
