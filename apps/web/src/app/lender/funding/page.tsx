import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function LenderFundingPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/funding");
  const lenderId = session.user.workspaceId;

  const deals = await prisma.deal.findMany({
    where: { lenderId, status: { in: ["LENDER_FINAL_APPROVAL", "AWAITING_FUNDING_UPLOAD", "FUNDED", "CONSUMMATED"] } },
    select: {
      id: true,
      status: true,
      state: true,
      dealer: { select: { name: true } },
      complianceStatus: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Funding operations</h1>
      <p style={{ color: "var(--muted)", maxWidth: 760 }}>
        Approvals, conditions, and final funding readiness. Green means complete and fundable, yellow indicates non-blocking
        warnings, red indicates blockers requiring remediation before funding confidence.
      </p>
      <table className="ds-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Deal</th>
            <th>Dealer</th>
            <th>Status</th>
            <th>State</th>
            <th>Compliance</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              <td>
                <code>{deal.id.slice(0, 10)}…</code>
              </td>
              <td>{deal.dealer.name}</td>
              <td>{deal.status}</td>
              <td>{deal.state}</td>
              <td>{deal.complianceStatus}</td>
              <td>{deal.updatedAt.toLocaleString()}</td>
              <td>
                <Link href={`/lender/deal-intake/${deal.id}`} className="btn btn-secondary">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
