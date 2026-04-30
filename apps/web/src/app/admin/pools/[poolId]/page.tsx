import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminManagementRole } from "@/lib/role-policy";
import { prisma } from "@/lib/db";

export default async function AdminPoolDetailPage({ params }: { params: Promise<{ poolId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdminManagementRole(session.user.role)) {
    redirect("/dashboard");
  }

  const { poolId } = await params;
  const pool = await prisma.loanPool.findUnique({
    where: { id: poolId },
    include: {
      lender: { select: { name: true, id: true } },
      deals: {
        take: 50,
        include: {
          dealer: { select: { name: true } },
          financials: true,
          authoritativeContract: { select: { authoritativeContractHash: true } },
        },
      },
    },
  });
  if (!pool) redirect("/admin/pools");

  return (
    <div className="ds-section-shell">
      <Link href="/admin/pools" className="btn btn-secondary">
        All pools
      </Link>
      <h1 style={{ marginTop: "1rem" }}>{pool.poolName}</h1>
      <p>
        Lender: <strong>{pool.lender.name}</strong> · Integrity: <strong>{pool.poolIntegrityStatus}</strong> · Audit:{" "}
        <strong>{pool.auditStatus}</strong>
      </p>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
        Custody keys: {pool.lastPackageStorageKey ?? "—"}
      </p>
      <h2 style={{ marginTop: "1.5rem" }}>Loans ({pool.deals.length})</h2>
      <table className="ds-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Deal</th>
            <th>Dealer</th>
            <th>Principal</th>
          </tr>
        </thead>
        <tbody>
          {pool.deals.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{d.dealer.name}</td>
              <td>
                {d.financials
                  ? Number(d.financials.amountFinanced).toLocaleString(undefined, { style: "currency", currency: "USD" })
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
