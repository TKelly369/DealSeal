import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LenderOpsService } from "@/lib/services/lender-ops.service";

export default async function LenderEnforcementReadinessPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/enforcement-readiness");
  const lenderId = session.user.workspaceId;
  const deals = await prisma.deal.findMany({
    where: { lenderId },
    select: { id: true, dealer: { select: { name: true } }, status: true, complianceStatus: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const readiness = await Promise.all(
    deals.map(async (deal) => ({
      deal,
      readiness: await LenderOpsService.evaluateEnforcementReadiness(deal.id, lenderId),
    })),
  );

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Enforcement readiness</h1>
      <p style={{ color: "var(--muted)", maxWidth: 760 }}>
        Record-readiness checklist for repossession/replevin confidence. This is a package-completeness tool, not legal advice.
      </p>
      <table className="ds-table" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Deal</th>
            <th>Dealer</th>
            <th>Score</th>
            <th>Readiness</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {readiness.map(({ deal, readiness: r }) => (
            <tr key={deal.id}>
              <td>
                <code>{deal.id.slice(0, 10)}…</code>
              </td>
              <td>{deal.dealer.name}</td>
              <td>{r.score}%</td>
              <td>{r.status}</td>
              <td>{deal.status}</td>
              <td>
                <Link href={`/lender/deal-intake/${deal.id}`} className="btn btn-secondary">
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
