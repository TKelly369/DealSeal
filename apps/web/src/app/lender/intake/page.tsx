import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function LenderIntakePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/lender/intake");
  const lenderId = session.user.workspaceId;
  const deals = await prisma.deal.findMany({
    where: { lenderId },
    include: {
      dealer: { select: { name: true } },
      amendments: { where: { status: "PENDING_LENDER_APPROVAL" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deal Intake Queue</h1>
      <div className="card">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Deal ID</th>
              <th>Dealer</th>
              <th>Status</th>
              <th>State</th>
              <th>Amendments</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id}>
                <td>{deal.id}</td>
                <td>{deal.dealer.name}</td>
                <td>{deal.status}</td>
                <td>{deal.state}</td>
                <td>
                  {deal.amendments.length > 0 ? (
                    <span style={{ color: "#fdba74", fontWeight: 600 }}>Pending ({deal.amendments.length})</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Link href={`/lender/intake/${deal.id}`}>Workflow</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
