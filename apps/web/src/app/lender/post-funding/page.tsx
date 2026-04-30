import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LenderOpsService } from "@/lib/services/lender-ops.service";

export default async function LenderPostFundingPage() {
  const session = await auth();
  if (!session?.user) redirect("/lender/login?next=/lender/post-funding");
  const lenderId = session.user.workspaceId;

  const [fundedDeals, missingItems] = await Promise.all([
    prisma.deal.findMany({
      where: { lenderId, status: { in: ["FUNDED", "CONSUMMATED", "AWAITING_FUNDING_UPLOAD"] } },
      select: {
        id: true,
        state: true,
        status: true,
        dealer: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    LenderOpsService.listMissingItemRequests(lenderId),
  ]);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Post-funding follow-up</h1>
      <p style={{ color: "var(--muted)", maxWidth: 760 }}>
        Track title, registration, insurance, delayed stips, and missing dealer documents after funding.
      </p>
      <div className="card">
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          Outstanding dealer item workflow
        </h2>
        {missingItems.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No outstanding post-funding item requests.</p>
        ) : (
          <table className="ds-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Deal</th>
              </tr>
            </thead>
            <tbody>
              {missingItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.requestedItemType}</td>
                  <td>{item.status}</td>
                  <td>{item.priority}</td>
                  <td>{item.dueDate ? item.dueDate.toLocaleDateString() : "—"}</td>
                  <td>
                    <Link href={`/lender/deal-intake/${item.dealId}`}>Open deal</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>
          Funded deal file follow-up
        </h2>
        <table className="ds-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Dealer</th>
              <th>Status</th>
              <th>State</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {fundedDeals.map((deal) => (
              <tr key={deal.id}>
                <td>
                  <Link href={`/lender/deal-intake/${deal.id}`}>
                    <code>{deal.id.slice(0, 10)}…</code>
                  </Link>
                </td>
                <td>{deal.dealer.name}</td>
                <td>{deal.status}</td>
                <td>{deal.state}</td>
                <td>{deal.updatedAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
