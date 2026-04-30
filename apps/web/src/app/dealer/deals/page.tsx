import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealService } from "@/lib/services/deal.service";

export default async function DealerDealsIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/dealer/login?next=/dealer/deals");
  const dealerId = session.user.workspaceId;
  let deals: Awaited<ReturnType<typeof DealService.listDealsForDealer>> = [];
  try {
    deals = await DealService.listDealsForDealer(dealerId);
  } catch (e) {
    console.error("[DealSeal] Dealer deals list", e);
  }

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>Deals</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Open a deal to work the lifecycle, buyer, vehicle, documents, compliance, and submit steps.
      </p>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <Link className="btn" href="/dealer/deals/new">
          New deal
        </Link>
        <Link className="btn btn-secondary" href="/dealer/dashboard">
          Dashboard
        </Link>
      </div>
      {deals.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No deals yet. Start with a new deal.</p>
      ) : (
        <table className="ds-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>State</th>
              <th>Lender</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id}>
                <td style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{d.id}</td>
                <td>{d.status}</td>
                <td>{d.state}</td>
                <td>{d.lender.name}</td>
                <td>
                  <Link href={`/dealer/deals/${d.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
