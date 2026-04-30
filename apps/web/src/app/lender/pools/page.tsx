import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceType } from "@/lib/onboarding-status";
import { LoanPoolService } from "@/lib/services/loan-pool.service";

export default async function LenderPoolsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/pools");
  const ws = await getWorkspaceType(session.user.workspaceId);
  if (ws !== "LENDER") {
    redirect("/dashboard");
  }

  const pools = await LoanPoolService.listForLender(session.user.workspaceId);

  return (
    <div className="ds-section-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <h1 style={{ marginTop: 0 }}>Loan pools</h1>
        <Link href="/lender/pools/new" className="btn">
          New pool
        </Link>
      </div>
      <p style={{ color: "var(--muted)", maxWidth: "52rem" }}>
        Lender-only portfolio grouping for funded, validated deals. DealSeal does not assign credit tiers — filters use your
        onboarded classifications only. AI verifies package quality, recommends prime/subprime/other market arrangement,
        and routes final approve/hold to a lender representative before automation continues.
      </p>
      {pools.length === 0 ? (
        <p>No pools yet. Create one to begin packaging loans.</p>
      ) : (
        <table className="ds-table" style={{ width: "100%", marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Integrity</th>
              <th>Loans</th>
              <th>Principal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => (
              <tr key={p.id}>
                <td>{p.poolName}</td>
                <td>{p.poolType}</td>
                <td>{p.status}</td>
                <td>{p.poolIntegrityStatus}</td>
                <td>{p.totalLoanCount}</td>
                <td>{Number(p.totalPrincipalBalance).toLocaleString(undefined, { style: "currency", currency: "USD" })}</td>
                <td>
                  <Link href={`/lender/pools/${p.id}`} className="btn btn-secondary">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
