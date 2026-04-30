import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function LenderSecondaryMarketPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/secondary-market");
  const lenderId = session.user.workspaceId;

  const pools = await prisma.loanPool.findMany({
    where: { lenderId },
    select: {
      id: true,
      poolName: true,
      poolType: true,
      status: true,
      saleStage: true,
      totalLoanCount: true,
      poolIntegrityStatus: true,
      auditStatus: true,
      lastPackageGeneratedAt: true,
      lastPackageStorageKey: true,
      transferDate: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const summary = {
    draft: pools.filter((p) => p.status === "DRAFT").length,
    readyForReview: pools.filter((p) => p.status === "ACTIVE" || p.status === "IN_REVIEW").length,
    readyForSale: pools.filter((p) => p.status === "READY_FOR_SALE").length,
    soldOrTransferred: pools.filter((p) => p.status === "SOLD" || p.status === "TRANSFERRED").length,
    missingPackage: pools.filter((p) => !p.lastPackageStorageKey).length,
  };

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Secondary market readiness</h1>
      <p style={{ color: "var(--muted)", maxWidth: 760 }}>
        Pool package command center: summary, loan-level data placeholder, document index, contract references, audit/custody
        summary, and validation certificate references.
      </p>
      <div className="ds-dashboard-bottom-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="card"><p className="ds-card-title">Draft</p><h2>{summary.draft}</h2></div>
        <div className="card"><p className="ds-card-title">Ready review</p><h2>{summary.readyForReview}</h2></div>
        <div className="card"><p className="ds-card-title">Ready sale</p><h2>{summary.readyForSale}</h2></div>
        <div className="card"><p className="ds-card-title">Sold/transferred</p><h2>{summary.soldOrTransferred}</h2></div>
        <div className="card"><p className="ds-card-title">Missing package</p><h2>{summary.missingPackage}</h2></div>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <table className="ds-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Pool</th>
              <th>Type</th>
              <th>Status</th>
              <th>Integrity</th>
              <th>Audit</th>
              <th>Loans</th>
              <th>Package</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pools.map((pool) => (
              <tr key={pool.id}>
                <td>{pool.poolName}</td>
                <td>{pool.poolType}</td>
                <td>{pool.status}</td>
                <td>{pool.poolIntegrityStatus}</td>
                <td>{pool.auditStatus}</td>
                <td>{pool.totalLoanCount}</td>
                <td>{pool.lastPackageGeneratedAt ? pool.lastPackageGeneratedAt.toLocaleString() : "Not generated"}</td>
                <td>
                  <Link href={`/lender/pools/${pool.id}`} className="btn btn-secondary">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
